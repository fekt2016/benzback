const mongoose = require("mongoose");

const PreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      unique: true
    },
    
    // Notification Preferences
    notifications: {
      bookingConfirmations: { type: Boolean, default: true },
      rentalReminders: { type: Boolean, default: true },
      specialOffers: { type: Boolean, default: true },
      smsAlerts: { type: Boolean, default: false },
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      paymentReminders: { type: Boolean, default: true },
      securityAlerts: { type: Boolean, default: true }
    },
    
    // Privacy Preferences
    privacy: {
      profileVisibility: { 
        type: String, 
        enum: ["public", "private", "contacts-only"], 
        default: "private" 
      },
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
      showLocation: { type: Boolean, default: false },
      allowDataSharing: { type: Boolean, default: false },
      searchEngineIndexing: { type: Boolean, default: false }
    },
    
    // Communication Preferences
    communication: {
      language: { 
        type: String, 
        default: "en",
        enum: ["en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ar"]
      },
      timezone: { type: String, default: "UTC" },
      dateFormat: { 
        type: String, 
        default: "MM/DD/YYYY",
        enum: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]
      },
      timeFormat: { type: String, default: "12h", enum: ["12h", "24h"] },
      currency: {
        type: String,
        default: "USD",
        enum: ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CNY"]
      },
      marketingEmails: { type: Boolean, default: true },
      newsletter: { type: Boolean, default: true }
    },
    
    // Rental Preferences
    rental: {
      preferredVehicleType: {
        type: String,
        enum: ["economy", "compact", "midsize", "standard", "fullsize", "luxury", "suv", "minivan", "convertible", "sports"],
        default: "midsize"
      },
      automaticTransmission: { type: Boolean, default: true },
      fuelPolicy: {
        type: String,
        enum: ["full-to-full", "full-to-empty", "prepaid"],
        default: "full-to-full"
      },
      insurancePreference: {
        type: String,
        enum: ["basic", "standard", "premium"],
        default: "standard"
      },
      driverAssistance: { type: Boolean, default: true },
      gpsNavigation: { type: Boolean, default: true },
      childSeat: { type: Boolean, default: false }
    },
    
    // Accessibility Preferences
    accessibility: {
      highContrast: { type: Boolean, default: false },
      largeText: { type: Boolean, default: false },
      screenReader: { type: Boolean, default: false }
    },
    
    // System
    version: {
      type: Number,
      default: 1
    },
    
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

// Indexes

// PreferenceSchema.index({ "notifications.emailNotifications": 1 });
// PreferenceSchema.index({ "privacy.profileVisibility": 1 });
// PreferenceSchema.index({ "communication.language": 1 });
// PreferenceSchema.index({ "rental.preferredVehicleType": 1 });

// Virtual for checking if user wants marketing communications
PreferenceSchema.virtual('wantsMarketing').get(function() {
  return this.communication.marketingEmails && this.notifications.specialOffers;
});

// Virtual for checking if user is privacy conscious
PreferenceSchema.virtual('isPrivacyConscious').get(function() {
  return this.privacy.profileVisibility === 'private' && 
         !this.privacy.showEmail && 
         !this.privacy.showPhone;
});

// Virtual for user's preferred contact methods
PreferenceSchema.virtual('contactMethods').get(function() {
  const methods = [];
  if (this.notifications.emailNotifications) methods.push('email');
  if (this.notifications.smsAlerts) methods.push('sms');
  if (this.notifications.pushNotifications) methods.push('push');
  return methods;
});

// Static Methods

// Create default preferences for a user
PreferenceSchema.statics.createDefaultPreferences = async function(userId) {
  try {
    return await this.create({
      user: userId
      // All other fields will use their schema defaults
    });
  } catch (error) {
    throw new Error(`Failed to create default preferences: ${error.message}`);
  }
};

// Get preferences by user ID
PreferenceSchema.statics.findByUserId = function(userId) {
  return this.findOne({ user: userId });
};

// Get preferences with user population
PreferenceSchema.statics.findByUserIdWithUser = function(userId, userFields = 'fullName email phone') {
  return this.findOne({ user: userId }).populate('user', userFields);
};

// Find users by specific notification preference
PreferenceSchema.statics.findByNotificationSetting = function(setting, value = true) {
  return this.find({
    [`notifications.${setting}`]: value
  }).populate('user', 'fullName email phone status');
};

