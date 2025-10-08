const express = require("express");
const authController = require("../controllers/authController");
const reviewController = require("../controllers/reviewController");

const router = express.Router();

router.use(authController.protect);
router
  .route("/")
  .post(authController.restrictTo("user"), reviewController.createReview);
router.get(
  "/user-reviews",
  authController.restrictTo("user"),
  reviewController.getUserReviews
);

module.exports = router;
