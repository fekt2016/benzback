// Driver Socket Handler
const Driver = require('../models/driverModel');
const Booking = require('../models/bookingModel');

module.exports = (io, socket) => {
  // Update driver location
  socket.on('driver:location', async (data) => {
    try {
      if (!socket.driverId) {
        socket.emit('driver:location_error', { message: 'Driver profile not found' });
        return;
      }

      const { lat, lng } = data;
      if (!lat || !lng) {
        socket.emit('driver:location_error', { message: 'Latitude and longitude are required' });
        return;
      }

      // Update driver location
      await Driver.findByIdAndUpdate(socket.driverId, {
        'location.lat': Number(lat),
        'location.lng': Number(lng),
        'location.lastUpdated': new Date(),
        'location.socketId': socket.id,
        lastActiveAt: new Date(),
      });

      // Update car location if driver has a car
      const driver = await Driver.findById(socket.driverId).populate('car');
      if (driver.car) {
        const Car = require('../models/carModel');
        await Car.findByIdAndUpdate(driver.car._id, {
          'geoLocation.lat': Number(lat),
          'geoLocation.lng': Number(lng),
          'geoLocation.lastUpdated': new Date(),
        });
      }

      // Broadcast location to users with active bookings
      const activeBookings = await Booking.find({
        driver: socket.driverId,
        status: { $in: ['confirmed', 'in-progress'] },
      }).select('user').lean();

      activeBookings.forEach(booking => {
        io.to(`user:${booking.user}`).emit('driver:location_update', {
          driverId: socket.driverId,
          lat: Number(lat),
          lng: Number(lng),
          timestamp: new Date(),
        });
      });

      socket.emit('driver:location_updated', {
        lat: Number(lat),
        lng: Number(lng),
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('[Socket] Error updating driver location:', error);
      socket.emit('driver:location_error', { message: 'Failed to update location' });
    }
  });

  // Handle booking accept/reject
  socket.on('booking:accept', async (data) => {
    try {
      if (!socket.driverId) {
        socket.emit('booking:accept_error', { message: 'Driver profile not found' });
        return;
      }

      const { bookingId } = data;
      if (!bookingId) {
        socket.emit('booking:accept_error', { message: 'Booking ID is required' });
        return;
      }

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        socket.emit('booking:accept_error', { message: 'Booking not found' });
        return;
      }

      // Verify booking belongs to this driver
      if (booking.driver?.toString() !== socket.driverId) {
        socket.emit('booking:accept_error', { message: 'Access denied' });
        return;
      }

      // Update booking status
      booking.status = 'confirmed';
      booking.negotiationStatus = 'accepted';
      await booking.save();

      // Notify user
      io.to(`user:${booking.user}`).emit('booking:accepted', {
        bookingId,
        booking,
      });

      socket.emit('booking:accept_success', { bookingId, booking });
    } catch (error) {
      console.error('[Socket] Error accepting booking:', error);
      socket.emit('booking:accept_error', { message: 'Failed to accept booking' });
    }
  });

  socket.on('booking:reject', async (data) => {
    try {
      if (!socket.driverId) {
        socket.emit('booking:reject_error', { message: 'Driver profile not found' });
        return;
      }

      const { bookingId, reason } = data;
      if (!bookingId) {
        socket.emit('booking:reject_error', { message: 'Booking ID is required' });
        return;
      }

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        socket.emit('booking:reject_error', { message: 'Booking not found' });
        return;
      }

      // Verify booking belongs to this driver
      if (booking.driver?.toString() !== socket.driverId) {
        socket.emit('booking:reject_error', { message: 'Access denied' });
        return;
      }

      // Update booking status
      booking.status = 'rejected';
      booking.negotiationStatus = 'rejected';
      if (reason) {
        booking.negotiationChat = booking.negotiationChat || [];
        booking.negotiationChat.push({
          sender: socket.driverId,
          senderRole: 'driver',
          message: `Booking rejected: ${reason}`,
          timestamp: new Date(),
        });
      }
      await booking.save();

      // Notify user
      io.to(`user:${booking.user}`).emit('booking:rejected', {
        bookingId,
        reason,
      });

      socket.emit('booking:reject_success', { bookingId });
    } catch (error) {
      console.error('[Socket] Error rejecting booking:', error);
      socket.emit('booking:reject_error', { message: 'Failed to reject booking' });
    }
  });
};

