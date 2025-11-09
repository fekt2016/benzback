require("dotenv").config({ path: "./config.env" });
const mongoose = require("mongoose");
const ProfessionalDriver = require("../models/professionalDriverModel");

const DB = process.env.MONGO_URL.replace("<PASSWORD>", process.env.MONGO_PASSWORD);

mongoose.connect(DB).then(async () => {
  const drivers = await ProfessionalDriver.find().select("name sex address dateOfBirth rating ratingAverage totalRides ratings");
  
  console.log("\n✅ Professional Drivers Summary:\n");
  drivers.forEach((d, i) => {
    console.log(`${i + 1}. ${d.name} (${d.sex})`);
    console.log(`   Address: ${d.address}`);
    console.log(`   Date of Birth: ${d.dateOfBirth.toLocaleDateString()}`);
    console.log(`   Rating: ${d.rating}/5.0 | Average: ${d.ratingAverage}/5.0 | Total Rides: ${d.totalRides}`);
    console.log(`   Ratings Count: ${d.ratings?.length || 0}`);
    console.log("");
  });
  
  console.log(`Total Drivers: ${drivers.length}`);
  console.log(`Female Drivers: ${drivers.filter(d => d.sex === 'female').length}`);
  console.log(`Male Drivers: ${drivers.filter(d => d.sex === 'male').length}`);
  
  process.exit(0);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});

