const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    car: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true, // One review per booking
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      trim: true,
      maxLength: 500,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Also index by car for faster queries
reviewSchema.index({ car: 1, createdAt: -1 });

// Pre-save middleware to validate booking ownership
reviewSchema.pre("save", async function (next) {
  try {
    const Booking = mongoose.model("Booking");
    const booking = await Booking.findById(this.booking)
      .populate("user")
      .populate("car");

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Verify the booking belongs to the user creating the review
    if (booking.user._id.toString() !== this.user.toString()) {
      throw new Error("You can only review your own bookings");
    }

    // Verify the booking car matches the review car
    if (booking.car._id.toString() !== this.car.toString()) {
      throw new Error("Car in review does not match booked car");
    }

    // Optional: Check if booking is completed/eligible for review
    if (booking.status !== "completed") {
      throw new Error("You can only review completed bookings");
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Post-save middleware to update car ratings
reviewSchema.post("save", async function () {
  try {
    const Car = mongoose.model("Car");
    const Review = mongoose.model("Review");

    // Get all active reviews for this car
    const reviews = await Review.find({
      car: this.car,
      status: "active",
    });

    if (reviews.length > 0) {
      const totalRating = reviews.reduce(
        (sum, review) => sum + review.rating,
        0
      );
      const averageRating = totalRating / reviews.length;
      const ratingCount = reviews.length;

      // Get recent reviews for the car (last 5)
      const recentReviews = await Review.find({
        car: this.car,
        status: "active",
      })
        .populate("user", "name")
        .sort({ createdAt: -1 })
        .limit(5)
        .select("user rating comment createdAt");

      // Update the car
      await Car.findByIdAndUpdate(this.car, {
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        ratingCount,
        recentReviews: recentReviews.map((review) => ({
          user: review.user._id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
        })),
      });
    }
  } catch (error) {
    console.error("Error updating car ratings:", error);
  }
});

// Also update car when review is deleted
reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    const Car = mongoose.model("Car");
    const Review = mongoose.model("Review");

    const reviews = await Review.find({
      car: doc.car,
      status: "active",
    });

    if (reviews.length > 0) {
      const totalRating = reviews.reduce(
        (sum, review) => sum + review.rating,
        0
      );
      const averageRating = totalRating / reviews.length;

      const recentReviews = await Review.find({
        car: doc.car,
        status: "active",
      })
        .populate("user", "name")
        .sort({ createdAt: -1 })
        .limit(5)
        .select("user rating comment createdAt");

      await Car.findByIdAndUpdate(doc.car, {
        averageRating: Math.round(averageRating * 10) / 10,
        ratingCount: reviews.length,
        recentReviews: recentReviews.map((review) => ({
          user: review.user._id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
        })),
      });
    } else {
      // No reviews left, reset to defaults
      await Car.findByIdAndUpdate(doc.car, {
        averageRating: 0,
        ratingCount: 0,
        recentReviews: [],
      });
    }
  }
});

module.exports = mongoose.model("Review", reviewSchema);
