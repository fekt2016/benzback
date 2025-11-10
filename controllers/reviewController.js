const Review = require("../models/reviewModel");
const {catchAsync} = require("../utils/catchAsync");
const Booking = require("../models/bookingModel");
const AppError = require("../utils/appError");
// const Car = require("../models/carModel");

exports.createReview = catchAsync( async (req, res, next) => {
  const { bookingId, rating, comment } = req.body; // Removed title since we removed it from the frontend

  // 1. Find the booking and populate necessary fields
  const booking = await Booking.findById(bookingId)
    .populate("user")
    .populate("car");

  if (!booking) {
    return next(new AppError("Booking not found", 404));
  }

  // 2. Check if user owns the booking
  if (booking.user._id.toString() !== req.user._id.toString()) {
    return next(new AppError("You can only review your own bookings", 403));
  }

  // 3. Check if booking is completed
  if (booking.status !== "completed") {
    return next(new AppError("You can only review completed bookings", 400));
  }

  // 4. Check if review already exists for this booking
  const existingReview = await Review.findOne({ booking: bookingId });
  if (existingReview) {
    return next(new AppError("You have already reviewed this booking", 400));
  }

  // 5. Create the review
  const review = await Review.create({
    user: req.user._id,
    car: booking.car._id,
    booking: bookingId,
    rating,
    comment: comment || null, // Handle empty comments
  });

  // 6. Populate the user data for response
  await review.populate("user", "fullName avatar");
  res.status(201).json({
    status: "success",
    message: "Review submitted successfully",
    data: { review },
  });
});


exports.getCarReviews = catchAsync(async (req, res, next) => {
  const paginateQuery = require("../utils/paginateQuery");
  const { carId } = req.params;
  
  const filter = { car: carId };

  const { data: reviews, pagination } = await paginateQuery(Review, filter, req, {
    queryModifier: (query) => query.populate("user", "fullName avatar").sort({ createdAt: -1 }),
    defaultLimit: 20,
    maxLimit: 100,
  });

  res.status(200).json({
    status: "success",
    ...pagination,
    data: reviews,
  });
});
