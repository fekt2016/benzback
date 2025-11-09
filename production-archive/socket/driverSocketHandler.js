const DriverProfile = require("../models/driverProfileModel");
const Driver = require("../models/driverModel");
const Booking = require("../models/bookingModel");
const mongoose = require("mongoose");

/**
 * Handle driver socket events
 * @param {Server} io - Socket.io server instance
 */
const initializeDriverSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    // Driver registration - join driver room
    socket.on("driver:register", async (data) => {
      try {
        const { driverId } = data || {};
        const userId = socket.userId;

        if (!userId) {
          return socket.emit("driver:register_error", { message: "User not authenticated" });
        }

        // First, try to find unified Driver model (for professional drivers created during signup)
        const User = require("../models/userModel");
        const user = await User.findById(userId).select("driver").lean();
        
        let driverRecord = null;
        let driverIdToUse = null;

        if (user?.driver) {
          // Check unified Driver model
          const unifiedDriver = await Driver.findById(user.driver).lean();
          if (unifiedDriver && unifiedDriver.driverType === "professional") {
            driverRecord = unifiedDriver;
            driverIdToUse = unifiedDriver._id.toString();
          }
        }

        // If not found in unified Driver, check DriverProfile (legacy support)
        if (!driverRecord) {
          const driverProfile = await DriverProfile.findOne({ user: userId }).lean();
          if (driverProfile) {
            driverRecord = driverProfile;
            driverIdToUse = driverProfile._id.toString();
          }
        }
        
        if (driverRecord && driverIdToUse) {
          // Check if driver is verified (license must be verified)
          const isVerified = driverRecord.license?.verified === true || driverRecord.verified === true;
          const isOnline = driverRecord.status === "active" || driverRecord.status === "available" || driverRecord.status === "busy";
          
          if (!isVerified) {
            console.log(`[Socket] Driver ${driverIdToUse} not verified. License verification required.`);
            socket.emit("driver:register_error", { 
              message: "Your license must be verified before you can receive ride requests. Please complete document verification." 
            });
            return;
          }
          
          if (!isOnline) {
            console.log(`[Socket] Driver ${driverIdToUse} is not online. Status: ${driverRecord.status}`);
            socket.emit("driver:register_error", { 
              message: "You must be online to receive ride requests. Please update your status to 'Available'." 
            });
            return;
          }
          
          socket.driverId = driverIdToUse;
          socket.join("drivers");
          socket.join(`driver:${driverIdToUse}`);
          console.log(`[Socket] Driver registered: ${driverIdToUse} (User: ${userId}) - Verified: ${isVerified}, Online: ${isOnline}`);
          socket.emit("driver:registered", { driverId: driverIdToUse });
        } else {
          console.log(`[Socket] Driver profile not found for user: ${userId}`);
          socket.emit("driver:register_error", { message: "Driver profile not found. Please complete driver registration." });
        }
      } catch (error) {
        console.error("[Socket] Driver registration error:", error);
        socket.emit("driver:register_error", { message: error.message });
      }
    });

    // Driver accepts a booking request
    socket.on("driver:accept", async (data) => {
      try {
        const { bookingId, driverId } = data;
        const userId = socket.userId;

        if (!bookingId) {
          return socket.emit("driver:accept_error", { message: "Booking ID is required" });
        }

        // Get driver profile (check both unified Driver and DriverProfile)
        let driverProfile = null;
        const User = require("../models/userModel");
        
        if (driverId) {
          // Try unified Driver first
          driverProfile = await Driver.findById(driverId).lean();
          // If not found, try DriverProfile
          if (!driverProfile) {
            driverProfile = await DriverProfile.findById(driverId).lean();
          }
        } else if (userId) {
          // Check unified Driver via user.driver reference
          const user = await User.findById(userId).select("driver").lean();
          if (user?.driver) {
            const unifiedDriver = await Driver.findById(user.driver).lean();
            if (unifiedDriver && unifiedDriver.driverType === "professional") {
              driverProfile = unifiedDriver;
            }
          }
          // If not found, try DriverProfile
          if (!driverProfile) {
            driverProfile = await DriverProfile.findOne({ user: userId }).lean();
          }
        }

        if (!driverProfile) {
          return socket.emit("driver:accept_error", { message: "Driver profile not found" });
        }

        // Use transaction to prevent race conditions
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            // Re-check booking status in transaction
            const booking = await Booking.findById(bookingId).session(session);
            if (!booking) {
              throw new Error("Booking not found");
            }

            if (booking.driverRequestStatus !== "pending") {
              throw new Error("Booking request already accepted or expired");
            }

            if (booking.driverAssigned) {
              throw new Error("Another driver already accepted this request");
            }

            // Lock and assign booking
            booking.acceptedDriver = driverProfile._id;
            booking.driverRequestStatus = "accepted";
            booking.driverAssigned = true;
            booking.status = "pending_payment";
            booking.statusHistory.push({
              status: "pending_payment",
              timestamp: new Date(),
              changedBy: driverProfile._id,
              notes: "Driver accepted booking request",
            });

            await booking.save({ session });

            // Emit success to accepting driver
            io.to(`driver:${driverProfile._id}`).emit("driver:accepted", {
              bookingId: booking._id,
              message: "Booking request accepted successfully",
            });

            // Broadcast to other drivers that request is closed
            socket.to("drivers").emit("driver:closed", {
              bookingId: booking._id,
              reason: "accepted_by_another",
            });

            // Notify user
            io.to(`user:${booking.user}`).emit("driver:assigned", {
              bookingId: booking._id,
              driver: {
                id: driverProfile._id,
                name: driverProfile.user?.fullName || "Driver",
              },
            });

            console.log(`[Socket] Driver ${driverProfile._id} accepted booking ${bookingId}`);
          });
        } finally {
          session.endSession();
        }
      } catch (error) {
        console.error("[Socket] Driver accept error:", error);
        socket.emit("driver:accept_error", { message: error.message });
      }
    });

    // Driver declines a request (optional)
    socket.on("driver:decline", async (data) => {
      try {
        const { bookingId } = data;
        // Just acknowledge, no need to update DB
        socket.emit("driver:declined", { bookingId });
      } catch (error) {
        console.error("[Socket] Driver decline error:", error);
        socket.emit("driver:decline_error", { message: error.message });
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      if (socket.driverId) {
        console.log(`[Socket] Driver disconnected: ${socket.driverId}`);
      }
    });
  });
};

module.exports = { initializeDriverSocketHandlers };

