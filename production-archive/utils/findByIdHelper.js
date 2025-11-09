/**
 * Find By ID Helper Utility
 * 
 * Provides reusable pattern for finding documents by ID
 * Reduces duplicate "findById + not found check" logic
 * 
 * @module utils/findByIdHelper
 */

const AppError = require("./appError");

/**
 * Find document by ID with optional not found error
 * 
 * @param {Object} Model - Mongoose model
 * @param {string} id - Document ID
 * @param {Object} [options] - Options
 * @param {string} [options.select] - Fields to select (e.g., "-password")
 * @param {string|Array} [options.populate] - Populate options
 * @param {boolean} [options.lean=false] - Use lean() for memory efficiency
 * @param {string} [options.notFoundMessage] - Custom not found message
 * @param {number} [options.notFoundStatusCode=404] - Not found status code
 * @returns {Promise<Object>} - Document or throws AppError if not found
 * 
 * @example
 * // Basic usage
 * const car = await findByIdOrFail(Car, req.params.id);
 * 
 * @example
 * // With select and populate
 * const user = await findByIdOrFail(User, req.params.id, {
 *   select: "-password",
 *   populate: { path: "bookings", select: "pickupDate returnDate" }
 * });
 * 
 * @example
 * // With lean for memory efficiency
 * const car = await findByIdOrFail(Car, req.params.id, {
 *   lean: true,
 *   notFoundMessage: "Car not found"
 * });
 */
async function findByIdOrFail(
  Model,
  id,
  options = {}
) {
  const {
    select,
    populate,
    lean = false,
    notFoundMessage = null,
    notFoundStatusCode = 404,
  } = options;

  let query = Model.findById(id);

  if (select) {
    query = query.select(select);
  }

  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach((pop) => {
        query = query.populate(pop);
      });
    } else if (typeof populate === "object") {
      query = query.populate(populate);
    } else {
      query = query.populate(populate);
    }
  }

  if (lean) {
    query = query.lean();
  }

  const doc = await query;

  if (!doc) {
    const modelName = Model.modelName || "Resource";
    const message = notFoundMessage || `${modelName} not found`;
    throw new AppError(message, notFoundStatusCode);
  }

  return doc;
}

/**
 * Find document by ID with custom query conditions
 * 
 * @param {Object} Model - Mongoose model
 * @param {string} id - Document ID
 * @param {Object} conditions - Additional query conditions
 * @param {Object} [options] - Options (same as findByIdOrFail)
 * @returns {Promise<Object>} - Document or throws AppError if not found
 * 
 * @example
 * // Find professional driver by ID
 * const driver = await findByIdWithConditions(Driver, req.params.id, {
 *   driverType: "professional"
 * });
 */
async function findByIdWithConditions(
  Model,
  id,
  conditions = {},
  options = {}
) {
  const {
    select,
    populate,
    lean = false,
    notFoundMessage = null,
    notFoundStatusCode = 404,
  } = options;

  let query = Model.findOne({ _id: id, ...conditions });

  if (select) {
    query = query.select(select);
  }

  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach((pop) => {
        query = query.populate(pop);
      });
    } else if (typeof populate === "object") {
      query = query.populate(populate);
    } else {
      query = query.populate(populate);
    }
  }

  if (lean) {
    query = query.lean();
  }

  const doc = await query;

  if (!doc) {
    const modelName = Model.modelName || "Resource";
    const message = notFoundMessage || `${modelName} not found`;
    throw new AppError(message, notFoundStatusCode);
  }

  return doc;
}

module.exports = {
  findByIdOrFail,
  findByIdWithConditions,
};

