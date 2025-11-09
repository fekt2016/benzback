    const { validateUSPhone } = require("../utils/helper");
const {catchAsync } = require("../utils/catchAsync");
const { generateOTP } = require("../utils/OtpSystem");
const crypto = require("crypto");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const { createSendToken } = require("../utils/createSendToken");
const validator = require("validator");
const { extractToken, verifyToken } = require("../utils/tokenService");
const emailServices = require("../utils/emailServices");
const TokenBlacklist = require("../models/TokenBlacklistModel");
const { addToTokenBlacklist, isTokenBlacklisted } = require("../services/tokenBlacklistService");
const { generatePasswordResetData } = require("../services/helper");
const Preference = require("../models/preferenceModel");
const Driver = require("../models/driverModel");
const { logActivityWithSocket } = require("../utils/activityLogger");

/**
 * Signup Controller
 * 
 * Flow:
 * 1. Validates phone (US format), password, age (18+), email
 * 2. Creates User record with OTP for verification
 * 3. If role === "driver": Automatically creates Driver record with driverType: "professional"
 *    - Links bidirectionally: user.driver = driver._id and driver.user = user._id
 *    - Driver starts with status: "pending" and verified: false
 *    - Driver creation failure doesn't block signup (logged only)
 * 4. Sends OTP email for verification
 * 
 * Result:
 * - Customers (role: "user") → User only
 * - Drivers (role: "driver") → User + Driver (driverType: "professional"), both linked
 */
exports.signup = catchAsync(async (req, res, next) => {
  try {
    const { timeZone, dateOfBirth, fullName, phone, password, passwordConfirm, email, role } = req.body;

    let currentPhone = phone.replace(/\D/g, "");

    if (currentPhone.length === 11 && currentPhone.startsWith("1")) {
      currentPhone = currentPhone.slice(1);
    }

    if (!currentPhone || !validateUSPhone(currentPhone)) {
      return next(new AppError("Please provide a valid US phone number", 400));
    }

    if (!password || !passwordConfirm) {
      return next(
        new AppError(
          "Please provide both password and password confirmation",
          400
        )
      );
    }

    // Age check: must be at least 18 years old
    if (dateOfBirth) {
      const ageDiff = Date.now() - new Date(dateOfBirth).getTime();
      const age = new Date(ageDiff).getUTCFullYear() - 1970;
      if (age < 18) {
  return next(new AppError("You must be at least 18 years old to sign up", 400));
}
    }

    if (password !== passwordConfirm) {
      return next(new AppError("Passwords do not match", 400));
    }

    if (!email) {
      return next(new AppError("Email is required for OTP verification", 400));
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { phone: currentPhone.replace(/\D/g, "") }],
    }).lean();

    if (existingUser) {
      return next(
        new AppError("User with this email or phone already exists", 400)
      );
    }

    // Validate role if provided
    const validRoles = ["user", "driver"];
    const userRole = role && validRoles.includes(role) ? role : "user";

    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; // Fixed: 10 minutes
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    // Cache OTP for quick access

    const newUser = await User.create({
      fullName,
      email,
      dateOfBirth,
      phone: currentPhone.replace(/\D/g, ""),
      password,
      passwordConfirm,
      role: userRole, // Set the selected role
      otp: hashedOtp,
      otpExpires,
      phoneVerified: false,
      timeZone,
    });
    const preferences = await Preference.create({ user: newUser._id });
    newUser.preferences = preferences._id;
    await newUser.save();

    /**
     * Driver Account Creation
     * When a user signs up with role: "driver", create a Driver record with driverType: "professional"
     * This links the user account to a professional driver profile that can be used for:
     * - Document verification (license, insurance)
     * - Driver management in admin panel
     * - Future integration with ride acceptance system
     */
    if (userRole === "driver") {
      try {
        // Create Driver record with professional driver type
        const driver = await Driver.create({
          user: newUser._id,
          fullName: newUser.fullName,
          phone: newUser.phone,
          email: newUser.email,
          dateOfBirth: newUser.dateOfBirth,
          driverType: "professional", // Professional driver (chauffeur) registered from signup
          verified: false,
          status: "pending",
          // License and insurance files are optional during signup
          // Driver will upload documents later via dashboard for verification
        });

        // Bidirectional linking: user.driver = driver._id and driver.user = newUser._id (already set)
        newUser.driver = driver._id;
        await newUser.save();

        console.log(`[Signup] Professional driver created for user ${newUser._id}`);
      } catch (err) {
        console.error("[Signup] Failed to create professional driver:", err);
        // Don't fail signup if driver creation fails, just log it
        // Driver can create profile later via /driver/register endpoint if needed
      }
    }

    try {
      await emailServices.sendSignupOTP({
        email: newUser.email,
        name: newUser.fullName,
        otpCode: otp,
        expiryMinutes: 10
      });
    } catch (emailError) {
      console.error('Failed to send welcome OTP email:', emailError);
      // Don't fail the signup if email fails, just log it
    }


    // Clean response data
    const userResponse = {
      id: newUser._id,
      name: newUser.fullName,
      phone: newUser.phone,
      email: newUser.email,
    };

    res.status(200).json({
      status: "success",
      message: "Account created! Please verify with the OTP sent to your phone",
      data: { user: userResponse },
    });
  } catch (error) {
    next(error);
  }
});

