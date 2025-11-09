const express = require("express");
const authController = require("../controllers/authController");
const reviewController = require("../controllers/reviewController");

const router = express.Router();

router.use(authController.protect);
router
  .route("/")
  .post(authController.restrictTo("user", "admin"), reviewController.createReview);

router.get(
  "/car/:carId",
  authController.restrictTo("user", "admin"),
  reviewController.getCarReviews
);

module.exports = router;
