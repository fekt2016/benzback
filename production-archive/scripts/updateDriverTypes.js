/**
 * Migration Script: Update driverType for existing drivers
 * 
 * Logic:
 * - All drivers in Driver model are rental drivers → set driverType: "rental"
 * - All drivers in ProfessionalDriver model are professional drivers → set driverType: "professional"
 * 
 * Note: Driver and ProfessionalDriver are separate models in the database
 * 
 * Usage: node scripts/updateDriverTypes.js
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Driver = require("../models/driverModel");
const ProfessionalDriver = require("../models/professionalDriverModel");

// Load environment variables
dotenv.config({ path: "./config.env" });

const updateDriverTypes = async () => {
  try {
    console.log("🚀 Starting driverType migration...\n");

    // Connect to MongoDB
    const db = process.env.MONGO_URL.replace(
      `<PASSWORD>`,
      process.env.MONGO_PASSWORD
    );
    
    await mongoose.connect(db, { maxPoolSize: 10 });
    console.log("✅ MongoDB connected\n");

    // Update all Driver model records to "rental"
    console.log("📋 Updating Driver model (rental drivers)...\n");
    
    const rentalDrivers = await Driver.find({});
    console.log(`   Found ${rentalDrivers.length} rental drivers\n`);

    let rentalUpdated = 0;
    for (const driver of rentalDrivers) {
      // Only update if driverType is missing or not "rental"
      const needsUpdate =
        !driver.driverType ||
        driver.driverType === "" ||
        driver.driverType !== "rental";

      if (needsUpdate) {
        await Driver.updateOne(
          { _id: driver._id },
          { $set: { driverType: "rental" } }
        );
        rentalUpdated++;
        console.log(
          `✅ Updated rental driver ${driver._id} → driverType: "rental"`
        );
      }
    }

    // Update all ProfessionalDriver model records to "professional"
    console.log("\n📋 Updating ProfessionalDriver model (professional drivers)...\n");
    
    const professionalDrivers = await ProfessionalDriver.find({});
    console.log(`   Found ${professionalDrivers.length} professional drivers\n`);

    let professionalUpdated = 0;
    for (const driver of professionalDrivers) {
      // Only update if driverType is missing or not "professional"
      const needsUpdate =
        !driver.driverType ||
        driver.driverType === "" ||
        driver.driverType !== "professional";

      if (needsUpdate) {
        await ProfessionalDriver.updateOne(
          { _id: driver._id },
          { $set: { driverType: "professional" } }
        );
        professionalUpdated++;
        console.log(
          `✅ Updated professional driver ${driver._id} → driverType: "professional"`
        );
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 Migration Summary:");
    console.log(`   Rental drivers (Driver model):`);
    console.log(`      Total: ${rentalDrivers.length}`);
    console.log(`      Updated: ${rentalUpdated}`);
    console.log(`   Professional drivers (ProfessionalDriver model):`);
    console.log(`      Total: ${professionalDrivers.length}`);
    console.log(`      Updated: ${professionalUpdated}`);
    console.log("=".repeat(50) + "\n");

    // Final verification: Count drivers by type in each model
    const rentalStats = await Driver.aggregate([
      {
        $group: {
          _id: "$driverType",
          count: { $sum: 1 },
        },
      },
    ]);

    const professionalStats = await ProfessionalDriver.aggregate([
      {
        $group: {
          _id: "$driverType",
          count: { $sum: 1 },
        },
      },
    ]);

    console.log("📊 Final Driver Type Distribution:");
    console.log("   Driver model (rental drivers):");
    rentalStats.forEach((stat) => {
      console.log(`      ${stat._id || "null/undefined"}: ${stat.count}`);
    });
    console.log("   ProfessionalDriver model (professional drivers):");
    professionalStats.forEach((stat) => {
      console.log(`      ${stat._id || "null/undefined"}: ${stat.count}`);
    });

    // Close connection
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    console.log("🎉 Migration completed successfully!");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run migration
updateDriverTypes();

