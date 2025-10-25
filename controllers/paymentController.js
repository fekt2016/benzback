const {catchAsync }= require("../utils/catchAsync");
const Booking = require("../models/bookingModel");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const AppError = require("../utils/appError");

// Cache stripe configuration to avoid recreating objects
const STRIPE_CONFIG = {
  payment_method_types: ["card"],
  mode: "payment",
  customer_creation: "if_required",
  allow_promotion_codes: true,
};

// Clean up function to remove circular references and large objects
function cleanupBookingData(booking) {
  if (!booking) return null;

  // Return only necessary fields for response
  return {
    _id: booking._id,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    totalPrice: booking.totalPrice,
    user: booking.user
      ? {
          email: booking.user.email,
          fullName: booking.user.fullName,
        }
      : null,
    car: booking.car
      ? {
          model: booking.car.model,
        }
      : null,
  };
}

exports.createStripePayment = catchAsync(

  async (req, res, next) => {
    const {
      metadata,
      line_items,
      mode,
      success_url,
      cancel_url,
      customer_email,
    } = req.body;

    // Early validation with minimal memory usage
    if (!metadata || !metadata.booking_id) {
      return next(new AppError("Booking ID is required", 400));
    }

    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      return next(new AppError("Line items are required", 400));
    }

    const bookingId = metadata.booking_id;
    let booking = null;
    let session = null;

    try {
      // Use lean() and select only necessary fields to reduce memory
      booking = await Booking.findById(bookingId)
        .populate("car", "model")
        .populate("user", "email fullName")
        .select("status paymentStatus totalPrice pickupDate returnDate")
        .lean();

      if (!booking) {
        return next(new AppError("Booking not found", 404));
      }

      if (booking.paymentStatus === "paid") {
        return next(new AppError("This booking has already been paid", 400));
      }

      // Create Stripe session with minimal data
      const sessionData = {
        ...STRIPE_CONFIG,
        line_items,
        mode: mode || STRIPE_CONFIG.mode,
        success_url:
          success_url ||
          `${process.env.FRONTEND_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
        cancel_url:
          cancel_url ||
          `${process.env.FRONTEND_URL}/booking/cancel?booking_id=${bookingId}`,
        customer_email: customer_email || booking.user.email,
        metadata: {
          booking_id: bookingId,
          car_model: booking.car?.model || "Unknown",
        },
      };

      session = await stripe.checkout.sessions.create(sessionData);

      // Update only necessary fields
      await Booking.updateOne(
        { _id: bookingId },
        {
          stripeSessionId: session.id,
          paymentStatus: "pending",
          $unset: {
            // Remove any unused fields that might accumulate
            temporaryData: 1,
            debugInfo: 1,
          },
        }
      );

    

      // Clean up response data
      const cleanBooking = cleanupBookingData(booking);

      res.status(200).json({
        success: true,
        sessionId: session.id,
        data: cleanBooking,
        message: "Payment session created successfully",
        // Include memory info in development
      });
    } catch (error) {
      console.error("Stripe session creation error:", error);

      // Clean up any references to allow garbage collection
      booking = null;
      session = null;

      if (error.type?.includes("StripeInvalidRequest")) {
        return next(
          new AppError(
            "Invalid payment request. Please check your payment details.",
            400
          )
        );
      }

      if (error.type?.includes("StripeConnection")) {
        return next(
          new AppError(
            "Payment service temporarily unavailable. Please try again.",
            503
          )
        );
      }

      res.status(500).json({
        success: false,
        error: "Failed to create checkout session",
        message: error.message,
      });
    }
  }
);

exports.getBookingConfirmation = catchAsync(
 
  async (req, res, next) => {
    const { bookingId } = req.params;

    // Use lean and select only necessary fields
    const booking = await Booking.findById(bookingId)
      .populate("user", "email fullName")
      .populate("car", "model make year")
      .select(
        "status paymentStatus stripeSessionId pickupDate returnDate totalPrice"
      )
      .lean();

    if (!booking) {
      return next(new AppError("Booking not found", 404));
    }

    let session = null;
    let paymentStatus = booking.paymentStatus || "unpaid";

    try {
      // Only check Stripe if we have a session and payment isn't confirmed
      if (booking.stripeSessionId && booking.paymentStatus !== "paid") {
        session = await stripe.checkout.sessions.retrieve(
          booking.stripeSessionId
        );

        if (session.payment_status === "paid") {
          paymentStatus = "paid";

          // Update booking status
          await Booking.updateOne(
            { _id: bookingId },
            {
              status: "confirmed",
              paymentStatus: "paid",
              paidAt: new Date(),
            }
          );

          // Update local booking object for response
          booking.status = "confirmed";
          booking.paymentStatus = "paid";
          booking.paidAt = new Date();
        }
      }

      // Clean up response data
      const responseData = {
        booking: cleanupBookingData(booking),
        paymentStatus,
        // Only include minimal session data
        session: session
          ? {
              id: session.id,
              payment_status: session.payment_status,
              amount_total: session.amount_total,
            }
          : null,
      };

      res.status(200).json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      console.error("Payment verification error:", error);

      // Still return booking data even if Stripe fails
      res.status(200).json({
        success: true,
        data: {
          booking: cleanupBookingData(booking),
          paymentStatus: booking.paymentStatus,
          error: "Unable to verify payment status with payment provider",
        },
      });
    }
  }
);
