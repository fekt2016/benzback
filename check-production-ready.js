#!/usr/bin/env node
/**
 * Production Readiness Check
 * 
 * This script verifies that all critical components are working
 * before deployment to production.
 */

console.log("🔍 Production Readiness Check");
console.log("==============================\n");

let errors = [];
let warnings = [];

// 1. Check p-limit import
console.log("1️⃣ Checking p-limit import...");
try {
  const pLimitModule = require("p-limit");
  const pLimit = pLimitModule.default || pLimitModule;
  const limit = pLimit(3);
  if (typeof limit === "function") {
    console.log("   ✅ p-limit imports correctly\n");
  } else {
    errors.push("p-limit is not a function");
    console.log("   ❌ p-limit import failed\n");
  }
} catch (e) {
  errors.push(`p-limit import error: ${e.message}`);
  console.log(`   ❌ p-limit import error: ${e.message}\n`);
}

// 2. Check singleton services
console.log("2️⃣ Checking singleton services...");
try {
  const stripeClient = require("./services/stripeClient.js");
  if (typeof stripeClient.getStripe === "function") {
    console.log("   ✅ Stripe client singleton");
  } else {
    errors.push("Stripe client getStripe is not a function");
    console.log("   ❌ Stripe client issue");
  }
} catch (e) {
  errors.push(`Stripe client error: ${e.message}`);
  console.log(`   ❌ Stripe client error: ${e.message}`);
}

try {
  const cloudinaryClient = require("./services/cloudinaryClient.js");
  if (typeof cloudinaryClient.getCloudinary === "function") {
    console.log("   ✅ Cloudinary client singleton");
  } else {
    errors.push("Cloudinary client getCloudinary is not a function");
    console.log("   ❌ Cloudinary client issue");
  }
} catch (e) {
  errors.push(`Cloudinary client error: ${e.message}`);
  console.log(`   ❌ Cloudinary client error: ${e.message}`);
}

try {
  const sendGridClient = require("./services/sendGridClient.js");
  if (typeof sendGridClient.getSendGrid === "function") {
    console.log("   ✅ SendGrid client singleton");
  } else {
    errors.push("SendGrid client getSendGrid is not a function");
    console.log("   ❌ SendGrid client issue");
  }
} catch (e) {
  errors.push(`SendGrid client error: ${e.message}`);
  console.log(`   ❌ SendGrid client error: ${e.message}`);
}
console.log("");

// 3. Check middleware
console.log("3️⃣ Checking middleware...");
try {
  require("./middleware/bookingUpload.js");
  console.log("   ✅ bookingUpload.js loads\n");
} catch (e) {
  errors.push(`bookingUpload.js error: ${e.message}`);
  console.log(`   ❌ bookingUpload.js error: ${e.message}\n`);
}

// 4. Check controllers
console.log("4️⃣ Checking controllers...");
try {
  require("./controllers/paymentController.js");
  console.log("   ✅ paymentController.js loads");
} catch (e) {
  errors.push(`paymentController.js error: ${e.message}`);
  console.log(`   ❌ paymentController.js error: ${e.message}`);
}

try {
  require("./controllers/webhookController.js");
  console.log("   ✅ webhookController.js loads");
} catch (e) {
  errors.push(`webhookController.js error: ${e.message}`);
  console.log(`   ❌ webhookController.js error: ${e.message}`);
}
console.log("");

// 5. Check app.js
console.log("5️⃣ Checking app.js...");
try {
  require("./app.js");
  console.log("   ✅ app.js loads successfully\n");
} catch (e) {
  errors.push(`app.js error: ${e.message}`);
  console.log(`   ❌ app.js error: ${e.message}\n`);
}

// 6. Check package.json
console.log("6️⃣ Checking dependencies...");
const packageJson = require("./package.json");
const requiredDeps = ["p-limit", "stripe", "cloudinary", "@sendgrid/mail"];
requiredDeps.forEach((dep) => {
  if (packageJson.dependencies[dep]) {
    console.log(`   ✅ ${dep} in package.json`);
  } else {
    errors.push(`${dep} missing from package.json`);
    console.log(`   ❌ ${dep} missing from package.json`);
  }
});
console.log("");

// Summary
console.log("==============================\n");
if (errors.length === 0) {
  console.log("✅ All checks passed! Ready for production deployment.");
  process.exit(0);
} else {
  console.log(`❌ Found ${errors.length} error(s):`);
  errors.forEach((err, i) => {
    console.log(`   ${i + 1}. ${err}`);
  });
  console.log("\n⚠️  Please fix these errors before deploying.");
  process.exit(1);
}

