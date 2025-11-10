/**
 * Universal Pagination Query Helper
 * 
 * Provides a simple, reusable function for paginating MongoDB queries
 * Ensures all list endpoints use consistent pagination with memory optimization
 * 
 * @module utils/paginateQuery
 */

/**
 * Execute a paginated query with automatic count
 * 
 * @param {Object} Model - Mongoose model
 * @param {Object} filter - MongoDB filter object
 * @param {Object} req - Express request object (for query params)
 * @param {Object} [options] - Additional options
 * @param {Object} [options.queryModifier] - Function to modify the query (e.g., .populate(), .sort())
 * @param {Object} [options.countModifier] - Function to modify the count query
 * @param {number} [options.defaultLimit=20] - Default items per page
 * @param {number} [options.maxLimit=100] - Maximum items per page
 * @returns {Promise<Object>} - { data, pagination: { total, page, limit, totalPages, results } }
 * 
 * @example
 * const { data, pagination } = await paginateQuery(Car, {}, req);
 * res.status(200).json({ status: "success", ...pagination, data });
 * 
 * @example
 * const { data, pagination } = await paginateQuery(
 *   Booking,
 *   { status: "confirmed" },
 *   req,
 *   {
 *     queryModifier: (query) => query.populate("user", "fullName email").sort("-createdAt")
 *   }
 * );
 */
async function paginateQuery(Model, filter, req, options = {}) {
  const {
    queryModifier,
    countModifier,
    defaultLimit = 20,
    maxLimit = 100,
  } = options;

  // Parse pagination parameters
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || defaultLimit, maxLimit);
  const skip = (page - 1) * limit;

  // Build base query
  let query = Model.find(filter);

  // Apply query modifications (populate, sort, select, etc.)
  if (queryModifier && typeof queryModifier === 'function') {
    query = queryModifier(query);
  }

  // Build count query
  let countQuery = Model.countDocuments(filter);
  if (countModifier && typeof countModifier === 'function') {
    countQuery = countModifier(countQuery);
  }

  // Execute paginated query and count in parallel
  // Always use .lean() for memory efficiency
  const [data, total] = await Promise.all([
    query.skip(skip).limit(limit).lean(),
    countQuery,
  ]);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      results: data.length,
    },
  };
}

module.exports = paginateQuery;