exports.verifyOtp = catchAsync( async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return next(new AppError("Please provide phone and OTP", 400));
    }

    const normalizedPhone = phone.replace(/\D/g, "");

    const user = await User.findOne({ phone: normalizedPhone }).select(
      "+otp +otpExpires"
    );
    if (!user) {
      return next(new AppError("No user found with that phone number", 404));
    }

    if (!user.verifyOtp(otp)) {
      return next(new AppError("OTP is invalid or has expired", 401));
    }

    // Clear OTP fields
    user.otp = undefined;
    user.otpExpires = undefined;

    let verificationContext = "login";
    let message = "Logged in successfully";

    if (user.status === "pending" ) {
      user.status = "active";
      user.phoneVerified = true;
      verificationContext = "signup";
      message = "Phone verified successfully! Your account is now active";
    }

    user.lastActive = new Date();
    user.verificationContext = verificationContext;

    await user.save({ validateBeforeSave: false });

    // Update driver availability if user is a driver
    if (user.driver) {
      try {
        const Driver = require("../models/driverModel");
        const driver = await Driver.findById(user.driver);
        if (driver && driver.driverType === "professional") {
          driver.isOnline = true;
          driver.currentStatus = "available";
          driver.lastActiveAt = new Date();
          await driver.save({ validateBeforeSave: false });
          console.log(`✅ Driver ${user.driver} set to online and available on login`);
        }
      } catch (driverError) {
        console.error("❌ Error updating driver status on login:", driverError);
      }
    }

    createSendToken(user, message, 200, res);

    // Log activity
    await logActivityWithSocket(
      req,
      user.status === "pending" ? "User Signed Up" : "User Logged In",
      {
        verificationContext,
        phoneVerified: user.phoneVerified,
      },
      {
        userId: user._id,
        role: user.role,
      }
    );
  } catch (error) {
    next(error);
  }
});
exports.login = catchAsync( async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    const curphone = phone.replace(/\D/g, "");

    // Validation
    if (!curphone || !validator.isMobilePhone(curphone)) {
      return next(new AppError("Please enter a valid phone number", 400));
    }
    if (!password) return next(new AppError("Please enter your password", 400));

    // Get user WITHOUT document methods - just raw data
    const user = await User.findOne({ phone: curphone })
      .select("+password email fullName")
      .lean();

    if (!user) {
      return next(new AppError("Invalid phone number or password", 401));
    }

    // Use direct bcrypt comparison instead of Mongoose methods
    const bcrypt = require("bcryptjs");
    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return next(new AppError("Invalid phone number or password", 401));
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    // Use native MongoDB driver for update to avoid Mongoose overhead
    const collection = User.collection;
    await collection.updateOne(
      { _id: user._id },
      {
        $set: {
          otp: hashedOtp,
          otpExpires: new Date(Date.now() + 10 * 60 * 1000),
          lastActive: new Date(),
        },
      }
    );

    // Async email with no memory retention
    const emailData = {
      email: user.email,
      name: user.fullName,
      otpCode: otp,
      purpose: "login verification",
    };

    process.nextTick(() => {
      emailServices
        .sendOTPVerification({ ...emailData })
        .catch((err) => console.error("Email error:", err.message));
    });

    res.status(200).json({
      status: "success",
      message: "OTP sent to your phone number!",
      email: user.email,
      name: user.fullName,
    });
  } catch (error) {
    memory.error("Unexpected error");
    next(error);
  }
});

