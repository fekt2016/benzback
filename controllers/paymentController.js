const { catchAsync } = require("../utils/catchAsync");
const Booking = require("../models/bookingModel");
const AppError = require("../utils/appError");
const { getFrontendUrl } = require("../utils/helper");

// Initialize Stripe safely
let stripe = null;
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("[PaymentController] ❌ Missing STRIPE_SECRET_KEY in .env");
} else {
  stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  const keyType = process.env.STRIPE_SECRET_KEY.startsWith("sk_live") ? "LIVE" : "TEST";
  console.log(`[PaymentController] ✅ Stripe initialized (${keyType} mode)`);
}

// Cached Stripe config
const STRIPE_CONFIG = {
  payment_method_types: ["card"],
  mode: "payment",
  allow_promotion_codes: true,
  customer_creation: "if_required",
};

/** 🔹 Helper: clean booking object before sending response */
function cleanupBookingData(booking) {
  if (!booking) return null;
  return {
    _id: booking._id,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    totalPrice: booking.totalPrice,
    pickupDate: booking.pickupDate,
    returnDate: booking.returnDate,
    rentalDays: booking.rentalDays,
    basePrice: booking.basePrice,
    depositAmount: booking.depositAmount,
    user: booking.user
      ? {
          email: booking.user.email,
          fullName: booking.user.fullName,
          phone: booking.user.phone,
        }
      : null,
    car: booking.car
      ? {
          model: booking.car.model,
          make: booking.car.make,
          year: booking.car.year,
          images: booking.car.images || [],
          seats: booking.car.seats,
        }
      : null,
  };
}

/** 🔹 Create Stripe Checkout Session */
exports.createStripePayment = catchAsync(async (req, res, next) => {
  const { metadata, line_items, customer_email, mobile = false } = req.body;

  if (!metadata?.booking_id)
    return next(new AppError("Booking ID is required", 400));
  if (!Array.isArray(line_items) || line_items.length === 0)
    return next(new AppError("Line items are required", 400));
  if (!stripe) return next(new AppError("Stripe not configured", 500));

  const bookingId = metadata.booking_id;
  const booking = await Booking.findById(bookingId)
    .populate("car", "model images seats")
    .populate("user", "email fullName phone")
    .select("status paymentStatus totalPrice pickupDate returnDate basePrice depositAmount rentalDays")
    .lean();

  if (!booking) return next(new AppError("Booking not found", 404));
  if (booking.paymentStatus === "paid")
    return next(new AppError("Booking already paid", 400));

  // ✅ Get frontend URL dynamically (env-safe)
  const FRONTEND_URL = getFrontendUrl();

  let successUrl = `${FRONTEND_URL}/confirmation?booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`;
  let cancelUrl = `${FRONTEND_URL}/checkout?booking_id=${bookingId}`;

  if (mobile) {
    successUrl += "&mobile=true";
    cancelUrl += "&mobile=true";
  }

  console.log("[PaymentController] ✅ Stripe redirect URLs:", {
    env: process.env.NODE_ENV,
    mobile,
    successUrl,
    cancelUrl,
  });

  // ✅ Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    ...STRIPE_CONFIG,
    line_items,
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: customer_email || booking.user?.email,
    metadata: {
      booking_id: bookingId.toString(),
      car_model: booking.car?.model || "Unknown",
      mobile_flow: mobile ? "true" : "false",
    },
  });

  // Update booking state
  await Booking.updateOne(
    { _id: bookingId },
    { stripeSessionId: session.id, paymentStatus: "pending" }
  );

  // Allow cross-origin (for web + mobile)
  const origin = req.headers.origin;
  if (origin) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }

  res.status(200).json({
    success: true,
    sessionId: session.id,
    url: session.url,
    data: cleanupBookingData(booking),
    message: "Stripe session created successfully",
  });
});

/** 🔹 Booking Confirmation (post-payment verification) */
exports.getBookingConfirmation = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  if (!bookingId) return next(new AppError("Booking ID is required", 400));

  const booking = await Booking.findById(bookingId)
    .populate("user", "email fullName phone")
    .populate("car", "model make year images seats")
    .select(
      "status stripeSessionId paymentStatus totalPrice pickupDate returnDate basePrice depositAmount rentalDays"
    )
    .lean();

  if (!booking) return next(new AppError("Booking not found", 404));

  let session = null;
  let paymentStatus = booking.paymentStatus || "unpaid";

  try {
    // Retrieve session if not yet marked paid
    let paymentJustConfirmed = false;
    if (booking.stripeSessionId && booking.paymentStatus !== "paid") {
      session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
      if (session.payment_status === "paid") {
        paymentStatus = "paid";
        paymentJustConfirmed = true;
        
        // Get full booking data to check for driver request
        const fullBooking = await Booking.findById(bookingId)
          .populate("car", "model series images")
          .select("requestDriver driverRequestStatus pickupDate returnDate pickupLocation totalPrice requestedAt")
          .lean();
        
        const updateResult = await Booking.updateOne(
          { _id: bookingId },
          {
            status: "confirmed",
            paymentStatus: "paid",
            paidAt: new Date(),
          }
        );
        
        // Verify payment was successfully updated
        if (updateResult.modifiedCount === 0) {
          console.log(`[Payment] Booking ${bookingId} payment status was already set to paid. Skipping driver request.`);
        } else {
          booking.status = "confirmed";
          booking.paymentStatus = "paid";
          booking.paidAt = new Date();
          
          // Double-check: Verify payment status is now "paid" before sending driver request
          const verifiedBooking = await Booking.findById(bookingId)
            .select("paymentStatus requestDriver driverRequestStatus")
            .lean();
          
          if (verifiedBooking?.paymentStatus !== "paid") {
            console.warn(`[Payment] Booking ${bookingId} payment status is not "paid" (${verifiedBooking?.paymentStatus}). Skipping driver request.`);
          } else if (fullBooking?.requestDriver && fullBooking?.driverRequestStatus === "pending") {
            // 🔔 If requestDriver and payment is confirmed, emit socket event to all available drivers
            // CRITICAL: Only send driver request AFTER payment is confirmed (paymentStatus = "paid")
            // This ensures drivers only receive requests for paid bookings
            try {
              const io = req.app.get("io");
              if (io) {
                io.to("drivers").emit("driver_request", {
                  bookingId: bookingId,
                  car: {
                    model: fullBooking.car?.model,
                    series: fullBooking.car?.series,
                    images: fullBooking.car?.images?.[0],
                  },
                  pickupDate: fullBooking.pickupDate,
                  returnDate: fullBooking.returnDate,
                  pickupLocation: fullBooking.pickupLocation,
                  totalPrice: fullBooking.totalPrice,
                  requestedAt: fullBooking.requestedAt || new Date(),
                });
                console.log(`[Payment] Driver request emitted for paid booking: ${bookingId}`);
              }
            } catch (socketError) {
              console.error("[Payment] Error emitting driver_request:", socketError);
              // Don't fail payment verification if socket fails
            }
          }
        }
      }
    }

    const responseData = {
      booking: cleanupBookingData(booking),
      paymentStatus,
      session: session
        ? {
            id: session.id,
            payment_status: session.payment_status,
            amount_total: session.amount_total,
          }
        : null,
    };

    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    }

    res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    console.error("[getBookingConfirmation] Stripe verification failed:", error);
    res.status(200).json({
      success: true,
      data: {
        booking: cleanupBookingData(booking),
        paymentStatus: booking.paymentStatus,
        error: "Unable to verify payment with Stripe",
      },
    });
  }
});
