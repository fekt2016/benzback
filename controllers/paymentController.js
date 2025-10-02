const Payment = require("../models/paymentModel");
const catchAsync = require("../utils/catchAsync");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const Booking = require("../models/bookingModel");
const AppError = require("../utils/appError");
const User = require("../models/userModel");
const Car = require("../models/carModel");
// Create payment
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
exports.verifyPayment = catchAsync(async (req, res, next) => {
  const { sessionId, bookingId } = req.params;

  try {
    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Find the booking
    const booking = await Booking.findById(bookingId)
      .populate({
        path: "user",
        select: "name email phone", // Only get needed fields
      })
      .populate({
        path: "car",
        select: "name model pricePerDay images",
      });
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      });
    }

    // Check payment status
    if (session.payment_status === "paid") {
      // Update booking to confirmed
      const updatedBooking = await Booking.findByIdAndUpdate(
        bookingId,
        {
          status: "confirmed",
          paymentStatus: "paid",
          paymentDate: new Date(),
          customerEmail: session.customer_email,
          amountPaid: session.amount_total / 100,
        },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        data: {
          booking: updatedBooking,
          session: {
            id: session.id,
            payment_status: session.payment_status,
            amount_total: session.amount_total,
            currency: session.currency,
          },
        },
      });
    } else {
      // Payment not completed yet
      return res.status(200).json({
        success: false,
        data: {
          booking: booking,
          session: {
            id: session.id,
            payment_status: session.payment_status,
            status: "pending",
          },
        },
        message: "Payment not completed yet",
      });
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify payment",
      message: error.message,
    });
  }
});
exports.getBookingConfirmation = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;

  try {
    // First, get the booking without populate to see the raw data
    const rawBooking = await Booking.findById(bookingId);
    console.log("🔍 Raw booking (no populate):", {
      userId: rawBooking.user,
      carId: rawBooking.car,
      userIdType: typeof rawBooking.user,
      carIdType: typeof rawBooking.car,
    });

    // Check if the referenced documents exist
    const userExists = await User.exists({ _id: rawBooking.user });
    const carExists = await Car.exists({ _id: rawBooking.car });

    console.log("🔍 Reference existence check:", {
      userExists,
      carExists,
      userId: rawBooking.user,
      carId: rawBooking.car,
    });

    // Now try populate
    const populatedBooking = await Booking.findById(bookingId)
      .populate("user")
      .populate("car")
      .lean();

    console.log("🔍 After populate:", {
      user: populatedBooking.user,
      car: populatedBooking.car,
      userType: typeof populatedBooking.user,
      carType: typeof populatedBooking.car,
    });

    if (!populatedBooking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      });
    }

    let session = null;
    if (populatedBooking.stripeSessionId) {
      session = await stripe.checkout.sessions.retrieve(
        populatedBooking.stripeSessionId
      );
    }

    res.status(200).json({
      success: true,
      data: {
        booking: populatedBooking,
        session: session,
      },
    });
  } catch (error) {
    console.error("Booking confirmation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get booking confirmation",
      message: error.message,
    });
  }
});
