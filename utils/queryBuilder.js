/**
 * Query Builder Utility
 * 
 * Provides reusable MongoDB query building patterns
 * Reduces duplicate filter logic across controllers
 * 
 * @module utils/queryBuilder
 */

/**
 * Build text search filter with multiple fields
 * 
 * @param {string} searchTerm - Search term
 * @param {string[]} fields - Fields to search in
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.caseSensitive=false] - Case sensitive search
 * @returns {Object} - MongoDB $or filter
 * 
 * @example
 * const filter = buildTextSearch("john", ["fullName", "email", "phone"]);
 * // Returns: { $or: [
 * //   { fullName: { $regex: "john", $options: "i" } },
 * //   { email: { $regex: "john", $options: "i" } },
 * //   { phone: { $regex: "john", $options: "i" } }
 * // ]}
 */
function buildTextSearch(searchTerm, fields, options = {}) {
  if (!searchTerm || !fields || fields.length === 0) {
    return {};
  }

  const regexOptions = options.caseSensitive ? "" : "i";
  const searchRegex = { $regex: searchTerm, $options: regexOptions };

  return {
    $or: fields.map((field) => ({ [field]: searchRegex })),
  };
}

/**
 * Build date range filter
 * 
 * @param {string|Date} [startDate] - Start date
 * @param {string|Date} [endDate] - End date
 * @param {string} [field="createdAt"] - Field name to filter
 * @returns {Object} - MongoDB date range filter
 * 
 * @example
 * const filter = buildDateRange("2024-01-01", "2024-12-31", "pickupDate");
 * // Returns: { pickupDate: { $gte: new Date("2024-01-01"), $lte: new Date("2024-12-31") } }
 */
function buildDateRange(startDate, endDate, field = "createdAt") {
  const filter = {};

  if (startDate || endDate) {
    filter[field] = {};
    if (startDate) {
      filter[field].$gte = new Date(startDate);
    }
    if (endDate) {
      filter[field].$lte = new Date(endDate);
    }
  }

  return filter;
}

/**
 * Build numeric range filter
 * 
 * @param {number|string} [min] - Minimum value
 * @param {number|string} [max] - Maximum value
 * @param {string} field - Field name to filter
 * @returns {Object} - MongoDB numeric range filter
 * 
 * @example
 * const filter = buildNumericRange(100, 500, "pricePerDay");
 * // Returns: { pricePerDay: { $gte: 100, $lte: 500 } }
 */
function buildNumericRange(min, max, field) {
  const filter = {};

  if (min !== undefined || max !== undefined) {
    filter[field] = {};
    if (min !== undefined) {
      filter[field].$gte = Number(min);
    }
    if (max !== undefined) {
      filter[field].$lte = Number(max);
    }
  }

  return filter;
}

/**
 * Build status filter
 * 
 * @param {string|string[]} status - Status value(s)
 * @param {string} [field="status"] - Field name
 * @returns {Object} - MongoDB status filter
 * 
 * @example
 * const filter = buildStatusFilter("active", "status");
 * // Returns: { status: "active" }
 * 
 * const filter = buildStatusFilter(["active", "pending"], "status");
 * // Returns: { status: { $in: ["active", "pending"] } }
 */
function buildStatusFilter(status, field = "status") {
  if (!status) return {};

  if (Array.isArray(status) || (typeof status === "string" && status.includes(","))) {
    const statusArray = Array.isArray(status)
      ? status
      : status.split(",").map((s) => s.trim());
    return { [field]: { $in: statusArray } };
  }

  return { [field]: status };
}

/**
 * Build boolean filter
 * 
 * @param {boolean|string} value - Boolean value or string ("true"/"false")
 * @param {string} field - Field name
 * @returns {Object} - MongoDB boolean filter
 * 
 * @example
 * const filter = buildBooleanFilter("true", "verified");
 * // Returns: { verified: true }
 */
function buildBooleanFilter(value, field) {
  if (value === undefined || value === null) return {};

  const boolValue =
    typeof value === "string"
      ? value.toLowerCase() === "true"
      : Boolean(value);

  return { [field]: boolValue };
}

/**
 * Merge multiple filter objects
 * 
 * @param {...Object} filters - Filter objects to merge
 * @returns {Object} - Merged filter
 * 
 * @example
 * const filter = mergeFilters(
 *   { status: "active" },
 *   buildTextSearch("john", ["name", "email"]),
 *   buildDateRange("2024-01-01", "2024-12-31")
 * );
 */
function mergeFilters(...filters) {
  return Object.assign({}, ...filters.filter((f) => f && Object.keys(f).length > 0));
}

module.exports = {
  buildTextSearch,
  buildDateRange,
  buildNumericRange,
  buildStatusFilter,
  buildBooleanFilter,
  mergeFilters,
};

