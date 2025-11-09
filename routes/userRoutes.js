const express = require('express')

const router = express.Router()
const authController = require("../controllers/authController")
const userController = require('../controllers/userController')


router.route('/').post(authController.protect, authController.restrictTo("admin"), userController.createUser).get(authController.protect, authController.restrictTo("admin"), userController.getAllUsers)

// Toggle user role (any authenticated user can toggle their own role)
router.route('/toggle-role').patch(authController.protect, userController.toggleUserRole)

// User settings endpoints (protected, user can only access their own settings)
router.route('/settings')
  .get(authController.protect, userController.getSettings)
  .patch(authController.protect, userController.updateSettings)

// Delete account endpoint (protected, user can only delete their own account)
router.route('/account')
  .delete(authController.protect, userController.deleteAccount)

// Favorites/Wishlist endpoints
router.route('/favorites')
  .get(authController.protect, userController.getFavorites)

router.route('/favorites/:carId')
  .post(authController.protect, userController.toggleFavorite)

// Referral endpoints
router.route('/referrals')
  .get(authController.protect, userController.getReferrals)

router.route('/referrals/redeem')
  .post(authController.protect, userController.redeemReferralReward)

module.exports = router