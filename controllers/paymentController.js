const catchAsync = require("../utils/catchAsync");
const Booking = require("../models/bookingModel");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const AppError = require("../utils/appError");
const Payment = require("../models/paymentModel");
exports.createStripePayment = catchAsync(async (req, res, next) => {
  const { metadata } = req.body;
  const { bookingId } = metadata;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: req.body.line_items,
      mode: req.body.mode || "payment",
      success_url: req.body.success_url,
      cancel_url: req.body.cancel_url,
      customer_email: req.body.customer_email,
      metadata: req.body.metadata,
    });

    await Booking.findByIdAndUpdate(bookingId, {
      stripeSessionId: session.id,
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error("Stripe session creation error:", error);

    res.status(500).json({
      error: "Failed to create checkout session",
      message: error.message,
    });
  }
});
