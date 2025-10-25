
const { MemoryMonitor } = require("./memoryMonitor");

exports.catchAsync =  (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => next(err));
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
        memory.error("Unexpected error");
        next(err);
      });
  };
};