exports.protect = catchAsync( async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      
      return next(
        new AppError("You are not logged in! Please log in to get access.", 401)
      );
    }

    const { decoded, error } = verifyToken(token);

    if (error) {
      return next(
        new AppError("Invalid or expired token. Please log in again.", 401)
      );
    }

    const currentUser = await User.findById(decoded.id).lean();

    if (!currentUser) {
      return next(
        new AppError("The user belonging to this token no longer exists.", 401)
      );
    }

    // Ensure role defaults to "user" if not set (for backwards compatibility)
    const userRole = currentUser.role || "user";
    
    // If role is missing in DB, update it (for existing users)
    if (!currentUser.role) {
      await User.findByIdAndUpdate(decoded.id, { role: "user" }, { new: false });
    }

    // Attach minimal user data to request
    req.user = {
      _id: currentUser._id,
      email: currentUser.email,
      role: userRole,
      fullName: currentUser.fullName,
    };

    next();
  } catch (error) {
    next(error);
  }
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // Debug logging to help diagnose permission issues
    if (!req.user?.role) {
      console.error('[AUTH] User role is missing:', {
        userId: req.user?._id,
        userEmail: req.user?.email,
        expectedRoles: roles,
      });
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }
    
    if (!roles.includes(req.user.role)) {
      console.error('[AUTH] User role does not match required roles:', {
        userId: req.user._id,
        userEmail: req.user.email,
        userRole: req.user.role,
        expectedRoles: roles,
      });
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }
    
    next();
  };
};

exports.getMe = catchAsync(async (req, res, next) => {
 

  try {
    const user = await User.findById(req.user._id)
      .select("-password -__v -otp -otpExpires -passwordChangedAt")
      .lean();

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Ensure executive field is explicitly included
    // If it's missing, set it to false, but also log it
    const executiveValue = user.executive !== undefined && user.executive !== null 
      ? user.executive 
      : false;
    
    // Explicitly set the executive field to ensure it's in the response
    user.executive = executiveValue;

    res.status(200).json({
      status: "success",
      data: { 
        user: {
          ...user,
          executive: executiveValue, // Explicitly include executive field
        }
      },
    });
  } catch (error) {
    next(error);
  }
});



exports.logout = catchAsync(async (req, res, next) => {
  let blacklistSuccess = false;
  
  try {
    const token = extractToken(req);

    // Clear cookies
    res.cookie("jwt", "loggedout", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.cookie("refreshToken", "loggedout", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    const successResponse = {
      status: "success",
      message: "Logged out successfully",
      action: "clearLocalStorage",
    };

    // Early return if no token
    if (!token) {
    
      return res.status(200).json(successResponse);
    }

    let decoded;
    let user = null;

    try {
      const jwt = require("jsonwebtoken");
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Find user only if token is valid
      user = await User.findOne({ _id: decoded.id }).lean();
      
      if (user) {
        // Blacklist access token
        await TokenBlacklist.blacklistToken({
          token: token,
          user: user._id,
          expiresAt: new Date(decoded.exp * 1000),
          tokenType: "access",
          reason: "logout",
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        });

        // Blacklist refresh token if exists
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
          const refreshDecoded = jwt.decode(refreshToken);
          if (refreshDecoded?.exp) {
            await TokenBlacklist.blacklistToken({
              token: refreshToken,
              user: user._id,
              expiresAt: new Date(refreshDecoded.exp * 1000),
              tokenType: "refresh",
              reason: "logout",
              ipAddress: req.ip,
              userAgent: req.get("User-Agent")
            });
          }
        }
        
        // Update driver status to offline and set lastAvailable when driver logs out
        if (user.driver) {
          try {
            const Driver = require("../models/driverModel");
            const DriverProfile = require("../models/driverProfileModel");
            
            // Try unified Driver model first
            const driver = await Driver.findById(user.driver).lean();
            if (driver && driver.driverType === "professional") {
              // Set status to "pending" (which maps to "offline" in frontend)
              // Update availability tracking fields
              await Driver.findByIdAndUpdate(
                user.driver,
                { 
                  status: "pending",
                  isOnline: false,
                  currentStatus: "offline",
                  lastAvailable: new Date(), // Set to current time when logging out
                  lastActiveAt: new Date() // Track last activity
                },
                { new: true }
              );
              console.log(`✅ Driver ${user.driver} set to offline and availability updated on logout`);
            } else {
              // Fallback to DriverProfile for legacy
              await DriverProfile.findOneAndUpdate(
                { user: user._id },
                { 
                  status: "offline",
                  lastActive: new Date() // Set to current time when logging out
                },
                { new: true }
              );
              console.log(`✅ DriverProfile status set to offline and lastActive updated on logout`);
            }
          } catch (driverError) {
            // Log error but don't fail logout
            console.error("❌ Error updating driver status on logout:", driverError);
          }
        }
        
        blacklistSuccess = true;
        console.log(`✅ Tokens blacklisted for user ${user._id}`);
      }
    } catch (tokenError) {
      // Token verification failed (expired, invalid, etc.)
      console.log(`ℹ️ Token invalid during logout: ${tokenError.message}`);
      // We still proceed with successful logout response
    }

 
    res.status(200).json({
      ...successResponse,
      blacklisted: blacklistSuccess // Optional: indicate if token was blacklisted
    });

  } catch (error) {
    // Log the error but still try to complete the logout
    console.error("❌ Logout process error:", error);
    
    // Even if there's an error, we clear cookies and return success
    res.cookie("jwt", "loggedout", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });
    
    res.cookie("refreshToken", "loggedout", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

  
    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
      action: "clearLocalStorage",
    });
  }
});
exports.resendOtp = catchAsync( async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return next(new AppError("Phone number is required", 400));
    }

    const user = await User.findOne({ phone }).lean();
    if (!user) {
      return next(new AppError("No user found with this phone number", 404));
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    const otpExpires = new Date(Date.now() + 3 * 60 * 1000);

    // Update user with new OTP
    await User.findByIdAndUpdate(
      user._id,
      {
        otp: hashedOtp,
        otpExpires: otpExpires,
      },
      { runValidators: false }
    );

    res.status(200).json({
      status: "success",
      message: "New OTP has been sent to your phone",
      loginId: user._id,
    });
  } catch (error) {
    next(error);
  }
});

