/**
 * Pagination Helper Utility
 * 
 * Provides reusable pagination logic for MongoDB queries
 * Used across multiple controllers to reduce code duplication
 * 
 * @module utils/paginationHelper
 */

/**
 * Parse and validate pagination parameters from request query
 * 
 * @param {Object} query - Request query object
 * @param {number|string} [query.page=1] - Page number (1-indexed)
 * @param {number|string} [query.limit=50] - Items per page
 * @param {number} [maxLimit=100] - Maximum allowed limit
 * @returns {Object} - { skip, limit, page } - Pagination parameters
 * 
 * @example
 * const { skip, limit, page } = parsePagination(req.query);
 * const [items, total] = await Promise.all([
 *   Model.find(filter).skip(skip).limit(limit).lean(),
 *   Model.countDocuments(filter)
 * ]);
 */
function parsePagination(query, maxLimit = 100) {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 50, maxLimit);
  const skip = (page - 1) * limit;

  return { skip, limit, page };
}

/**
 * Calculate pagination metadata
 * 
 * @param {number} total - Total number of items
 * @param {number} limit - Items per page
 * @param {number} page - Current page number
 * @param {number} results - Number of items in current page
 * @returns {Object} - Pagination metadata
 * 
 * @example
 * const pagination = calculatePaginationMeta(total, limit, page, items.length);
 * // Returns: { total, page, limit, totalPages, results }
 */
function calculatePaginationMeta(total, limit, page, results) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results,
  };
}

/**
 * Execute paginated query with count
 * 
 * @param {Object} options - Query options
 * @param {Function} options.query - Mongoose query (already built with filters)
 * @param {Function} options.countQuery - Mongoose count query (Model.countDocuments(filter))
 * @param {number} options.skip - Number of items to skip
 * @param {number} options.limit - Number of items per page
 * @param {boolean} [options.lean=true] - Use lean() for memory efficiency
 * @returns {Promise<Array>} - [items, total] tuple
 * 
 * @example
 * const [items, total] = await executePaginatedQuery({
 *   query: Model.find(filter).sort(sort),
 *   countQuery: Model.countDocuments(filter),
 *   skip,
 *   limit,
 *   lean: true
 * });
 */
async function executePaginatedQuery({ query, countQuery, skip, limit, lean = true }) {
  const queryWithPagination = query.skip(skip).limit(limit);
  if (lean) {
    queryWithPagination.lean();
  }

  const [items, total] = await Promise.all([
    queryWithPagination,
    countQuery,
  ]);

  return [items, total];
}

module.exports = {
  parsePagination,
  calculatePaginationMeta,
  executePaginatedQuery,
};

