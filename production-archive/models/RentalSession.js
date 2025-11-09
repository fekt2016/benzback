const mongoose = require("mongoose");

const rentalSessionSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: true,
  },
  car: { type: mongoose.Schema.Types.ObjectId, ref: "Car", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  startOdometer: { type: Number, required: true },
  endOdometer: { type: Number },
  startFuelLevel: { type: Number },
  endFuelLevel: { type: Number },
  status: {
    type: String,
    enum: ["active", "completed", "cancelled"],
    default: "active",
  },
  pickupLocation: { type: String },
  dropoffLocation: { type: String },
});

rentalSessionSchema.post('findOneAndDelete', async function (doc, next) {
  if (doc) {
    await mongoose.model('RentalSession').deleteOne({ booking: doc._id });
  }
  next();
});
module.exports = mongoose.model("RentalSession", rentalSessionSchema);
