/**
 * Application Constants
 * 
 * Centralized constants to avoid hardcoded values across the codebase
 * 
 * @module utils/constants
 */

/**
 * HTTP Status Codes
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

/**
 * User Roles
 */
const USER_ROLES = {
  USER: "user",
  ADMIN: "admin",
  EXECUTIVE: "executive",
};

/**
 * Driver Types
 */
const DRIVER_TYPES = {
  RENTAL: "rental",
  PROFESSIONAL: "professional",
};

/**
 * Driver Status
 */
const DRIVER_STATUS = {
  AVAILABLE: "available",
  BUSY: "busy",
  OFFLINE: "offline",
  SUSPENDED: "suspended",
};

/**
 * Booking Status
 */
const BOOKING_STATUS = {
  PENDING: "pending",
  PENDING_PAYMENT: "pending_payment",
  CONFIRMED: "confirmed",
  ACTIVE: "active",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  LICENSE_REQUIRED: "license_required",
  VERIFICATION_PENDING: "verification_pending",
};

/**
 * Car Status
 */
const CAR_STATUS = {
  AVAILABLE: "available",
  RENTED: "rented",
  MAINTENANCE: "maintenance",
  UNAVAILABLE: "unavailable",
};

/**
 * Pagination Defaults
 */
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
};

/**
 * Date/Time Formats
 */
const DATE_FORMATS = {
  ISO: "YYYY-MM-DD",
  DATETIME: "YYYY-MM-DD HH:mm",
  TIME: "HH:mm",
  TIME_12H: "h:mm A",
};

/**
 * Timezone
 */
const TIMEZONE = "America/Chicago";

/**
 * Booking Constants
 */
const BOOKING = {
  DEPOSIT_AMOUNT: 150,
  DEFAULT_PICKUP_TIME: "10:00 AM",
  DEFAULT_RETURN_TIME: "10:00 AM",
};

/**
 * Professional Driver Constants
 */
const PROFESSIONAL_DRIVER = {
  HOURLY_RATE: 35,
};

/**
 * Response Messages
 */
const MESSAGES = {
  SUCCESS: {
    CREATED: "Resource created successfully",
    UPDATED: "Resource updated successfully",
    DELETED: "Resource deleted successfully",
    RETRIEVED: "Resource retrieved successfully",
  },
  ERROR: {
    NOT_FOUND: "Resource not found",
    UNAUTHORIZED: "Unauthorized access",
    FORBIDDEN: "Forbidden access",
    VALIDATION_ERROR: "Validation error",
    SERVER_ERROR: "Internal server error",
  },
};

/**
 * Regex Patterns
 */
const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?1?\d{10}$/,
  US_PHONE: /^(1\d{10}|\d{10})$/,
};

module.exports = {
  HTTP_STATUS,
  USER_ROLES,
  DRIVER_TYPES,
  DRIVER_STATUS,
  BOOKING_STATUS,
  CAR_STATUS,
  PAGINATION,
  DATE_FORMATS,
  TIMEZONE,
  BOOKING,
  PROFESSIONAL_DRIVER,
  MESSAGES,
  REGEX,
};

