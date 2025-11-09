/**
 * Script to update a specific user's executive field
 * 
 * Usage: node scripts/updateExecutive.js <userId> <true|false>
 * Example: node scripts/updateExecutive.js 68e99a6cc16392817d5f230f true
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/userModel");

// Load environment variables
dotenv.config({ path: "./config.env" });

const updateExecutive = async () => {
  try {
    const userId = process.argv[2];
    const executiveValue = process.argv[3] === 'true';

    if (!userId) {
      console.error("❌ Please provide a user ID");
      console.log("Usage: node scripts/updateExecutive.js <userId> <true|false>");
      process.exit(1);
    }

    // Connect to MongoDB
    const db = process.env.MONGO_URL.replace(
      `<PASSWORD>`,
      process.env.MONGO_PASSWORD
    );
    
    await mongoose.connect(db, { maxPoolSize: 10 });
    console.log("✅ MongoDB connected");

    // Find the user
    const user = await User.findById(userId);

    if (!user) {
      console.error(`❌ User with ID ${userId} not found`);
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`📋 Current user info:`);
    console.log(`   Name: ${user.fullName}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Current executive: ${user.executive}`);

    // Update executive field
    user.executive = executiveValue;
    await user.save();

    console.log(`✅ Successfully updated user ${userId}`);
    console.log(`   New executive status: ${user.executive}`);
    
    // Close connection
    await mongoose.connection.close();
    console.log("✅ Database connection closed");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error:", error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run update
updateExecutive();

