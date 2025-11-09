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
      unique: true, // ✅ only one review per booking
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
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);




// ✅ Not unique — allow multiple reviews for same car from same user
// reviewSchema.index({ user: 1, car: 1 });

// ✅ Auto-update car ratings when saving or deleting
reviewSchema.post("save", async function () {
  const Car = mongoose.model("Car");
  const Review = mongoose.model("Review");

  const reviews = await Review.find({ car: this.car, status: "active" });
  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  await Car.findByIdAndUpdate(this.car, {
    averageRating: Math.round(avg * 10) / 10,
    ratingCount: reviews.length,
  });
});

reviewSchema.post("findOneAndDelete", async function (doc) {
  if (!doc) return;
  const Car = mongoose.model("Car");
  const Review = mongoose.model("Review");

  const reviews = await Review.find({ car: doc.car, status: "active" });
  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  await Car.findByIdAndUpdate(doc.car, {
    averageRating: Math.round(avg * 10) / 10,
    ratingCount: reviews.length,
  });
});

module.exports = mongoose.model("Review", reviewSchema);
