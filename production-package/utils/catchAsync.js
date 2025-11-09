
const { MemoryMonitor } = require("./memoryMonitor");

exports.catchAsync =  (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      const timestamp = new Date().toISOString();
      const method = req.method;
      const path = req.originalUrl || req.path;
      const functionName = fn.name || 'anonymous';
      
      console.error(`\n[${timestamp}] ❌ ========== catchAsync ERROR ==========`);
      console.error(`[${timestamp}] ❌ Function: ${functionName}`);
      console.error(`[${timestamp}] ❌ Method: ${method}`);
      console.error(`[${timestamp}] ❌ Path: ${path}`);
      console.error(`[${timestamp}] ❌ Error Message: ${err.message || 'Unknown error'}`);
      console.error(`[${timestamp}] ❌ Error Name: ${err.name || 'Error'}`);
      console.error(`[${timestamp}] ❌ Error Stack:\n${err.stack || 'No stack trace'}`);
      console.error(`[${timestamp}] ❌ ===========================================\n`);
      
      next(err);
    });
  };
};


exports.catchAsyncWithMemory = (labelOrFn, maybeFn) => {
  // Determine if first argument is the label or the function
  let label, fn;

  if (typeof labelOrFn === "function") {
    // Called as catchAsync(fn)
    fn = labelOrFn;
    label = fn.name || "unnamed";
  } else if (typeof maybeFn === "function") {
    // Called as catchAsync("label", fn)
    label = labelOrFn;
    fn = maybeFn;
  } else {
    throw new Error("catchAsync requires at least a function as argument");
  }

  // Return the Express middleware
  return (req, res, next) => {
    const memory = new MemoryMonitor(label);

    Promise.resolve(fn(req, res, next))
      .then(() => memory.complete())
      .catch((err) => {
        const timestamp = new Date().toISOString();
        const method = req.method;
        const path = req.originalUrl || req.path;
        
        console.error(`\n[${timestamp}] ❌ ========== catchAsyncWithMemory ERROR ==========`);
        console.error(`[${timestamp}] ❌ Label: ${label}`);
        console.error(`[${timestamp}] ❌ Method: ${method}`);
        console.error(`[${timestamp}] ❌ Path: ${path}`);
        console.error(`[${timestamp}] ❌ Error Message: ${err.message || 'Unknown error'}`);
        console.error(`[${timestamp}] ❌ Error Name: ${err.name || 'Error'}`);
        console.error(`[${timestamp}] ❌ Error Stack:\n${err.stack || 'No stack trace'}`);
        console.error(`[${timestamp}] ❌ ===========================================\n`);
        
        memory.error("Unexpected error");
        next(err);
      });
  };
};
