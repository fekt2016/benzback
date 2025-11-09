/**
 * Response Handler Utility
 * 
 * Provides standardized API response formatting
 * Ensures consistent response structure across all controllers
 * 
 * @module utils/responseHandler
 */

/**
 * Send success response with data
 * 
 * @param {Object} res - Express response object
 * @param {number} [statusCode=200] - HTTP status code
 * @param {*} data - Response data
 * @param {string} [message] - Optional success message
 * @param {Object} [meta] - Optional metadata (pagination, etc.)
 * @returns {Object} - Express response
 * 
 * @example
 * sendSuccess(res, 200, user, "User retrieved successfully");
 * sendSuccess(res, 200, users, null, { total, page, limit });
 */
function sendSuccess(res, statusCode = 200, data, message = null, meta = null) {
  const response = {
    status: "success",
    ...(data !== undefined && { data }),
    ...(message && { message }),
    ...(meta && meta),
  };

  return res.status(statusCode).json(response);
}

/**
 * Send paginated success response
 * 
 * @param {Object} res - Express response object
 * @param {*} data - Response data array
 * @param {Object} pagination - Pagination metadata
 * @param {number} pagination.total - Total number of items
 * @param {number} pagination.page - Current page
 * @param {number} pagination.limit - Items per page
 * @param {number} pagination.totalPages - Total pages
 * @param {number} pagination.results - Items in current page
 * @returns {Object} - Express response
 * 
 * @example
 * sendPaginatedSuccess(res, items, { total, page, limit, totalPages, results });
 */
function sendPaginatedSuccess(res, data, pagination) {
  return res.status(200).json({
    status: "success",
    results: pagination.results,
    total: pagination.total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: pagination.totalPages,
    data,
  });
}

/**
 * Send created response (201)
 * 
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} [message] - Success message
 * @returns {Object} - Express response
 * 
 * @example
 * sendCreated(res, newUser, "User created successfully");
 */
function sendCreated(res, data, message = "Resource created successfully") {
  return res.status(201).json({
    status: "success",
    message,
    data,
  });
}

/**
 * Send no content response (204)
 * 
 * @param {Object} res - Express response object
 * @returns {Object} - Express response
 * 
 * @example
 * sendNoContent(res);
 */
function sendNoContent(res) {
  return res.status(204).send();
}

/**
 * Send deleted response (200)
 * 
 * @param {Object} res - Express response object
 * @param {string} [message] - Success message
 * @returns {Object} - Express response
 * 
 * @example
 * sendDeleted(res, "Resource deleted successfully");
 */
function sendDeleted(res, message = "Resource deleted successfully") {
  return res.status(200).json({
    status: "success",
    message,
  });
}

module.exports = {
  sendSuccess,
  sendPaginatedSuccess,
  sendCreated,
  sendNoContent,
  sendDeleted,
};

