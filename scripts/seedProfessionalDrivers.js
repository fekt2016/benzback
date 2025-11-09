/**
 * Seed Professional Drivers Script
 * Creates 5 professional drivers (2 women, 3 men) with complete information
 * 
 * Usage: node backend/scripts/seedProfessionalDrivers.js
 */

require("dotenv").config({ path: "./config.env" });
const mongoose = require("mongoose");
const ProfessionalDriver = require("../models/professionalDriverModel");

// Connect to MongoDB
const DB = process.env.MONGO_URL.replace(
  "<PASSWORD>",
  process.env.MONGO_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    seedDrivers();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

const seedDrivers = async () => {
  try {
    // Clear existing professional drivers (optional - comment out if you want to keep existing)
    // await ProfessionalDriver.deleteMany({});
    // console.log("Cleared existing professional drivers");

    const drivers = [
      // Female Driver 1
      {
        name: "Sarah Johnson",
        email: "sarah.johnson@benzflex.com",
        phone: "+1-314-555-0101",
        address: "123 Main Street, St. Louis, MO 63101",
        dateOfBirth: new Date("1985-05-15"),
        sex: "female",
        licenseNumber: "DL-MO-1234567",
        licenseExpiry: new Date("2027-05-15"),
        bio: "Experienced professional driver with 8 years of chauffeur service. Specializes in luxury vehicle handling and providing exceptional customer service.",
        languages: ["English", "Spanish"],
        rating: 4.8,
        ratings: [
          { value: 5, comment: "Excellent driver, very professional", customer: "John Doe", createdAt: new Date("2024-01-15") },
          { value: 5, comment: "Safe and courteous", customer: "Jane Smith", createdAt: new Date("2024-02-20") },
          { value: 4, comment: "Great service", customer: "Mike Brown", createdAt: new Date("2024-03-10") },
          { value: 5, comment: "Highly recommend", customer: "Lisa Wilson", createdAt: new Date("2024-04-05") },
          { value: 4, comment: "Very good driver", customer: "David Lee", createdAt: new Date("2024-05-12") },
        ],
        ratingAverage: 4.6,
        totalRides: 145,
        hourlyRate: 35,
        dailyRate: 250,
        status: "available",
        verified: true,
        active: true,
        availability: {
          monday: { available: true, hours: { start: "08:00", end: "20:00" } },
          tuesday: { available: true, hours: { start: "08:00", end: "20:00" } },
          wednesday: { available: true, hours: { start: "08:00", end: "20:00" } },
          thursday: { available: true, hours: { start: "08:00", end: "20:00" } },
          friday: { available: true, hours: { start: "08:00", end: "22:00" } },
          saturday: { available: true, hours: { start: "09:00", end: "22:00" } },
          sunday: { available: false, hours: { start: "09:00", end: "18:00" } },
        },
      },
      // Female Driver 2
      {
        name: "Emily Rodriguez",
        email: "emily.rodriguez@benzflex.com",
        phone: "+1-314-555-0102",
        address: "456 Oak Avenue, St. Louis, MO 63102",
        dateOfBirth: new Date("1990-08-22"),
        sex: "female",
        licenseNumber: "DL-MO-1234568",
        licenseExpiry: new Date("2028-08-22"),
        bio: "Professional chauffeur with excellent communication skills. Fluent in English and Spanish. Known for punctuality and attention to detail.",
        languages: ["English", "Spanish", "French"],
        rating: 4.9,
        ratings: [
          { value: 5, comment: "Best driver ever!", customer: "Robert Taylor", createdAt: new Date("2024-01-20") },
          { value: 5, comment: "Extremely professional", customer: "Maria Garcia", createdAt: new Date("2024-02-15") },
          { value: 5, comment: "Outstanding service", customer: "James White", createdAt: new Date("2024-03-25") },
          { value: 4, comment: "Very reliable", customer: "Patricia Martinez", createdAt: new Date("2024-04-18") },
          { value: 5, comment: "Perfect driver", customer: "Christopher Davis", createdAt: new Date("2024-05-22") },
        ],
        ratingAverage: 4.8,
        totalRides: 203,
        hourlyRate: 40,
        dailyRate: 280,
        status: "available",
        verified: true,
        active: true,
        availability: {
          monday: { available: true, hours: { start: "07:00", end: "19:00" } },
          tuesday: { available: true, hours: { start: "07:00", end: "19:00" } },
          wednesday: { available: true, hours: { start: "07:00", end: "19:00" } },
          thursday: { available: true, hours: { start: "07:00", end: "19:00" } },
          friday: { available: true, hours: { start: "07:00", end: "21:00" } },
          saturday: { available: true, hours: { start: "08:00", end: "21:00" } },
          sunday: { available: true, hours: { start: "10:00", end: "18:00" } },
        },
      },
      // Male Driver 1
      {
        name: "Michael Chen",
        email: "michael.chen@benzflex.com",
        phone: "+1-314-555-0103",
        address: "789 Pine Street, St. Louis, MO 63103",
        dateOfBirth: new Date("1988-03-10"),
        sex: "male",
        licenseNumber: "DL-MO-1234569",
        licenseExpiry: new Date("2026-03-10"),
        bio: "Dedicated professional driver with extensive knowledge of St. Louis area. Committed to providing safe and comfortable transportation experiences.",
        languages: ["English", "Chinese"],
        rating: 4.7,
        ratings: [
          { value: 5, comment: "Great driver, very safe", customer: "Jennifer Lopez", createdAt: new Date("2024-01-10") },
          { value: 4, comment: "Professional and courteous", customer: "William Anderson", createdAt: new Date("2024-02-25") },
          { value: 5, comment: "Excellent service", customer: "Barbara Thompson", createdAt: new Date("2024-03-15") },
          { value: 4, comment: "Very reliable", customer: "Richard Jackson", createdAt: new Date("2024-04-20") },
          { value: 5, comment: "Highly recommended", customer: "Susan Harris", createdAt: new Date("2024-05-08") },
        ],
        ratingAverage: 4.6,
        totalRides: 178,
        hourlyRate: 38,
        dailyRate: 270,
        status: "available",
        verified: true,
        active: true,
        availability: {
          monday: { available: true, hours: { start: "08:00", end: "20:00" } },
          tuesday: { available: true, hours: { start: "08:00", end: "20:00" } },
          wednesday: { available: true, hours: { start: "08:00", end: "20:00" } },
          thursday: { available: true, hours: { start: "08:00", end: "20:00" } },
          friday: { available: true, hours: { start: "08:00", end: "22:00" } },
          saturday: { available: true, hours: { start: "09:00", end: "22:00" } },
          sunday: { available: true, hours: { start: "10:00", end: "18:00" } },
        },
      },
      // Male Driver 2
      {
        name: "David Williams",
        email: "david.williams@benzflex.com",
        phone: "+1-314-555-0104",
        address: "321 Elm Boulevard, St. Louis, MO 63104",
        dateOfBirth: new Date("1982-11-30"),
        sex: "male",
        licenseNumber: "DL-MO-1234570",
        licenseExpiry: new Date("2029-11-30"),
        bio: "Veteran chauffeur with over 12 years of experience. Expert in luxury vehicle operations and premium customer service. Clean driving record.",
        languages: ["English"],
        rating: 4.9,
        ratings: [
          { value: 5, comment: "Outstanding professional", customer: "Thomas Moore", createdAt: new Date("2024-01-05") },
          { value: 5, comment: "Best driver I've had", customer: "Nancy Lewis", createdAt: new Date("2024-02-12") },
          { value: 5, comment: "Excellent in every way", customer: "Daniel Walker", createdAt: new Date("2024-03-20") },
          { value: 4, comment: "Very professional", customer: "Karen Hall", createdAt: new Date("2024-04-15") },
          { value: 5, comment: "Perfect service", customer: "Mark Allen", createdAt: new Date("2024-05-25") },
        ],
        ratingAverage: 4.8,
        totalRides: 312,
        hourlyRate: 45,
        dailyRate: 320,
        status: "available",
        verified: true,
        active: true,
        availability: {
          monday: { available: true, hours: { start: "06:00", end: "22:00" } },
          tuesday: { available: true, hours: { start: "06:00", end: "22:00" } },
          wednesday: { available: true, hours: { start: "06:00", end: "22:00" } },
          thursday: { available: true, hours: { start: "06:00", end: "22:00" } },
          friday: { available: true, hours: { start: "06:00", end: "23:00" } },
          saturday: { available: true, hours: { start: "07:00", end: "23:00" } },
          sunday: { available: true, hours: { start: "08:00", end: "20:00" } },
        },
      },
      // Male Driver 3
      {
        name: "James Thompson",
        email: "james.thompson@benzflex.com",
        phone: "+1-314-555-0105",
        address: "654 Maple Drive, St. Louis, MO 63105",
        dateOfBirth: new Date("1992-07-18"),
        sex: "male",
        licenseNumber: "DL-MO-1234571",
        licenseExpiry: new Date("2027-07-18"),
        bio: "Young and energetic professional driver with a passion for luxury vehicles. Friendly demeanor and excellent customer service skills.",
        languages: ["English", "German"],
        rating: 4.6,
        ratings: [
          { value: 5, comment: "Very friendly driver", customer: "Amy Young", createdAt: new Date("2024-01-25") },
          { value: 4, comment: "Good service", customer: "Kevin King", createdAt: new Date("2024-02-18") },
          { value: 5, comment: "Punctual and professional", customer: "Michelle Wright", createdAt: new Date("2024-03-12") },
          { value: 4, comment: "Nice driver", customer: "Brian Scott", createdAt: new Date("2024-04-22") },
          { value: 5, comment: "Would use again", customer: "Angela Green", createdAt: new Date("2024-05-15") },
        ],
        ratingAverage: 4.6,
        totalRides: 92,
        hourlyRate: 32,
        dailyRate: 230,
        status: "available",
        verified: true,
        active: true,
        availability: {
          monday: { available: true, hours: { start: "09:00", end: "19:00" } },
          tuesday: { available: true, hours: { start: "09:00", end: "19:00" } },
          wednesday: { available: true, hours: { start: "09:00", end: "19:00" } },
          thursday: { available: true, hours: { start: "09:00", end: "19:00" } },
          friday: { available: true, hours: { start: "09:00", end: "21:00" } },
          saturday: { available: true, hours: { start: "10:00", end: "21:00" } },
          sunday: { available: false, hours: { start: "10:00", end: "18:00" } },
        },
      },
    ];

    // Insert drivers
    const createdDrivers = await ProfessionalDriver.insertMany(drivers);
    
    console.log(`\n✅ Successfully created ${createdDrivers.length} professional drivers:\n`);
    
    createdDrivers.forEach((driver, index) => {
      console.log(`${index + 1}. ${driver.name} (${driver.sex})`);
      console.log(`   Email: ${driver.email}`);
      console.log(`   Phone: ${driver.phone}`);
      console.log(`   Address: ${driver.address}`);
      console.log(`   Date of Birth: ${driver.dateOfBirth.toLocaleDateString()}`);
      console.log(`   Rating: ${driver.rating}/5.0 (${driver.totalRides} rides)`);
      console.log(`   Daily Rate: $${driver.dailyRate}`);
      console.log(`   License: ${driver.licenseNumber}`);
      console.log("");
    });

    console.log("✅ Seed completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding drivers:", error);
    process.exit(1);
  }
};

