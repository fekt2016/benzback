const Booking = require("../models/bookingModel");
const {catchAsync} = require("../utils/catchAsync");
const emailServices = require("../utils/emailServices");
const { getFrontendUrl } = require("../utils/helper");

// Initialize Stripe safely
let stripe = null;
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("[WebhookController] ❌ Missing STRIPE_SECRET_KEY in environment variables");
} else {
  stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  const keyType = process.env.STRIPE_SECRET_KEY.startsWith("sk_live") ? "LIVE" : "TEST";
  console.log(`[WebhookController] ✅ Stripe initialized (${keyType} mode)`);
}

exports.handleStripeWebhook = catchAsync(async (req, res, next) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe is not configured" });
  }
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[WebhookController] ❌ Missing STRIPE_WEBHOOK_SECRET");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }
  
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }
  
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log("✅ Stripe event verified:", event.type);
  } catch (err) {
    console.error("❌ Signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  res.json({ received: true });

  if (event.type === "checkout.session.completed") {
    console.log("✅ Payment completed for session:", event.data.object.id);
    await processPaymentAsync(event.data.object, req);
  }
})

// Memory-optimized async payment processing
async function processPaymentAsync(session, req) {
  let booking = null;

  try {
   

    // Use lean() and select only necessary fields to reduce memory
    booking = await Booking.findOne({
      stripeSessionId: session.id,
    })
      .populate("car", "model series images") // Get car fields needed for driver request
      .populate("user", "email name") // Only get email and name fields
      .select("status paymentStatus pickupDate returnDate pickupLocation totalPrice requestDriver driverRequestStatus requestedAt") // Include driver request fields
      .lean(); // Convert to plain JS object (reduces memory by ~60%)

    if (!booking) {
      console.log("❌ Booking not found for session:", session.id);
      return;
    }

    // Check if already processed (using database check for reliability)
    const existingBooking = await Booking.findOne({
      _id: booking._id,
      paymentStatus: "paid",
    })
      .select("_id")
      .lean();

    if (existingBooking) {
      console.log(`✅ Booking ${booking._id} already paid. Skipping.`);
      return;
    }

    // Update using direct query (avoids loading full document)
    const updateResult = await Booking.updateOne(
      { _id: booking._id },
      {
        status: "confirmed",
        paymentStatus: "paid",
        paidAt: new Date(),
      }
    );

    // Verify payment was successfully updated
    if (updateResult.modifiedCount === 0) {
      console.log(`[Webhook] Booking ${booking._id} payment status was already set to paid. Skipping driver request.`);
      return;
    }

    // Double-check: Verify payment status is now "paid" before sending driver request
    const verifiedBooking = await Booking.findById(booking._id)
      .select("paymentStatus requestDriver driverRequestStatus")
      .lean();
    
    if (verifiedBooking?.paymentStatus !== "paid") {
      console.warn(`[Webhook] Booking ${booking._id} payment status is not "paid" (${verifiedBooking?.paymentStatus}). Skipping driver request.`);
      return;
    }

    // 🔔 If requestDriver and payment is confirmed, emit socket event to all available drivers
    // CRITICAL: Only send driver request AFTER payment is confirmed (paymentStatus = "paid")
    // This ensures drivers only receive requests for paid bookings
    if (booking.requestDriver && booking.driverRequestStatus === "pending") {
      try {
        // Get io instance from app (set in server.js)
        const io = req?.app?.get("io");
        
        if (io) {
          // Emit to all drivers in the 'drivers' room
          io.to("drivers").emit("driver_request", {
            bookingId: booking._id,
            car: {
              model: booking.car?.model,
              series: booking.car?.series,
              images: booking.car?.images?.[0],
            },
            pickupDate: booking.pickupDate,
            returnDate: booking.returnDate,
            pickupLocation: booking.pickupLocation,
            totalPrice: booking.totalPrice,
            requestedAt: booking.requestedAt || new Date(),
          });
          console.log(`[Webhook] Driver request emitted for paid booking: ${booking._id}`);
        } else {
          console.warn("[Webhook] Socket.io instance not available");
        }
      } catch (socketError) {
        console.error("[Webhook] Error emitting driver_request:", socketError);
        // Don't fail payment processing if socket fails
      }
    }

    // Send email (await to ensure it completes or fails properly)
    await sendConfirmationEmail(booking).catch((emailError) => {
      console.error("❌ Email sending failed in webhook:", emailError.message);
      console.error("Email error details:", emailError);
      // Don't throw - we don't want email failures to break webhook processing
    });
  } catch (err) {
    console.error("❌ Error processing payment:", err);
  } finally {
    // Explicitly nullify to help garbage collection
    booking = null;
  }
}

// Separate function for email sending to reduce memory in main function
async function sendConfirmationEmail(booking) {
  try {
    console.log("📧 Preparing to send booking confirmation email...");
    console.log("Booking data:", {
      customerEmail: booking.user?.email,
      customerName: booking.user?.name,
      orderId: booking._id?.toString(),
      vehicleModel: booking.car?.model
    });

    // Validate required fields before sending
    if (!booking.user?.email) {
      throw new Error("Customer email is missing from booking");
    }
    if (!booking.user?.name) {
      throw new Error("Customer name is missing from booking");
    }

    await emailServices.sendBookingConfirmation({
      customerEmail: booking.user.email,
      customerName: booking.user.name,
      orderId: booking._id.toString(),
      vehicleModel: booking.car?.model || "Luxury Vehicle",
      pickupDate: new Date(booking.pickupDate).toLocaleDateString(),
      returnDate: new Date(booking.returnDate).toLocaleDateString(),
      totalAmount: booking.totalPrice?.toFixed(2) || "0.00",
      bookingLink: `${getFrontendUrl()}/booking/${booking._id}`,
    });
    
    console.log("✅ Booking confirmation email sent successfully");
  } catch (emailError) {
    console.error("❌ Email service error:", emailError.message);
    console.error("Email error stack:", emailError.stack);
    throw emailError; // Re-throw to be caught by parent catch
  }
}
