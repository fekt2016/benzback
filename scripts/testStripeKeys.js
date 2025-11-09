require("dotenv").config({ path: "./config.env" });
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

async function testStripeKeys() {
  console.log("🔍 Testing Stripe Key Configuration...\n");

  // Check backend secret key
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error("❌ STRIPE_SECRET_KEY is not set in backend/config.env");
    process.exit(1);
  }

  const secretKeyPrefix = secretKey.substring(0, 7);
  const secretKeyType = secretKeyPrefix === "sk_test" ? "TEST" : secretKeyPrefix === "sk_live" ? "LIVE" : "UNKNOWN";
  console.log(`📦 Backend Secret Key:`);
  console.log(`   Type: ${secretKeyType}`);
  console.log(`   Prefix: ${secretKey.substring(0, 12)}...`);
  console.log(`   Full Key: ${secretKey}\n`);

  // Test backend connection
  try {
    console.log("🔄 Testing backend connection to Stripe...");
    const account = await stripe.account.retrieve();
    console.log(`✅ Backend connection successful!`);
    console.log(`   Account ID: ${account.id}`);
    console.log(`   Account Type: ${account.type}`);
    console.log(`   Country: ${account.country}`);
    console.log(`   Email: ${account.email || "N/A"}\n`);
  } catch (error) {
    console.error(`❌ Backend connection failed:`, error.message);
    console.error(`   Error Type: ${error.type}`);
    process.exit(1);
  }

  // Instructions for frontend
  console.log("📋 Frontend Configuration:");
  console.log(`   ✅ The frontend should use: VITE_STRIPE_PUBLIC_KEY`);
  console.log(`   ✅ For ${secretKeyType} mode, use: pk_${secretKeyType.toLowerCase() === "test" ? "test" : "live"}_...`);
  console.log(`   ✅ Make sure the public key matches the ${secretKeyType} secret key\n`);

  // Test creating a checkout session (optional - test mode)
  if (secretKeyType === "TEST") {
    try {
      console.log("🔄 Testing checkout session creation...");
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Test Product",
              },
              unit_amount: 1000, // $10.00
            },
            quantity: 1,
          },
        ],
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
      });
      console.log(`✅ Test checkout session created successfully!`);
      console.log(`   Session ID: ${session.id}`);
      console.log(`   Session URL: ${session.url}\n`);
    } catch (error) {
      console.error(`❌ Checkout session creation failed:`, error.message);
    }
  }

  console.log("✨ Stripe key test completed!");
  console.log("\n📝 Next Steps:");
  console.log("   1. Make sure VITE_STRIPE_PUBLIC_KEY in frontend/.env matches this account");
  console.log("   2. Restart your frontend dev server after updating .env");
  console.log("   3. Restart your backend server if you updated STRIPE_SECRET_KEY");
}

testStripeKeys().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});

