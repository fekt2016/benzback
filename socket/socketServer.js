// Socket.io Server Setup
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Driver = require('../models/driverModel');
const TokenBlacklist = require('../models/TokenBlacklistModel');

/**
 * Initialize Socket.io server with authentication
 * @param {http.Server} server - Express HTTP server
 * @returns {Server} - Socket.io server instance
 */
function initializeSocket(server) {
  // Get CORS origin from environment or use default
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://localhost:19006', 'exp://192.168.*.*:*'];

  const io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Postman, or React Native)
        // React Native apps often don't send an origin header
        if (!origin) {
          console.log('[Socket] ✅ Allowing connection with no origin (mobile app)');
          return callback(null, true);
        }
        
        console.log('[Socket] 🔍 Checking origin:', origin);
        
        // Check if origin matches allowed origins
        const isAllowed = allowedOrigins.some(allowed => {
          if (allowed.includes('*')) {
            // Handle wildcard patterns like 'exp://192.168.*.*:*'
            const pattern = allowed.replace(/\*/g, '.*');
            const regex = new RegExp(`^${pattern}$`);
            const matches = regex.test(origin);
            if (matches) {
              console.log(`[Socket] ✅ Origin matches wildcard pattern: ${allowed}`);
            }
            return matches;
          }
          const exactMatch = origin === allowed;
          if (exactMatch) {
            console.log(`[Socket] ✅ Origin matches exactly: ${allowed}`);
          }
          return exactMatch;
        });

        if (isAllowed) {
          callback(null, true);
        } else {
          console.warn(`[Socket] ❌ CORS blocked origin: ${origin}`);
          console.warn(`[Socket] Allowed origins:`, allowedOrigins);
          // In development, allow all origins for easier debugging
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[Socket] ⚠️  Development mode: Allowing blocked origin anyway`);
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true, // Allow Engine.IO v3 clients
  });

  // Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || 
                   socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        console.log('[Socket] No token provided');
        return next(new Error('Authentication error: No token provided'));
      }

      // Check if token is blacklisted
      const isBlacklisted = await TokenBlacklist.isTokenBlacklisted(token);
      if (isBlacklisted) {
        console.log('[Socket] Token is blacklisted');
        return next(new Error('Authentication error: Token has been revoked'));
      }

      // Verify JWT token
      if (!process.env.JWT_SECRET) {
        console.error('[Socket] JWT_SECRET is not defined');
        return next(new Error('Server configuration error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from database
      const user = await User.findById(decoded.id).lean();
      if (!user) {
        console.log('[Socket] User not found:', decoded.id);
        return next(new Error('Authentication error: User not found'));
      }

      // Attach user info to socket
      socket.userId = user._id.toString();
      socket.userRole = user.role || 'user';
      socket.userEmail = user.email;

      // If user is a driver, get driver profile
      if (socket.userRole === 'driver') {
        const driver = await Driver.findOne({ user: user._id, driverType: 'professional' }).lean();
        if (driver) {
          socket.driverId = driver._id.toString();
          // Update driver's socket ID and location
          await Driver.findByIdAndUpdate(driver._id, {
            'location.socketId': socket.id,
            lastActiveAt: new Date(),
          });
        }
      }

      console.log(`[Socket] ✅ Authenticated: ${user.email} (${socket.userRole})`);
      next();
    } catch (error) {
      console.error('[Socket] Authentication error:', error.message);
      if (error.name === 'JsonWebTokenError') {
        return next(new Error('Authentication error: Invalid token'));
      }
      if (error.name === 'TokenExpiredError') {
        return next(new Error('Authentication error: Token expired'));
      }
      next(new Error('Authentication error: ' + error.message));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`[Socket] 🔌 Client connected: ${socket.id} (${socket.userEmail})`);

    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      console.log(`[Socket] 🔌 Client disconnected: ${socket.id} (${reason})`);
      
      // Update driver status if driver
      if (socket.driverId) {
        try {
          await Driver.findByIdAndUpdate(socket.driverId, {
            'location.socketId': null,
            isOnline: false,
            currentStatus: 'offline',
          });
        } catch (error) {
          console.error('[Socket] Error updating driver status on disconnect:', error);
        }
      }
    });

    // Handle negotiation events
    require('./negotiationSocketHandler')(io, socket);
    
    // Handle driver location events
    require('./driverSocketHandler')(io, socket);
  });

  console.log('[Socket] ✅ Socket.io server initialized');
  return io;
}

module.exports = { initializeSocket };

