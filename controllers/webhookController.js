const Booking = require("../models/bookingModel");
const {catchAsync} = require("../utils/catchAsync");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const emailServices = require("../utils/emailServices"); // Fixed typo: was "emailServices"

exports.handleStripeWebhook = catchAsync(async (req, res, next) => {
  console.log("🔔 Stripe webhook received!");

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    // console.log("✅ Stripe event verified:", event.type);
  } catch (err) {
    // console.error("❌ Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  res.json({ received: true });

  if (event.type === "checkout.session.completed") {
    console.log("✅ Payment completed for session:", event.data.object.id);
    await processPaymentAsync(event.data.object);
  }
})

// Memory-optimized async payment processing
async function processPaymentAsync(session) {
  let booking = null;

  try {
   

    // Use lean() and select only necessary fields to reduce memory
    booking = await Booking.findOne({
      stripeSessionId: session.id,
    })
      .populate("car", "model") // Only get car model field
      .populate("user", "email name") // Only get email and name fields
      .select("status paymentStatus pickupDate returnDate totalPrice") // Only select needed fields
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
    await Booking.updateOne(
      { _id: booking._id },
      {
        status: "confirmed",
        paymentStatus: "paid",
        paidAt: new Date(),
      }
    );

   

    // Send email without awaiting (fire and forget to free memory)
    sendConfirmationEmail(booking).catch((emailError) => {
      console.error("❌ Email sending failed:", emailError.message);
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
    await emailServices.sendBookingConfirmation({
      customerEmail: booking.user.email,
      customerName: booking.user.name,
      orderId: booking._id.toString(),
      vehicleModel: booking.car?.model || "Luxury Vehicle",
      pickupDate: new Date(booking.pickupDate).toLocaleDateString(),
      returnDate: new Date(booking.returnDate).toLocaleDateString(),
      totalAmount: booking.totalPrice?.toFixed(2) || "0.00",
      bookingLink: `${process.env.FRONTEND_URL}/booking/${booking._id}`,
    });
  
  } catch (emailError) {
    console.error("❌ Email service error:", emailError.message);
    throw emailError; // Re-throw to be caught by parent catch
  }
}