// Find users by privacy setting
PreferenceSchema.statics.findByPrivacySetting = function(setting, value) {
  return this.find({
    [`privacy.${setting}`]: value
  }).populate('user', 'fullName email phone status');
};

// Instance Methods

// Update specific preference category
PreferenceSchema.methods.updateCategory = function(category, updates) {
  if (!this[category]) {
    throw new Error(`Invalid preference category: ${category}`);
  }
  
  // Update the category with new values
  Object.keys(updates).forEach(key => {
    if (this[category][key] !== undefined) {
      this[category][key] = updates[key];
    }
  });
  
  this.version += 1;
  this.lastUpdated = new Date();
  return this.save();
};

// Update specific preference field
PreferenceSchema.methods.updateField = function(category, field, value) {
  if (!this[category] || this[category][field] === undefined) {
    throw new Error(`Invalid preference field: ${category}.${field}`);
  }
  
  this[category][field] = value;
  this.version += 1;
  this.lastUpdated = new Date();
  return this.save();
};

// Reset specific category to defaults
PreferenceSchema.methods.resetCategory = function(category) {
  const defaults = {
    notifications: {
      bookingConfirmations: true,
      rentalReminders: true,
      specialOffers: true,
      smsAlerts: false,
      emailNotifications: true,
      pushNotifications: true,
      paymentReminders: true,
      securityAlerts: true
    },
    privacy: {
      profileVisibility: "private",
      showEmail: false,
      showPhone: false,
      showLocation: false,
      allowDataSharing: false,
      searchEngineIndexing: false
    },
    communication: {
      language: "en",
      timezone: "UTC",
      dateFormat: "MM/DD/YYYY",
      timeFormat: "12h",
      currency: "USD",
      marketingEmails: true,
      newsletter: true
    },
    rental: {
      preferredVehicleType: "midsize",
      automaticTransmission: true,
      fuelPolicy: "full-to-full",
      insurancePreference: "standard",
      driverAssistance: true,
      gpsNavigation: true,
      childSeat: false
    },
    accessibility: {
      highContrast: false,
      largeText: false,
      screenReader: false
    }
  };
  
  if (!defaults[category]) {
    throw new Error(`Invalid preference category: ${category}`);
  }
  
  this[category] = defaults[category];
  this.version += 1;
  this.lastUpdated = new Date();
  return this.save();
};

// Reset all preferences to defaults
PreferenceSchema.methods.resetToDefaults = function() {
  this.notifications = {
    bookingConfirmations: true,
    rentalReminders: true,
    specialOffers: true,
    smsAlerts: false,
    emailNotifications: true,
    pushNotifications: true,
    paymentReminders: true,
    securityAlerts: true
  };
  
  this.privacy = {
    profileVisibility: "private",
    showEmail: false,
    showPhone: false,
    showLocation: false,
    allowDataSharing: false,
    searchEngineIndexing: false
  };
  
  this.communication = {
    language: "en",
    timezone: "UTC",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
    currency: "USD",
    marketingEmails: true,
    newsletter: true
  };
  
  this.rental = {
    preferredVehicleType: "midsize",
    automaticTransmission: true,
    fuelPolicy: "full-to-full",
    insurancePreference: "standard",
    driverAssistance: true,
    gpsNavigation: true,
    childSeat: false
  };
  
  this.accessibility = {
    highContrast: false,
    largeText: false,
    screenReader: false
  };
  
  this.version += 1;
  this.lastUpdated = new Date();
  return this.save();
};

// Check if specific notification is enabled
PreferenceSchema.methods.isNotificationEnabled = function(notificationType) {
  return this.notifications[notificationType] === true;
};

// Get user's preferred language and region settings
PreferenceSchema.methods.getLocaleSettings = function() {
  return {
    language: this.communication.language,
    timezone: this.communication.timezone,
    dateFormat: this.communication.dateFormat,
    timeFormat: this.communication.timeFormat,
    currency: this.communication.currency
  };
};

// Middleware to update lastUpdated timestamp
PreferenceSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.lastUpdated = new Date();
    this.version += 1;
  }
  next();
});

module.exports = mongoose.model("Preference", PreferenceSchema);