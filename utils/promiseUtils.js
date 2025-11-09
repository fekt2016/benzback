/**
 * Utility functions for managing promises and preventing memory leaks
 */

/**
 * Limit concurrency of Promise.all() to prevent memory issues
 * @param {Array} items - Array of items to process
 * @param {Function} fn - Async function to process each item
 * @param {Number} concurrency - Maximum number of concurrent operations (default: 5)
 * @returns {Promise<Array>} - Results array in same order as input
 */
async function promiseAllLimited(items, fn, concurrency = 5) {
  const results = [];
  const executing = [];
  
  for (const item of items) {
    const promise = Promise.resolve().then(() => fn(item));
    results.push(promise);
    
    if (items.length >= concurrency) {
      const e = promise.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }
  
  return Promise.all(results);
}

/**
 * Process items in batches to prevent memory overload
 * @param {Array} items - Array of items to process
 * @param {Function} fn - Async function to process each item
 * @param {Number} batchSize - Number of items per batch (default: 10)
 * @returns {Promise<Array>} - Results array in same order as input
 */
async function processInBatches(items, fn, batchSize = 10) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Use Promise.allSettled() instead of Promise.all() to prevent one failure from stopping all
 * @param {Array} promises - Array of promises
 * @returns {Promise<Array>} - Array of {status, value/reason} objects
 */
async function allSettled(promises) {
  return Promise.allSettled(promises);
}

module.exports = {
  promiseAllLimited,
  processInBatches,
  allSettled,
};

