// services/helper.js
const os = require("os");

/* -------------------------------------------------------------------------- */
/* 🧩 PHONE HELPERS                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Validate a US phone number.
 * Supports:
 *  - 10 digits (e.g., 4155551234)
 *  - 11 digits starting with 1 (e.g., 14155551234)
 */
function validateUSPhone(phone) {
  if (!phone) return false;

  const cleaned = phone.replace(/\D/g, ""); // remove all non-digits
  const usRegex = /^(1\d{10}|\d{10})$/;
  return usRegex.test(cleaned);
}

/**
 * Normalize a US phone number into international E.164 format (+1xxxxxxxxxx)
 */
function normalizeUSPhone(phone) {
  if (!validateUSPhone(phone)) return null;
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) cleaned = "1" + cleaned;
  return `+${cleaned}`;
}

/* -------------------------------------------------------------------------- */
/* 🌐 FRONTEND URL HELPERS                                                    */
/* -------------------------------------------------------------------------- */

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}


/**
 * Dynamically determine the correct frontend URL.
 * Works for:
 *  - Development (localhost for web, LAN IP for mobile)
 *  - Production (same domain for all)
 */
function getFrontendUrl() {
  const env = process.env.NODE_ENV || "development";
  const explicit = process.env.CLIENT_URL;
  const machineIp = process.env.MACHINE_IP || getLocalIp();
  

  const forceLocalhost = process.env.FORCE_LOCALHOST === "true";

  console.log("🌍 [getFrontendUrl] Environment:", env);
  console.log("🌍 [getFrontendUrl] Explicit CLIENT_URL:", explicit);
  console.log("🌍 [getFrontendUrl] Local IP:", machineIp);
  console.log("🌍 [getFrontendUrl] FORCE_LOCALHOST:", forceLocalhost);

  // 1️⃣ Production - always use production URL
  if (env === "production") {
    console.log("✅ Using production URL: https://benzflex.com");
    return "https://benzflex.com";
  }

  // 2️⃣ Development - FORCE_LOCALHOST takes precedence over CLIENT_URL
  if (env === "development") {
    if (forceLocalhost) {
      console.log("✅ FORCE_LOCALHOST=true, using: http://localhost:5173");
      return "http://localhost:5173";
    }
    
    // If explicit CLIENT_URL is set and not forcing localhost, use it
    if (explicit) {
      console.log("✅ Using explicit CLIENT_URL:", explicit);
      return explicit;
    }
    
    // Otherwise use machine IP
    const url = `http://${machineIp}:5173`;
    console.log("✅ Using machine IP URL:", url);
    return url;
  }

  // 3️⃣ Safety fallback
  console.log("⚠️ Using fallback URL: https://benzflex.com");
  return "https://benzflex.com";
}


module.exports = {
  validateUSPhone,
  normalizeUSPhone,
  getFrontendUrl,
};
