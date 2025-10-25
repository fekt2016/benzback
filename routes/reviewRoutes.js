const express = require("express");
const authController = require("../controllers/authController");
const reviewController = require("../controllers/reviewController");

const router = express.Router();

router.use(authController.protect);
router
  .route("/")
  .post(authController.restrictTo("user"), reviewController.createReview);

router.get(
  "/car/:carId",
  authController.restrictTo("user"),
  reviewController.getCarReviews
);

module.exports = router;
