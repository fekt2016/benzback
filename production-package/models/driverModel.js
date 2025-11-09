const mongoose = require("mongoose");

/**
 * Driver Model
 * Unified model for both rental drivers (customer's own drivers) and professional drivers (chauffeurs)
 * 
 * - Rental drivers: Added by customers for their own use
 * - Professional drivers: Created automatically during signup when user selects driver role
 * 
 * Bidirectional link with User model:
 * - driver.user = user._id (required)
 * - user.driver = driver._id (set during signup for professional drivers)
 */
const driverSubSchema = new mongoose.Schema(
  {
    name: { type: String }, // driver's name (for rental drivers)
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isDefault: { type: Boolean, default: false },

    // Driver type: "rental" for customer's own drivers, "professional" for chauffeurs
    driverType: {
      type: String,
      enum: ["rental", "professional"],
      default: "rental",
    },

    // Additional fields for professional drivers (populated from User during signup)
    fullName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    dateOfBirth: { type: Date },

    // License number (top-level field for easy access)
    licenseNumber: { type: String, trim: true },
    
    // Hourly rate for professional drivers
    hourlyRate: { type: Number, min: 0 },

    // Overall verification flag derived from sub-docs
    verified: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["pending", "rejected", "verified", "offline", "active", "suspended"],
      default: "pending",
    },

    // Track when driver was last available (online)
    lastAvailable: { type: Date },

    // Real-time availability tracking
    isOnline: { type: Boolean, default: false },
    currentStatus: {
      type: String,
      enum: ["available", "on-trip", "offline"],
      default: "offline",
    },
    lastActiveAt: { type: Date, default: null },
    lastAcceptedBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    license: {
      number: { type: String },
      issuedBy: { type: String },
      expiryDate: { type: Date },
      fileUrl: { type: String }, // Cloudinary link - optional for professional drivers during signup
      verified: { type: Boolean, default: false },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      verifiedAt: { type: Date },
    },

    insurance: {
      provider: { type: String },
      policyNumber: { type: String },
      expiryDate: { type: Date },
      fileUrl: { type: String }, // Cloudinary link - optional for professional drivers during signup
      verified: { type: Boolean, default: false },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      verifiedAt: { type: Date },
    },

    // Update history tracking
    updateHistory: [{
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      updatedAt: { type: Date, default: Date.now },
      changes: { type: mongoose.Schema.Types.Mixed }, // Object containing changed fields
      notes: { type: String },
    }],
  },
  { timestamps: true }
);

// Index for efficient queries by driver type
// driverSubSchema.index({ driverType: 1 });
// driverSubSchema.index({ user: 1, driverType: 1 });

/** Utilities **/
function bothVerified(doc) {
  return !!(doc?.license?.verified && doc?.insurance?.verified);
}

function deriveStatus(doc) {
  // If both verified => verified
  if (bothVerified(doc)) return "verified";
  // If admin has explicitly set rejected elsewhere, keep it
  if (doc.status === "rejected") return "rejected";
  // Otherwise pending
  return "pending";
}

/** Keep things in sync on save (create / document.save()) **/
driverSubSchema.pre("save", function (next) {
  // For professional drivers without license/insurance files yet, don't auto-verify
  if (this.driverType === "professional" && (!this.license?.fileUrl || !this.insurance?.fileUrl)) {
    // Professional drivers start as pending until documents are uploaded
    if (!this.status || this.status === "pending") {
      this.verified = false;
      this.status = "pending";
    }
  } else {
    // For rental drivers or professional drivers with documents, use normal verification logic
    this.verified = bothVerified(this);
    this.status = deriveStatus(this);
  }
  next();
});

/**
 * For atomic updates (findOneAndUpdate / findByIdAndUpdate):
 * We compute AFTER the db update so we can see the final state.
 */
driverSubSchema.post("findOneAndUpdate", async function (doc) {
  if (!doc) return;

  // Load the latest state
  const fresh = await this.model.findById(doc._id).lean();
  if (!fresh) return;

  // For professional drivers without license/insurance files, keep as pending
  if (fresh.driverType === "professional" && (!fresh.license?.fileUrl || !fresh.insurance?.fileUrl)) {
    // Don't auto-update status for professional drivers without documents
    return;
  }

  const shouldBeVerified = bothVerified(fresh);
  const shouldBeStatus = deriveStatus(fresh);

  const patch = {};
  if (fresh.verified !== shouldBeVerified) {
    patch.verified = shouldBeVerified;
  }

  if (fresh.status !== shouldBeStatus) {
    if (shouldBeStatus === "verified") {
      patch.status = "verified";
    } else {
      if (fresh.status === "verified") {
        patch.status = "pending";
      }
      if (fresh.status === "rejected" && shouldBeStatus !== "verified") {
        // Keep rejected status
      }
      if (fresh.status === "pending" && shouldBeStatus === "pending") {
        // Already pending
      }
    }
  }

  if (Object.keys(patch).length) {
    await this.model.updateOne({ _id: fresh._id }, { $set: patch });
  }
});

module.exports = mongoose.model("Driver", driverSubSchema);
