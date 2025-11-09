/**
 * Utility functions for managing promises and preventing memory leaks
 */

/**
 * Limit concurrency of Promise.all() to prevent memory issues
 * MEMORY OPTIMIZATION: Processes items with controlled concurrency to prevent memory spikes
 * @param {Array} items - Array of items to process
 * @param {Function} fn - Async function to process each item
 * @param {Number} concurrency - Maximum number of concurrent operations (default: 5)
 * @returns {Promise<Array>} - Results array in same order as input
 */
async function promiseAllLimited(items, fn, concurrency = 5) {
  const results = [];
  const executing = [];
  
  for (const item of items) {
    // Create promise and add to executing array
    const promise = Promise.resolve().then(() => fn(item));
    executing.push(promise);
    
    // When promise completes, remove from executing array
    promise.finally(() => {
      const index = executing.indexOf(promise);
      if (index > -1) {
        executing.splice(index, 1);
      }
    });
    
    // If we've reached concurrency limit, wait for one to complete
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
    
    results.push(promise);
  }
  
  // Wait for all remaining promises to complete
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

