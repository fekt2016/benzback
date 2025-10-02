const express = require("express");
const reviewController = require("../controllers/reviewController");
const authController = require("../controllers/authController");

const router = express.Router({ mergeParams: true });

router.post(
  "/",
  authController.protect,
  authController.restrictTo("user"),
  reviewController.addReview
);
router
  .route("/:id")
  .patch(
    authController.protect,
    authController.restrictTo("user"),
    reviewController.updateReview
  )
  .delete(
    authController.protect,
    authController.restrictTo("user"),
    reviewController.deleteReview
  );

router.get(
  "/user/:id",
  authController.protect,
  authController.restrictTo("user"),
  reviewController.getUserReviews
);
router.get("/car/:id", reviewController.getCarReviews);

module.exports = router;