exports.updateProfile = catchAsync( async (req, res, next) => {
  try {
    const { fullName, email, phone, dateOfBirth, address } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { fullName, email, phone, dateOfBirth, address },
      { new: true, runValidators: true }
    ).select("-password -__v -otp -otpExpires");

    if (!updatedUser) {
      return next(new AppError("No user found with that id", 404));
    }
   try{
     await emailServices.sendProfileUpdateConfirmation({
  email: updatedUser.email,
  name: updatedUser.fullName,
  updatedFields: ['fullName', 'address', 'bio'],
  timestamp: new Date(),
  ipAddress: req.ip,
  userAgent: req.get('User-Agent')
})
   }catch(error){
    console.log(error);
   }

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
});



exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  // Validate email presence
  if (!email) {
    return next(new AppError('Please provide an email address', 400));
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new AppError('Please provide a valid email address', 400));
  }


  const user = await User.findOne({ email }).select('+passwordResetToken +passwordResetExpires');
  
  
  if (!user) {
    // Log for security monitoring (but don't expose to client)
   
    
    return res.status(200).json({
      status: "success",
      message: "If the email exists in our system, you will receive a password reset link shortly.",
    });
  }

  // Check if there's already a valid reset token
  if (user.passwordResetExpires && user.passwordResetExpires > Date.now()) {
    const timeLeft = Math.ceil((user.passwordResetExpires - Date.now()) / (60 * 1000));
    
    return next(new AppError(
      `A password reset link has already been sent. Please wait ${timeLeft} minutes before requesting another.`,
      429
    ));
  }

  try {
    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set token and expiry (1 hour from now)
    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    
    // Clear any existing reset attempts
    user.passwordResetAttempts = 0;

    // Save user with reset token
    await user.save({ validateBeforeSave: false });
  const emailData = generatePasswordResetData(req, user, resetToken);
    // Send email asynchronously without blocking response
    setImmediate(async () => {
      try {
        await emailServices.sendPasswordResetEmail(emailData);
        // Update user with email sent timestamp (optional)
        await User.findByIdAndUpdate(user._id, {
          lastPasswordResetEmail: new Date()
        });
        
      } catch (emailError) {
        console.log('Error sending password reset email:', emailError);
        // Log email failure but don't expose to user
        console.error('Password reset email failed:', {
          email: user.email,
          error: emailError.message,
          timestamp: new Date().toISOString()
        });

        // Reset the token if email fails to prevent unusable tokens
        await User.findByIdAndUpdate(user._id, {
          passwordResetToken: undefined,
          passwordResetExpires: undefined
        });

        // You might want to implement a retry mechanism or alert system here
        console.error('Password reset token invalidated due to email delivery failure');
      }
    });

    // Log the reset request for security monitoring
    console.log(`Password reset requested for user: ${user.email}`, {
      userId: user._id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Send success response
    res.status(200).json({
      status: "success",
      message: "If the email exists in our system, you will receive a password reset link shortly.",
      // Additional security info for client
      instructions: "Check your email including spam folder. The link will expire in 1 hour."
    });

  } catch (error) {
    // Log detailed error for debugging
    console.error('Password reset process failed:', {
      email,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Reset token on error to prevent locked accounts
    if (user && user._id) {
      await User.findByIdAndUpdate(user._id, {
        passwordResetToken: undefined,
        passwordResetExpires: undefined
      });
    }

    return next(new AppError(
      'Unable to process password reset request. Please try again later.',
      500
    ));
  }
});

exports.updatePassword = catchAsync(
 
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword, newPasswordConfirm } = req.body;

      if (!currentPassword || !newPassword || !newPasswordConfirm) {
        return next(
          new AppError("Please provide current password and new password", 400)
        );
      }

      if (newPassword !== newPasswordConfirm) {
        return next(
          new AppError("New password and confirm password do not match", 400)
        );
      }

      const user = await User.findById(req.user._id).select("+password");

      if (!user) {
        return next(new AppError("No user found with that id", 404));
      }

      if (!(await user.correctPassword(currentPassword, user.password))) {
        return next(new AppError("Current password is incorrect", 401));
      }

      user.password = newPassword;
      if (user.passwordChangedAt) {
        user.passwordChangedAt = Date.now() - 1000;
      }

      await user.save();


      try {
        const blacklistedCount = await TokenBlacklist.blacklistAllUserTokens(
          user._id,
          "password_change",
          user._id // blacklisted by user themselves
        );
       
      } catch (blacklistError) {
        // Log the error but don't fail the password update
        console.error("❌ Failed to blacklist tokens after password change:", blacklistError);
      }



      res.status(200).json({
        status: "success",
        message: "Password updated successfully",
      });
    } catch (error) {
     
      next(error);
    }
  }
);

