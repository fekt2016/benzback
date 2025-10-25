// utils/memoryMonitor.js
import chalk from "chalk";

export class MemoryMonitor {
  constructor(label) {
    this.label = label;
    this.start = Date.now();
    this.startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    this.lastCheckpoint = this.start;
  }

  checkpoint(name) {
    const now = Date.now();
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    const elapsed = now - this.lastCheckpoint;
    this.lastCheckpoint = now;

    console.log(
      chalk.cyan(
        `🧠 [${this.label}] ${name.padEnd(25)} ${used.toFixed(
          2
        )}MB (+${elapsed}ms)`
      )
    );
  }

  complete() {
    const totalTime = Date.now() - this.start;
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    const delta = endMemory - this.startMemory;

    // Define leak threshold (MB)
    const leakThreshold = 5;
    const leakDetected = delta > leakThreshold;

    const color = leakDetected ? chalk.red : chalk.green;

    console.log(
      color(
        `✅ [${this.label}] COMPLETED: ${delta >= 0 ? "+" : ""}${delta.toFixed(
          2
        )}MB (${endMemory.toFixed(
          2
        )}MB total) in ${totalTime}ms | Leak detected: ${
          leakDetected ? "🔴 true" : "🟢 false"
        }`
      )
    );

    return { totalTime, endMemory, delta, leakDetected };
  }

  error(stage, err) {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.error(
      chalk.red(
        `❌ [${this.label}] Error at ${stage}: ${used.toFixed(2)}MB\n${err}`
      )
    );
  }
}

/**
 * Wraps an async route handler with memory/time tracking and leak detection.
 * Example:
 * exports.login = withMemoryMonitor("login", async (req, res, next) => {...});
 */
export const withMemoryMonitor = (label, handler) => {
  return async (req, res, next) => {
    const start = process.memoryUsage().heapUsed / 1024 / 1024;
    const startTime = Date.now();

    try {
      await handler(req, res, next);
    } finally {
      const end = process.memoryUsage().heapUsed / 1024 / 1024;
      const duration = Date.now() - startTime;
      const delta = end - start;
      const leakThreshold = 5;
      const leakDetected = delta > leakThreshold;

      const color = leakDetected ? chalk.red : chalk.green;

      console.log(
        color(
          `🧠 [${label}] COMPLETED: ${delta >= 0 ? "+" : ""}${delta.toFixed(
            2
          )}MB (${end.toFixed(2)}MB total) in ${duration}ms | Leak detected: ${
            leakDetected ? "🔴 true" : "🟢 false"
          }`
        )
      );
    }
  };
};
