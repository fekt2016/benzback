// backend/utils/notificationHelpers.js
const Notification = require("../models/notificationModel");
const User = require("../models/userModel");

// Notification types that match your model
const NOTIFICATION_TYPES = {
  BOOKING_CREATED: "booking_created",
  BOOKING_CONFIRMED: "booking_confirmation", // Matches your model
  BOOKING_CANCELLED: "booking_cancelled",
  PAYMENT_SUCCESS: "payment_success", // Matches your model
  PAYMENT_FAILED: "payment_failed",
  DOCUMENT_VERIFIED: "document_verification", // Matches your model
  DOCUMENT_REJECTED: "document_rejection",
  BOOKING_REMINDER: "booking_reminder", // Matches your model
};

// Create notification for user
const createUserNotification = async (userId, notificationData) => {
  try {
    const notification = await Notification.create({
      user: userId, // ✅ Correct: using 'user' field
      ...notificationData,
    });

    console.log("✅ User notification created:", notification._id);
    return notification;
  } catch (error) {
    console.error("❌ Error creating user notification:", error);
    throw error;
  }
};

// Create notification for admin
const createAdminNotification = async (notificationData) => {
  try {
    // Find all admin users
    const adminUsers = await User.find({ role: "admin" }).select("_id");

    if (adminUsers.length === 0) {
      console.log("⚠️ No admin users found");
      return;
    }

    // Create notification for each admin
    const notificationPromises = adminUsers.map((admin) =>
      Notification.create({
        user: admin._id, // ✅ Correct: using 'user' field
        ...notificationData,
      })
    );

    const results = await Promise.all(notificationPromises);
    console.log(`✅ Created ${results.length} admin notifications`);
    return true;
  } catch (error) {
    console.error("❌ Error creating admin notification:", error);
    throw error;
  }
};

// Specific notification creators
const notifyBookingCreated = async (bookingData) => {
  try {
    const { userId, userName, carName, bookingId, carId, totalPrice } =
      bookingData;

    console.log("📋 Creating booking notifications for:", {
      userId,
      bookingId,
    });

    // User notification
    await createUserNotification(userId, {
      type: NOTIFICATION_TYPES.BOOKING_CREATED,
      title: "Booking Request Submitted 🚗",
      message: `Your booking request for ${carName} has been received. Total amount: $${totalPrice}. Please complete payment to confirm.`,
      relatedBooking: bookingId, // ✅ Using relatedBooking field
      metadata: {
        carId: carId.toString(),
        carName,
        totalPrice,
        status: "pending_payment",
      },
    });

    // Admin notification
    await createAdminNotification({
      type: NOTIFICATION_TYPES.BOOKING_CREATED,
      title: "New Booking Request 📋",
      message: `${userName} has requested to book ${carName} for $${totalPrice}. Waiting for payment.`,
      relatedBooking: bookingId, // ✅ Using relatedBooking field
      metadata: {
        carId: carId.toString(),
        carName,
        userName,
        userId: userId.toString(),
        totalPrice,
        status: "pending_payment",
      },
    });

    console.log("✅ Booking notifications created successfully");
  } catch (error) {
    console.error("❌ Error in notifyBookingCreated:", error);
    throw error;
  }
};

const notifyPaymentSuccess = async (paymentData) => {
  try {
    const { userId, userName, carName, bookingId, amount } = paymentData;

    console.log("💳 Creating payment success notifications for:", {
      userId,
      bookingId,
    });

    // User notification
    await createUserNotification(userId, {
      type: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
      title: "Payment Successful! ✅",
      message: `Your payment of $${amount} for ${carName} has been processed successfully. Your booking is now confirmed!`,
      relatedBooking: bookingId,
      metadata: {
        carName,
        amount,
        status: "confirmed",
      },
    });

    // Admin notification
    await createAdminNotification({
      type: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
      title: "Payment Received 💳",
      message: `${userName} has completed payment of $${amount} for ${carName} booking.`,
      relatedBooking: bookingId,
      metadata: {
        carName,
        userName,
        amount,
        status: "confirmed",
      },
    });

    console.log("✅ Payment success notifications created");
  } catch (error) {
    console.error("❌ Error in notifyPaymentSuccess:", error);
    throw error;
  }
};

const notifyPaymentFailed = async (paymentData) => {
  try {
    const { userId, userName, carName, bookingId, amount, error } = paymentData;

    // User notification
    await createUserNotification(userId, {
      type: "payment_failed", // Not in your enum, might need to add it
      title: "Payment Failed ❌",
      message: `Payment of $${amount} for ${carName} failed. Please try again or use a different payment method.`,
      relatedBooking: bookingId,
      metadata: {
        carName,
        amount,
        error,
        status: "payment_failed",
      },
    });

    // Admin notification
    await createAdminNotification({
      type: "payment_failed",
      title: "Payment Failed ⚠️",
      message: `${userName}'s payment of $${amount} for ${carName} failed.`,
      relatedBooking: bookingId,
      metadata: {
        carName,
        userName,
        amount,
        error,
        status: "payment_failed",
      },
    });
  } catch (error) {
    console.error("❌ Error in notifyPaymentFailed:", error);
    throw error;
  }
};

const notifyDocumentVerified = async (userData) => {
  try {
    const { userId, userName, documentType } = userData;

    await createUserNotification(userId, {
      type: NOTIFICATION_TYPES.DOCUMENT_VERIFIED,
      title: "Document Verified ✅",
      message: `Your ${documentType} has been verified and approved. You can now proceed with bookings.`,
      metadata: {
        documentType,
        status: "verified",
      },
    });
  } catch (error) {
    console.error("❌ Error in notifyDocumentVerified:", error);
    throw error;
  }
};

module.exports = {
  NOTIFICATION_TYPES,
  createUserNotification,
  createAdminNotification,
  notifyBookingCreated,
  notifyPaymentSuccess,
  notifyPaymentFailed,
  notifyDocumentVerified,
};