exports.uploadAvatar = catchAsync( async (req, res, next) => {
  try {
    const { avatar } = req.body;

    if (!avatar) {
      return next(new AppError("Please provide avatar", 400));
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar },
      { new: true }
    ).select("-password -__v");

    if (!user) {
      return next(new AppError("No user found with that id", 404));
    }

    res.status(200).json({
      status: "success",
      message: "Avatar updated successfully",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
});




exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const { password, passwordConfirm: confirmPassword } = req.body;

  // Validate required fields
  if (!password || !confirmPassword) {
    return next(new AppError('Please provide password and confirmation', 400));
  }

  // Validate password length
  if (password.length < 8) {
    return next(new AppError('Password must be at least 8 characters long', 400));
  }

  // Check if passwords match
  if (password !== confirmPassword) {
    return next(new AppError('Passwords do not match', 400));
  }

  // Hash the token to compare with stored hash
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
    console.log(hashedToken)

  try {
    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken +passwordResetExpires');



    if (!user) {
      return next(new AppError('Password reset token is invalid or has expired', 400));
    }

    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(hashedToken);
    if (isBlacklisted) {
      return next(new AppError('Password reset token has been revoked', 400));
    }

    // Update user's password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = Date.now();
    
    // Clear any reset attempts
    user.passwordResetAttempts = 0;

    // Save the user (this will trigger password validation and hashing)
    await user.save();

    // Add used token to blacklist to prevent reuse
    await addToTokenBlacklist(hashedToken, user._id, 'used_for_reset');

    // Invalidate all existing sessions (optional - for enhanced security)
    user.passwordResetRequired = false;
    await user.save({ validateBeforeSave: false });

    // Send password reset success email (non-blocking)
    setImmediate(async () => {
      try {
        await emailServices.sendPasswordResetSuccess({
          email: user.email,
          name: user.fullName || 'Customer',
          timestamp: new Date(),
          // ipAddress: req.ip,
          // userAgent: req.get('User-Agent')
        });
        
        console.log(`Password reset success email sent to: ${user.email}`);
      } catch (emailError) {
        console.error('Failed to send password reset success email:', emailError);
        // Don't throw error - email failure shouldn't affect the reset process
      }
    });

    // Log the successful password reset for security monitoring
    console.log(`Password reset successful for user: ${user.email}`, {
      userId: user._id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Send success response
    res.status(200).json({
      status: 'success',
      message: 'Password has been reset successfully. You can now log in with your new password.',
      redirectTo: '/login'
    });

  } catch (error) {
  
    // Log detailed error for debugging
    console.error('Password reset process failed:', {
      token: hashedToken.substring(0, 16) + '...', // Log partial token for security
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    return next(new AppError(
      'Unable to reset password. Please try again or request a new reset link.',
      500
    ));
  }
});

