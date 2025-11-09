/**
 * Environment Variable Validator
 * Validates all required environment variables at startup
 * Logs missing variables and exits if critical ones are missing
 */

const requiredEnvVars = {
  // Database
  MONGO_URL: "MongoDB connection string",
  MONGO_PASSWORD: "MongoDB password",
  
  // JWT
  JWT_SECRET: "JWT secret key for token signing",
  JWT_EXPIRES_IN: "JWT token expiration time (e.g., '90d')",
  JWT_COOKIE_EXPIRES_IN: "JWT cookie expiration in days (number)",
  
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: "Cloudinary cloud name",
  CLOUDINARY_API_KEY: "Cloudinary API key",
  CLOUDINARY_API_SECRET: "Cloudinary API secret",
  
  // Stripe
  STRIPE_SECRET_KEY: "Stripe secret key",
  STRIPE_WEBHOOK_SECRET: "Stripe webhook signing secret",
  
  // Email (SendGrid)
  SENDGRID_API_KEY: "SendGrid API key for email sending",
};

const optionalEnvVars = {
  NODE_ENV: "Node environment (development/production)",
  PORT: "Server port (default: 3001)",
  HOST: "Server host (default: 0.0.0.0)",
  CLIENT_URL: "Frontend client URL",
  MACHINE_IP: "Machine IP address for development",
  FORCE_LOCALHOST: "Force localhost in development",
};

function validateEnv() {
  const missing = [];
  const warnings = [];
  
  // Check required variables
  for (const [key, description] of Object.entries(requiredEnvVars)) {
    if (!process.env[key]) {
      missing.push({ key, description });
    }
  }
  
  // Check optional but recommended variables
  for (const [key, description] of Object.entries(optionalEnvVars)) {
    if (!process.env[key] && key === "NODE_ENV") {
      warnings.push({ key, description, note: "Defaulting to 'development'" });
    }
  }
  
  // Validate JWT_COOKIE_EXPIRES_IN is a number
  if (process.env.JWT_COOKIE_EXPIRES_IN) {
    const expiresIn = parseInt(process.env.JWT_COOKIE_EXPIRES_IN, 10);
    if (isNaN(expiresIn) || expiresIn <= 0) {
      warnings.push({
        key: "JWT_COOKIE_EXPIRES_IN",
        description: "Must be a positive number",
        note: `Current value: ${process.env.JWT_COOKIE_EXPIRES_IN}`,
      });
    }
  }
  
  // Validate NODE_ENV
  if (process.env.NODE_ENV && !["development", "production", "test"].includes(process.env.NODE_ENV)) {
    warnings.push({
      key: "NODE_ENV",
      description: "Should be 'development', 'production', or 'test'",
      note: `Current value: ${process.env.NODE_ENV}`,
    });
  }
  
  // Log results
  if (missing.length > 0) {
    console.error("\n❌ MISSING REQUIRED ENVIRONMENT VARIABLES:");
    missing.forEach(({ key, description }) => {
      console.error(`   - ${key}: ${description}`);
    });
    console.error("\n⚠️  Please set these variables in your config.env file\n");
    
    // In production, exit if critical vars are missing
    if (process.env.NODE_ENV === "production") {
      console.error("❌ Exiting due to missing required environment variables in production mode.");
      process.exit(1);
    } else {
      console.warn("⚠️  Continuing in development mode, but some features may not work.");
    }
  }
  
  if (warnings.length > 0) {
    console.warn("\n⚠️  ENVIRONMENT VARIABLE WARNINGS:");
    warnings.forEach(({ key, description, note }) => {
      console.warn(`   - ${key}: ${description}`);
      if (note) console.warn(`     ${note}`);
    });
    console.warn("");
  }
  
  if (missing.length === 0 && warnings.length === 0) {
    console.log("✅ All environment variables validated successfully\n");
  }
  
  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

module.exports = { validateEnv, requiredEnvVars, optionalEnvVars };

