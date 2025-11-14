// Negotiation Socket Handler
const Booking = require('../models/bookingModel');

module.exports = (io, socket) => {
  // Join negotiation room
  socket.on('negotiation:join', async (bookingId) => {
    try {
      if (!bookingId) {
        socket.emit('negotiation:error', { message: 'Booking ID is required' });
        return;
      }

      // Verify user has access to this booking
      const booking = await Booking.findById(bookingId).lean();
      if (!booking) {
        socket.emit('negotiation:error', { message: 'Booking not found' });
        return;
      }

      // Check if user is part of this booking (driver or user)
      const isDriver = socket.userRole === 'driver' && 
                      booking.driver?.toString() === socket.driverId;
      const isUser = socket.userRole === 'user' && 
                     booking.user?.toString() === socket.userId;

      if (!isDriver && !isUser) {
        socket.emit('negotiation:error', { message: 'Access denied' });
        return;
      }

      socket.join(`negotiation:${bookingId}`);
      console.log(`[Socket] User ${socket.userEmail} joined negotiation room: ${bookingId}`);
      
      socket.emit('negotiation:joined', { bookingId });
    } catch (error) {
      console.error('[Socket] Error joining negotiation room:', error);
      socket.emit('negotiation:error', { message: 'Failed to join negotiation room' });
    }
  });

  // Leave negotiation room
  socket.on('negotiation:leave', (bookingId) => {
    socket.leave(`negotiation:${bookingId}`);
    console.log(`[Socket] User ${socket.userEmail} left negotiation room: ${bookingId}`);
  });

  // Propose price
  socket.on('negotiation:propose_price', async (data) => {
    try {
      const { bookingId, proposedPrice, message } = data;

      if (!bookingId || !proposedPrice) {
        socket.emit('negotiation:propose_error', { message: 'Booking ID and proposed price are required' });
        return;
      }

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        socket.emit('negotiation:propose_error', { message: 'Booking not found' });
        return;
      }

      // Update booking with proposed price
      booking.proposedPrice = Number(proposedPrice);
      booking.negotiationStatus = 'negotiating';
      if (message) {
        booking.negotiationChat = booking.negotiationChat || [];
        booking.negotiationChat.push({
          sender: socket.userId,
          senderRole: socket.userRole,
          message,
          timestamp: new Date(),
        });
      }
      await booking.save();

      // Broadcast to all in negotiation room
      io.to(`negotiation:${bookingId}`).emit('negotiation:price_proposed', {
        bookingId,
        proposedPrice: Number(proposedPrice),
        message,
        sender: socket.userId,
        senderRole: socket.userRole,
        timestamp: new Date(),
      });

      socket.emit('negotiation:propose_success', { bookingId, proposedPrice });
    } catch (error) {
      console.error('[Socket] Error proposing price:', error);
      socket.emit('negotiation:propose_error', { message: 'Failed to propose price' });
    }
  });

  // Send negotiation message
  socket.on('negotiation:send_message', async (data) => {
    try {
      const { bookingId, message } = data;

      if (!bookingId || !message) {
        socket.emit('negotiation:error', { message: 'Booking ID and message are required' });
        return;
      }

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        socket.emit('negotiation:error', { message: 'Booking not found' });
        return;
      }

      // Add message to chat
      booking.negotiationChat = booking.negotiationChat || [];
      booking.negotiationChat.push({
        sender: socket.userId,
        senderRole: socket.userRole,
        message,
        timestamp: new Date(),
      });
      await booking.save();

      // Broadcast to all in negotiation room
      io.to(`negotiation:${bookingId}`).emit('negotiation:message', {
        bookingId,
        message,
        sender: socket.userId,
        senderRole: socket.userRole,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('[Socket] Error sending negotiation message:', error);
      socket.emit('negotiation:error', { message: 'Failed to send message' });
    }
  });
};

