const catchAsync = require("../utils/catchAsync");
const Booking = require("../models/bookingModel");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const AppError = require("../utils/appError");
const Payment = require("../models/paymentModel");

exports.createStripePayment = catchAsync(async (req, res, next) => {
  const { metadata } = req.body;

  const { booking_id: bookingId } = metadata;

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

    const booking = await Booking.findByIdAndUpdate(bookingId, {
      stripeSessionId: session.id,
    });
    if (!booking) {
      return next(new AppError("Booking not found", 404));
    }
    res.status(200).json({ id: session.id });
  } catch (error) {
    console.error("Stripe session creation error:", error);

    res.status(500).json({
      error: "Failed to create checkout session",
      message: error.message,
    });
  }
});

exports.getBookingConfirmation = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  try {
    // First, get the booking as a mongoose document (not lean) so we can update it
    const booking = await Booking.findById(bookingId)
      .populate("user")
      .populate("car");

    if (!booking) {
      return next(new AppError("Booking not found", 404));
    }

    let session = null;
    let paymentStatus = "unpaid"; // Default status

    if (booking.stripeSessionId) {
      try {
        // Fixed: Corrected the typo from 'session' to 'sessions'
        session = await stripe.checkout.sessions.retrieve(
          booking.stripeSessionId
        );

        // Check if payment was successful
        if (session.payment_status === "paid") {
          paymentStatus = "paid";

          // Update booking status to 'confirmed' if it's not already
          if (booking.status !== "confirmed") {
            console.log("is not confirmed");
            booking.status = "confirmed";
            booking.paymentStatus = "paid";
            booking.paidAt = new Date();

            // If session has payment intent, get more details
            if (session.payment_intent) {
              const paymentIntent = await stripe.paymentIntents.retrieve(
                session.payment_intent
              );
              booking.paymentDetails = {
                paymentIntentId: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                paymentMethod: paymentIntent.payment_method_types[0],
              };
            }

            await booking.save();

            // Populate again after saving to get updated data
            await booking.populate("user");
            await booking.populate("car");
          }
        } else if (session.payment_status === "unpaid") {
          paymentStatus = "unpaid";
          // You might want to handle unpaid status here
        }
      } catch (stripeError) {
        console.error("Stripe session retrieval error:", stripeError);
        // Continue with the booking even if Stripe session retrieval fails
      }
    }

    // Convert to plain object for response
    const populatedBooking = booking.toObject ? booking.toObject() : booking;

    res.status(200).json({
      success: true,
      data: {
        booking: populatedBooking,
        session: session,
        paymentStatus: paymentStatus,
      },
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify payment",
      message: error.message,
    });
  }
});
