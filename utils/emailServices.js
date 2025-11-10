// utils/emailService.js
// LAZY LOADING OPTIMIZATION: SendGrid is loaded on first use, not at module load
// This prevents WebAssembly memory allocation at application startup
// const { getSendGrid } = require("../services/sendGridClient");
// const sgMail = getSendGrid(); // Moved to lazy loading

class EmailService {
  constructor() {
    this.senders = {
      noreply: {
        email: "noreply@benzflex.com",
        name: "BenzFlex Luxury Car Rentals",
      },
      bookings: {
        email: "bookings@benzflex.com",
        name: "BenzFlex Bookings",
      },
      support: {
        email: "support@benzflex.com",
        name: "BenzFlex Support",
      },
      concierge: {
        email: "concierge@benzflex.com",
        name: "BenzFlex Concierge",
      },
      security: {
        email: "security@benzflex.com",
        name: "BenzFlex Security",
      },
    };
  }

  // Generic email sender with flexible from address
  async sendEmail({
    to,
    from = this.senders.bookings, // Default to bookings
    subject,
    text,
    html,
    templateId,
    dynamicTemplateData,
  }) {
    try {
      // Format from address properly for SendGrid
      let formattedFrom;
      if (typeof from === "string") {
        formattedFrom = from;
      } else if (from && typeof from === "object" && from.email) {
        // SendGrid accepts object format: { email, name }
        formattedFrom = {
          email: from.email,
          name: from.name || "BenzFlex"
        };
      } else {
        throw new Error("Invalid from address format");
      }

      const msg = {
        to,
        from: formattedFrom,
        subject,
        text,
        html,
        templateId,
        dynamicTemplateData,
      };

      // Remove undefined fields
      Object.keys(msg).forEach(
        (key) => msg[key] === undefined && delete msg[key]
      );

      console.log(`📧 Attempting to send email to ${to} from ${typeof formattedFrom === 'string' ? formattedFrom : formattedFrom.email}: ${subject}`);
      
      // LAZY LOAD: Get SendGrid instance on first use (not at module load)
      const { getSendGrid } = require("../services/sendGridClient");
      const sgMail = getSendGrid();
      
      if (!sgMail) {
        throw new Error("SendGrid is not configured");
      }
      
      const result = await sgMail.send(msg);
      console.log(`✅ Email sent successfully to ${to} from ${typeof formattedFrom === 'string' ? formattedFrom : formattedFrom.email}: ${subject}`);
      return { success: true, messageId: result[0]?.headers["x-message-id"] };
    } catch (error) {
      console.error("❌ Email sending failed:", error);
      console.error("Error details:", {
        to,
        from,
        subject,
        errorMessage: error.message,
        errorResponse: error.response?.body
      });
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  // Booking Confirmation Email - from bookings
  async sendBookingConfirmation(bookingData) {
    const {
      customerEmail,
      customerName,
      orderId,
      vehicleModel,
      pickupDate,
      returnDate,
      totalAmount,
      bookingLink,
    } = bookingData;

    // Validate required fields
    if (!customerEmail) {
      throw new Error("customerEmail is required for booking confirmation");
    }
    if (!customerName) {
      throw new Error("customerName is required for booking confirmation");
    }
    if (!orderId) {
      throw new Error("orderId is required for booking confirmation");
    }

    const subject = `Booking Confirmed - Your ${vehicleModel || 'Luxury Vehicle'} Awaits!`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            /* Your luxury email styles here */
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>BenzFlex</h1>
              <p>LUXURY CAR RENTALS</p>
            </div>
            <div class="content">
              <h2>Your Luxury Journey Awaits</h2>
              <p>Dear ${customerName}, your BenzFlex reservation has been confirmed</p>
              
              <div class="booking-details">
                <h3>Booking #${orderId}</h3>
                <p><strong>Vehicle:</strong> ${vehicleModel}</p>
                <p><strong>Pickup:</strong> ${pickupDate}</p>
                <p><strong>Return:</strong> ${returnDate}</p>
                <p><strong>Total:</strong> $${totalAmount}</p>
              </div>
              
              <a href="${bookingLink}" class="btn">View Booking Details</a>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Booking Confirmed - BenzFlex Luxury Car Rentals
      
      Dear ${customerName},
      
      Your booking for ${vehicleModel} has been confirmed.
      Booking ID: ${orderId}
      Pickup: ${pickupDate}
      Return: ${returnDate}
      Total Amount: $${totalAmount}
      
      View your booking: ${bookingLink}
      
      Thank you for choosing BenzFlex!
    `;

    return this.sendEmail({
      to: customerEmail,
      from: this.senders.bookings,
      subject,
      text,
      html,
    });
  }

  // OTP Verification Email - from security
  async sendOTPVerification({
    email,
    name,
    otpCode,
    purpose = "account verification",
  }) {
    const subject = `Your BenzFlex Verification Code: ${otpCode}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">BenzFlex Security Verification</h2>
        <p>Hello ${name},</p>
        <p>Your verification code for ${purpose} is:</p>
        <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
          ${otpCode}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p><strong>For security, never share this code with anyone.</strong></p>
        <hr>
        <p style="color: #6b7280; font-size: 12px;">
          If you didn't request this code, please ignore this email or contact support.
        </p>
      </div>
    `;

    const text = `
      BenzFlex Security Verification
      
      Hello ${name},
      
      Your verification code for ${purpose} is: ${otpCode}
      
      This code will expire in 10 minutes.
      For security, never share this code with anyone.
      
      If you didn't request this code, please ignore this email.
    `;

    return this.sendEmail({
      to: email,
      from: this.senders.security,
      subject,
      text,
      html,
    });
  }

  // Payment Confirmation Email - from bookings
  async sendPaymentConfirmation(paymentData) {
    const {
      customerEmail,
      customerName,
      orderId,
      amount,
      vehicleModel,
      paymentMethod,
    } = paymentData;

    const subject = `Payment Confirmed - Booking #${orderId}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">Payment Successful! 🎉</h2>
        <p>Dear ${customerName},</p>
        <p>Your payment for your luxury rental has been processed successfully.</p>
        
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Payment Details</h3>
          <p><strong>Amount:</strong> $${amount}</p>
          <p><strong>Vehicle:</strong> ${vehicleModel}</p>
          <p><strong>Method:</strong> ${paymentMethod}</p>
          <p><strong>Booking ID:</strong> ${orderId}</p>
        </div>
        
        <p>Your concierge will contact you shortly to finalize delivery details.</p>
      </div>
    `;

    return this.sendEmail({
      to: customerEmail,
      from: this.senders.bookings,
      subject,
      html,
    });
  }

// Password Reset Email - from security
async sendPasswordResetEmail(resetData) {

  const {
   email,
    name,
    resetURL,
    expiryTime,
  } = resetData;

  const subject = `Password Reset Request - BenzFlex Luxury Car Rentals`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: bold;
        }
        .header .subtitle {
          color: #d4af37;
          margin: 5px 0 0 0;
          font-size: 14px;
          letter-spacing: 2px;
        }
        .content {
          background: #ffffff;
          padding: 30px;
          border: 1px solid #e5e5e5;
          border-top: none;
          border-radius: 0 0 10px 10px;
        }
        .security-alert {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-left: 4px solid #fdcb6e;
          padding: 15px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .reset-button {
          display: inline-block;
          background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
          color: #ffffff;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          margin: 20px 0;
        }
        .token-display {
          background: #f8f9fa;
          border: 1px dashed #dee2e6;
          padding: 15px;
          margin: 15px 0;
          border-radius: 5px;
          word-break: break-all;
          font-family: 'Courier New', monospace;
          font-size: 12px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e5e5;
          font-size: 12px;
          color: #6c757d;
        }
        .security-info {
          background: #e8f4fd;
          border: 1px solid #b8daff;
          padding: 15px;
          margin: 20px 0;
          border-radius: 5px;
          font-size: 14px;
        }
        .warning {
          color: #dc3545;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>BenzFlex</h1>
        <div class="subtitle">LUXURY CAR RENTALS</div>
      </div>
      
      <div class="content">
        <h2 style="color: #1a1a1a; margin-top: 0;">Password Reset Request</h2>
        
        <p>Hello ${name},</p>
        
        <p>We received a request to reset your BenzFlex account password. If you didn't make this request, please ignore this email.</p>
     
        <div style="text-align: center;">
          <a href="${resetURL}" class="reset-button">
            Reset Your Password
          </a>
        </div>

        <p>Or copy and paste this link in your browser:</p>
        <div class="token-display">
          ${resetURL}
        </div>

        <div class="security-info">
          <strong>Important Security Information:</strong>
          <ul>
            <li>This link will expire in <strong>${expiryTime}</strong></li>
            <li>For your security, never share this link with anyone</li>
            <li>BenzFlex staff will never ask for your password</li>
          </ul>
        </div>

        <p class="warning">If you didn't request this password reset, please contact our security team immediately at 
          <a href="mailto:security@benzflex.com" style="color: #dc3545;">security@benzflex.com</a>
        </p>

        <div class="footer">
          <p><strong>BenzFlex Security Team</strong></p>
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>For immediate assistance, contact our concierge: 
            <a href="mailto:concierge@benzflex.com">concierge@benzflex.com</a>
          </p>
          <p>© ${new Date().getFullYear()} BenzFlex Luxury Car Rentals. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    PASSWORD RESET REQUEST - BenzFlex Luxury Car Rentals
    
    Hello ${name},
    
    We received a request to reset your BenzFlex account password. 
    If you didn't make this request, please ignore this email.
    
  
    
    To reset your password, click the link below:
    ${resetURL}
    
    Or copy and paste the link into your browser.
    
    IMPORTANT SECURITY INFORMATION:
    • This link will expire in ${expiryTime}
    • For your security, never share this link with anyone
    • BenzFlex staff will never ask for your password
    
    If you didn't request this password reset, please contact our security team immediately at security@benzflex.com
    
    ---
    BenzFlex Security Team
    This is an automated message. Please do not reply to this email.
    For immediate assistance, contact our concierge: concierge@benzflex.com
    © ${new Date().getFullYear()} BenzFlex Luxury Car Rentals. All rights reserved.
  `;

   return this.sendEmail({
      to: email,
      from: this.senders.security,
      subject,
      text,
      html,
    });
}

// Password Reset Success Confirmation - from security
async sendPasswordResetSuccess(confirmationData) {
  const {
    email,
    name,
    timestamp = new Date(),
    ipAddress,
    userAgent
  } = confirmationData;

  const subject = `Password Updated Successfully - BenzFlex Account`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: bold;
        }
        .content {
          background: #ffffff;
          padding: 30px;
          border: 1px solid #e5e5e5;
          border-top: none;
          border-radius: 0 0 10px 10px;
        }
        .success-icon {
          color: #28a745;
          font-size: 48px;
          text-align: center;
          margin: 20px 0;
        }
        .security-info {
          background: #e8f5e8;
          border: 1px solid #c3e6cb;
          padding: 15px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e5e5;
          font-size: 12px;
          color: #6c757d;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>BenzFlex</h1>
        <div style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px; letter-spacing: 2px;">
          SECURITY NOTIFICATION
        </div>
      </div>
      
      <div class="content">
        <div class="success-icon">
          ✓
        </div>
        
        <h2 style="color: #28a745; text-align: center; margin-top: 0;">
          Password Updated Successfully
        </h2>
        
        <p>Hello ${name},</p>
        
        <p>Your BenzFlex account password was successfully updated on ${new Date(timestamp).toLocaleString()}.</p>
        
        <div class="security-info">
          <strong>Update Details:</strong>
          <br>Time: ${new Date(timestamp).toLocaleString()}
          ${ipAddress ? `<br>IP Address: ${ipAddress}` : ''}
          ${userAgent ? `<br>Device: ${userAgent}` : ''}
        </div>

        <p><strong>If you made this change:</strong></p>
        <ul>
          <li>You can now sign in with your new password</li>
          <li>Your account security has been updated</li>
          <li>All your active sessions remain logged in</li>
        </ul>

        <p class="warning" style="color: #dc3545; font-weight: bold;">
          If you didn't make this change, please contact our security team immediately at 
          <a href="mailto:security@benzflex.com" style="color: #dc3545;">security@benzflex.com</a>
        </p>

        <div class="footer">
          <p><strong>BenzFlex Security Team</strong></p>
          <p>This is an automated security notification. Please do not reply to this email.</p>
          <p>© ${new Date().getFullYear()} BenzFlex Luxury Car Rentals. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    PASSWORD UPDATED SUCCESSFULLY - BenzFlex Account
    
    Hello ${name},
    
    Your BenzFlex account password was successfully updated on ${new Date(timestamp).toLocaleString()}.
    
    UPDATE DETAILS:
    Time: ${new Date(timestamp).toLocaleString()}
    ${ipAddress ? `IP Address: ${ipAddress}` : ''}
    ${userAgent ? `Device: ${userAgent}` : ''}
    
    If you made this change:
    • You can now sign in with your new password
    • Your account security has been updated
    • All your active sessions remain logged in
    
    If you didn't make this change, please contact our security team immediately at security@benzflex.com
    
    ---
    BenzFlex Security Team
    This is an automated security notification.
    © ${new Date().getFullYear()} BenzFlex Luxury Car Rentals. All rights reserved.
  `;

  return this.sendEmail({
    to: email,
    from: this.senders.security,
    subject,
    text,
    html,
  });
}

  // Rental Reminder Email - from concierge
  async sendRentalReminder(reminderData) {
    const {
      customerEmail,
      customerName,
      vehicleModel,
      pickupDate,
      pickupLocation,
    } = reminderData;

    const subject = `Reminder: Your ${vehicleModel} Rental Tomorrow`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Get Ready for Your Luxury Experience! 🚗</h2>
        <p>Hello ${customerName},</p>
        <p>This is a friendly reminder about your upcoming BenzFlex rental:</p>
        
        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Vehicle:</strong> ${vehicleModel}</p>
          <p><strong>Pickup Date:</strong> ${pickupDate}</p>
          <p><strong>Location:</strong> ${pickupLocation}</p>
        </div>
        
        <p>Your concierge will contact you 2 hours before delivery with exact timing.</p>
        <p>We look forward to providing you with an exceptional luxury experience!</p>
      </div>
    `;

    return this.sendEmail({
      to: customerEmail,
      from: this.senders.concierge,
      subject,
      html,
    });
  }

  // Support/Contact Response - from support
  async sendSupportResponse(supportData) {
    const { customerEmail, customerName, ticketId, message, supportAgent } =
      supportData;

    const subject = `Re: Your BenzFlex Support Request #${ticketId}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Support Request Update</h2>
        <p>Dear ${customerName},</p>
        <p>Thank you for contacting BenzFlex support. Here's an update on your request:</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Support Agent:</strong> ${supportAgent}</p>
          <p><strong>Ticket ID:</strong> ${ticketId}</p>
          <p>${message}</p>
        </div>
        
        <p>If you have any further questions, please reply to this email.</p>
        <p>Best regards,<br>The BenzFlex Team</p>
      </div>
    `;

    return this.sendEmail({
      to: customerEmail,
      from: this.senders.support,
      subject,
      html,
    });
  }
// Password Reset Success Confirmation - from security
async sendPasswordResetSuccess(confirmationData) {
  const {
    email,
    name,
    timestamp = new Date(),
    // ipAddress,
    // userAgent
  } = confirmationData;

  // Validate required fields
  if (!email || !name) {
    throw new Error('Missing required fields: email and name are required');
  }

  const subject = `Password Updated Successfully - BenzFlex Account`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: bold;
        }
        .content {
          background: #ffffff;
          padding: 30px;
          border: 1px solid #e5e5e5;
          border-top: none;
          border-radius: 0 0 10px 10px;
        }
        .success-icon {
          color: #28a745;
          font-size: 48px;
          text-align: center;
          margin: 20px 0;
        }
        .security-info {
          background: #e8f5e8;
          border: 1px solid #c3e6cb;
          padding: 15px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e5e5;
          font-size: 12px;
          color: #6c757d;
        }
        .warning {
          color: #dc3545;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>BenzFlex</h1>
        <div style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px; letter-spacing: 2px;">
          SECURITY NOTIFICATION
        </div>
      </div>
      
      <div class="content">
        <div class="success-icon">
          ✓
        </div>
        
        <h2 style="color: #28a745; text-align: center; margin-top: 0;">
          Password Updated Successfully
        </h2>
        
        <p>Hello ${name},</p>
        
        <p>Your BenzFlex account password was successfully updated on ${new Date(timestamp).toLocaleString()}.</p>
        
        <div class="security-info">
          <strong>Update Details:</strong>
          <br>Time: ${new Date(timestamp).toLocaleString()}
         
        </div>

        <p><strong>If you made this change:</strong></p>
        <ul>
          <li>You can now sign in with your new password</li>
          <li>Your account security has been updated</li>
          <li>All your active sessions remain logged in</li>
        </ul>

        <p class="warning">
          If you didn't make this change, please contact our security team immediately at 
          <a href="mailto:security@benzflex.com" style="color: #dc3545;">security@benzflex.com</a>
        </p>

        <div class="footer">
          <p><strong>BenzFlex Security Team</strong></p>
          <p>This is an automated security notification. Please do not reply to this email.</p>
          <p>© ${new Date().getFullYear()} BenzFlex Luxury Car Rentals. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    PASSWORD UPDATED SUCCESSFULLY - BenzFlex Account
    
    Hello ${name},
    
    Your BenzFlex account password was successfully updated on ${new Date(timestamp).toLocaleString()}.
    
    UPDATE DETAILS:
    Time: ${new Date(timestamp).toLocaleString()}
  
    
    If you made this change:
    • You can now sign in with your new password
    • Your account security has been updated
    • All your active sessions remain logged in
    
    If you didn't make this change, please contact our security team immediately at security@benzflex.com
    
    ---
    BenzFlex Security Team
    This is an automated security notification.
    © ${new Date().getFullYear()} BenzFlex Luxury Car Rentals. All rights reserved.
  `;

  try {
    return await this.sendEmail({
      to: email,
      from: this.senders.security,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error('Failed to send password reset success email:', error);
    throw new Error(`Failed to send password reset confirmation: ${error.message}`);
  }
}
  // Marketing/Newsletter Email - from noreply
  async sendNewsletter(newsletterData) {
    const { customerEmail, customerName, content } = newsletterData;

    const subject = `Exclusive Luxury Offers - BenzFlex`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Exclusive Luxury Offers</h2>
        <p>Dear ${customerName},</p>
        <p>${content}</p>
        <p>Discover our latest luxury vehicles and special promotions.</p>
      </div>
    `;

    return this.sendEmail({
      to: customerEmail,
      from: this.senders.noreply,
      subject,
      html,
    });
  }
   async sendSignupOTP(signupData) {
    const {
      email,
      name,
      otpCode,
      expiryMinutes = 10,
    } = signupData;

    const subject = `Welcome to BenzFlex! Verify Your Account`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            padding: 40px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 32px;
            font-weight: bold;
          }
          .header .subtitle {
            color: #d4af37;
            margin: 10px 0 0 0;
            font-size: 16px;
            letter-spacing: 3px;
          }
          .content {
            background: #ffffff;
            padding: 40px;
            border: 1px solid #e5e5e5;
            border-top: none;
            border-radius: 0 0 10px 10px;
          }
          .welcome-message {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 25px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: center;
          }
          .otp-container {
            background: #1a1a1a;
            color: #ffffff;
            padding: 25px;
            text-align: center;
            border-radius: 8px;
            margin: 30px 0;
            font-family: 'Courier New', monospace;
          }
          .otp-code {
            font-size: 42px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #d4af37;
            margin: 15px 0;
          }
          .expiry-notice {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-left: 4px solid #fdcb6e;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .next-steps {
            background: #e8f5e8;
            border: 1px solid #c3e6cb;
            padding: 20px;
            margin: 25px 0;
            border-radius: 8px;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
            color: #ffffff;
            padding: 15px 35px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0;
            text-align: center;
          }
          .security-note {
            background: #ffeaa7;
            border: 1px solid #fdcb6e;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            font-size: 14px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 25px;
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            color: #6c757d;
            text-align: center;
          }
          .features {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin: 25px 0;
          }
          .feature {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            text-align: center;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BenzFlex</h1>
          <div class="subtitle">LUXURY CAR RENTALS</div>
        </div>
        
        <div class="content">
          <div class="welcome-message">
            <h2 style="color: #1a1a1a; margin-top: 0;">Welcome to BenzFlex, ${name}! 🎉</h2>
            <p style="font-size: 16px; margin: 10px 0;">We're thrilled to have you join our community of luxury car enthusiasts.</p>
          </div>

          <p>To complete your registration and start exploring our premium fleet, please verify your account using the OTP code below:</p>
          
          <div class="otp-container">
            <div style="color: #d4af37; font-size: 14px; margin-bottom: 10px;">YOUR VERIFICATION CODE</div>
            <div class="otp-code">${otpCode}</div>
            <div style="color: #a0a0a0; font-size: 12px; margin-top: 10px;">Valid for ${expiryMinutes} minutes</div>
          </div>

          <div class="expiry-notice">
            <strong>⚠️ Important:</strong> This code will expire in <strong>${expiryMinutes} minutes</strong>. 
            Please use it promptly to verify your account.
          </div>

          <div class="security-note">
            <strong>Security Tip:</strong> Never share this code with anyone. BenzFlex team will never ask for your verification code.
          </div>

          <div class="next-steps">
            <h3 style="color: #28a745; margin-top: 0;">What's Next?</h3>
            <p>After verification, you'll be able to:</p>
            <div class="features">
              <div class="feature">🚗 Browse Luxury Fleet</div>
              <div class="feature">📅 Make Reservations</div>
              <div class="feature">⭐ Save Favorites</div>
              <div class="feature">💎 Access Premium Deals</div>
            </div>
          </div>

          <p style="text-align: center;">
            <strong>Ready to experience luxury driving?</strong><br>
            Verify your account and start your journey with BenzFlex!
          </p>

          <div class="footer">
            <p><strong>BenzFlex Welcome Team</strong></p>
            <p>Experience the pinnacle of luxury car rentals</p>
            <p>Need help? Contact our concierge: 
              <a href="mailto:concierge@benzflex.com" style="color: #d4af37;">concierge@benzflex.com</a>
            </p>
            <p>© ${new Date().getFullYear()} BenzFlex Luxury Car Rentals. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      WELCOME TO BENZFLEX - ACCOUNT VERIFICATION
      
      Hello ${name},
      
      Welcome to BenzFlex! We're thrilled to have you join our community of luxury car enthusiasts.
      
      To complete your registration and start exploring our premium fleet, please verify your account using this OTP code:
      
      VERIFICATION CODE: ${otpCode}
      
      This code will expire in ${expiryMinutes} minutes. Please use it promptly.
      
      SECURITY TIP: Never share this code with anyone. BenzFlex team will never ask for your verification code.
      
      After verification, you'll be able to:
      • Browse our luxury fleet
      • Make reservations
      • Save favorite vehicles
      • Access premium deals and offers
      
      Ready to experience luxury driving? Verify your account and start your journey with BenzFlex!
      
      ---
      BenzFlex Welcome Team
      Experience the pinnacle of luxury car rentals
      Need help? Contact our concierge: concierge@benzflex.com
      © ${new Date().getFullYear()} BenzFlex Luxury Car Rentals. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      from: this.senders.welcome,
      subject,
      text,
      html,
    });
  }

  // Account Verification Success Email
  async sendVerificationSuccess(verificationData) {
    const {
      email,
      name,
    } = verificationData;

    const subject = `Account Verified! Start Your Luxury Journey with BenzFlex`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            padding: 40px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 32px;
            font-weight: bold;
          }
          .content {
            background: #ffffff;
            padding: 40px;
            border: 1px solid #e5e5e5;
            border-top: none;
            border-radius: 0 0 10px 10px;
          }
          .success-icon {
            color: #28a745;
            font-size: 60px;
            text-align: center;
            margin: 20px 0;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
            color: #ffffff;
            padding: 15px 35px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0;
            text-align: center;
          }
          .features {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin: 25px 0;
          }
          .feature {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            text-align: center;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BenzFlex</h1>
          <div style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; letter-spacing: 3px;">
            ACCOUNT VERIFIED
          </div>
        </div>
        
        <div class="content">
          <div class="success-icon">
            ✅
          </div>
          
          <h2 style="color: #28a745; text-align: center; margin-top: 0;">
            Account Successfully Verified!
          </h2>
          
          <p>Congratulations, ${name}! Your BenzFlex account has been successfully verified.</p>
          
          <p>You now have full access to our luxury fleet and premium services. Get ready to experience driving redefined.</p>

          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL}/cars" class="cta-button">
              Explore Luxury Fleet
            </a>
          </div>

          <h3>What You Can Do Now:</h3>
          <div class="features">
            <div class="feature">🚗 Browse Premium Vehicles</div>
            <div class="feature">📅 Make Instant Bookings</div>
            <div class="feature">⭐ Save Favorite Cars</div>
            <div class="feature">💎 Access Member Deals</div>
            <div class="feature">📱 Manage Bookings</div>
            <div class="feature">🎯 Get Personal Recommendations</div>
          </div>

          <p><strong>Need assistance?</strong> Our concierge team is here to help you choose the perfect vehicle for your needs.</p>

          <div style="text-align: center; margin-top: 30px;">
            <p>Welcome to the BenzFlex family! 🎉</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      ACCOUNT VERIFIED - WELCOME TO BENZFLEX!
      
      Congratulations, ${name}!
      
      Your BenzFlex account has been successfully verified.
      
      You now have full access to our luxury fleet and premium services. 
      Get ready to experience driving redefined.
      
      WHAT YOU CAN DO NOW:
      • Browse our premium vehicle collection
      • Make instant bookings
      • Save your favorite cars
      • Access exclusive member deals
      • Manage your bookings easily
      • Get personalized recommendations
      
      Start your luxury journey: ${process.env.CLIENT_URL}/cars
      
      Need assistance? Our concierge team is here to help you choose the perfect vehicle.
      
      Welcome to the BenzFlex family! 🎉
    `;

    return this.sendEmail({
      to: email,
      from: this.senders.welcome,
      subject,
      text,
      html,
    });
  }

  // ... [Keep all your existing email methods - booking confirmation, OTP verification, etc.]

  // OTP Verification Email - from security (keep existing but now for general OTP)
  async sendOTPVerification({
    email,
    name,
    otpCode,
    purpose = "account verification",
  }) {
    const subject = `Your BenzFlex Verification Code: ${otpCode}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">BenzFlex Security Verification</h2>
        <p>Hello ${name},</p>
        <p>Your verification code for ${purpose} is:</p>
        <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
          ${otpCode}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p><strong>For security, never share this code with anyone.</strong></p>
        <hr>
        <p style="color: #6b7280; font-size: 12px;">
          If you didn't request this code, please ignore this email or contact support.
        </p>
      </div>
    `;

    const text = `
      BenzFlex Security Verification
      
      Hello ${name},
      
      Your verification code for ${purpose} is: ${otpCode}
      
      This code will expire in 10 minutes.
      For security, never share this code with anyone.
      
      If you didn't request this code, please ignore this email.
    `;

    return this.sendEmail({
      to: email,
      from: this.senders.security,
      subject,
      text,
      html,
    });
  }
   async sendProfileUpdateConfirmation(profileData) {
    const {
      email,
      name,
      updatedFields = [],
      timestamp = new Date(),
      ipAddress,
      userAgent,
    } = profileData;

    const subject = `Profile Updated Successfully - BenzFlex Account`;

    // Format the updated fields for display
    const formatFieldName = (field) => {
      const fieldMap = {
        fullName: "Full Name",
        phone: "Phone Number",
        email: "Email Address",
        dateOfBirth: "Date of Birth",
        address: "Address",
        avatar: "Profile Picture",
        bio: "Bio",
        preferences: "Account Preferences",
        license: "Driver's License",
      };
      return fieldMap[field] || field;
    };

    const hasSecurityFields = updatedFields.some(field => 
      ['email', 'phone', 'password'].includes(field)
    );

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 28px;
            font-weight: bold;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e5e5e5;
            border-top: none;
            border-radius: 0 0 10px 10px;
          }
          .success-icon {
            color: #28a745;
            font-size: 48px;
            text-align: center;
            margin: 20px 0;
          }
          .update-details {
            background: #f8f9fa;
            border: 1px solid #e5e5e5;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
          }
          .update-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e5e5;
          }
          .update-item:last-child {
            border-bottom: none;
          }
          .field-name {
            font-weight: bold;
            color: #1a1a1a;
          }
          .security-alert {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-left: 4px solid #fdcb6e;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .activity-info {
            background: #e8f4fd;
            border: 1px solid #b8daff;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            font-size: 14px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            color: #6c757d;
          }
          .warning {
            color: #dc3545;
            font-weight: bold;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
            color: #ffffff;
            padding: 12px 25px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 15px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BenzFlex</h1>
          <div style="color: #d4af37; margin: 5px 0 0 0; font-size: 14px; letter-spacing: 2px;">
            ACCOUNT UPDATE CONFIRMATION
          </div>
        </div>
        
        <div class="content">
          <div class="success-icon">
            ✅
          </div>
          
          <h2 style="color: #28a745; text-align: center; margin-top: 0;">
            Profile Updated Successfully
          </h2>
          
          <p>Hello ${name},</p>
          
          <p>Your BenzFlex account profile has been successfully updated. Here's a summary of the changes:</p>

          <div class="update-details">
            <h3 style="margin-top: 0; color: #1a1a1a;">Updated Information</h3>
            ${updatedFields.length > 0 ? 
              updatedFields.map(field => `
                <div class="update-item">
                  <span class="field-name">${formatFieldName(field)}</span>
                  <span>Updated</span>
                </div>
              `).join('') : 
              '<p><em>Your profile information has been updated.</em></p>'
            }
          </div>

          <div class="activity-info">
            <strong>Activity Details:</strong>
            <br>Time: ${new Date(timestamp).toLocaleString()}
            ${ipAddress ? `<br>IP Address: ${ipAddress}` : ''}
            ${userAgent ? `<br>Device: ${userAgent}` : ''}
          </div>

          ${hasSecurityFields ? `
            <div class="security-alert">
              <strong>🔒 Security Notice:</strong>
              <p>You've updated sensitive account information. If you didn't make these changes, please contact our security team immediately.</p>
            </div>
          ` : ''}

          <div style="text-align: center;">
            <a href="${require("../services/helper").getFrontendUrl()}/profile" class="cta-button">
              View Updated Profile
            </a>
          </div>

          <p><strong>What's next?</strong></p>
          <ul>
            <li>Your changes are now active across all BenzFlex services</li>
            <li>You may need to re-login if you changed your email or password</li>
            <li>Any connected services will use your updated information</li>
          </ul>

          ${hasSecurityFields ? `
            <p class="warning">
              If you didn't make these changes, please contact our security team immediately at 
              <a href="mailto:security@benzflex.com" style="color: #dc3545;">security@benzflex.com</a>
            </p>
          ` : ''}

          <div class="footer">
            <p><strong>BenzFlex Account Team</strong></p>
            <p>This is an automated notification. Please do not reply to this email.</p>
            <p>For assistance with your account, contact our support team: 
              <a href="mailto:support@benzflex.com">support@benzflex.com</a>
            </p>
            <p>© ${new Date().getFullYear()} BenzFlex Luxury Car Rentals. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      PROFILE UPDATED SUCCESSFULLY - BenzFlex Account
      
      Hello ${name},
      
      Your BenzFlex account profile has been successfully updated.
      
      UPDATED INFORMATION:
      ${updatedFields.length > 0 ? 
        updatedFields.map(field => `• ${formatFieldName(field)} - Updated`).join('\n') : 
        'Your profile information has been updated.'
      }
      
      ACTIVITY DETAILS:
      Time: ${new Date(timestamp).toLocaleString()}
      ${ipAddress ? `IP Address: ${ipAddress}` : ''}
      ${userAgent ? `Device: ${userAgent}` : ''}
      
      ${hasSecurityFields ? `
      SECURITY NOTICE:
      You've updated sensitive account information. If you didn't make these changes, please contact our security team immediately.
      ` : ''}
      
      What's next?
      • Your changes are now active across all BenzFlex services
      • You may need to re-login if you changed your email or password
      • Any connected services will use your updated information
      
      View your updated profile: ${process.env.CLIENT_URL}/profile
      
      ${hasSecurityFields ? `
      If you didn't make these changes, please contact our security team immediately at security@benzflex.com
      ` : ''}
      
      ---
      BenzFlex Account Team
      This is an automated notification.
      For assistance with your account, contact our support team: support@benzflex.com
      © ${new Date().getFullYear()} BenzFlex Luxury Car Rentals. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      from: this.senders.account,
      subject,
      text,
      html,
    });
  }
  // Rental Completion Email - from concierge
async sendRentalCompletion(completionData) {
  console.log('Sending rental completion email with data:', completionData);
  const {
    customerEmail,
    customerName,
    vehicleModel,
    orderId,
    pickupDate,
    returnDate,
    totalDays,
    totalAmount,
    nextSteps = [],
    feedbackLink,
    rebookLink,
  } = completionData;

  const subject = `Your ${vehicleModel} Journey Complete - Thank You for Choosing BenzFlex!`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          padding: 40px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 32px;
          font-weight: bold;
        }
        .header .subtitle {
          color: #d4af37;
          margin: 10px 0 0 0;
          font-size: 16px;
          letter-spacing: 3px;
        }
        .content {
          background: #ffffff;
          padding: 40px;
          border: 1px solid #e5e5e5;
          border-top: none;
          border-radius: 0 0 10px 10px;
        }
        .thank-you-section {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 30px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: center;
        }
        .rental-summary {
          background: #f8f9fa;
          border: 1px solid #e5e5e5;
          padding: 25px;
          margin: 25px 0;
          border-radius: 8px;
        }
        .summary-item {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e5e5e5;
        }
        .summary-item:last-child {
          border-bottom: none;
        }
        .summary-label {
          font-weight: bold;
          color: #1a1a1a;
        }
        .cta-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin: 30px 0;
        }
        .cta-button {
          display: inline-block;
          text-align: center;
          padding: 15px 20px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          font-size: 14px;
        }
        .feedback-btn {
          background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
          color: #ffffff;
        }
        .rebook-btn {
          background: #1a1a1a;
          color: #ffffff;
        }
        .next-steps {
          background: #e8f5e8;
          border: 1px solid #c3e6cb;
          padding: 25px;
          margin: 25px 0;
          border-radius: 8px;
        }
        .step-item {
          display: flex;
          align-items: flex-start;
          margin: 15px 0;
        }
        .step-number {
          background: #28a745;
          color: #ffffff;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          margin-right: 15px;
          flex-shrink: 0;
        }
        .loyalty-offer {
          background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
          border: 2px dashed #d4af37;
          padding: 20px;
          margin: 25px 0;
          border-radius: 8px;
          text-align: center;
        }
        .footer {
          margin-top: 40px;
          padding-top: 25px;
          border-top: 1px solid #e5e5e5;
          font-size: 12px;
          color: #6c757d;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>BenzFlex</h1>
        <div class="subtitle">LUXURY CAR RENTALS</div>
      </div>
      
      <div class="content">
        <div class="thank-you-section">
          <h2 style="color: #1a1a1a; margin-top: 0;">Thank You for Your Journey with BenzFlex! 🎉</h2>
          <p style="font-size: 16px; margin: 10px 0;">We hope you enjoyed driving the ${vehicleModel} as much as we enjoy providing exceptional experiences.</p>
        </div>

        <p>Hello ${customerName},</p>
        
        <p>Your luxury rental period has been successfully completed. We trust the ${vehicleModel} provided you with the premium driving experience we strive to deliver.</p>

        <div class="rental-summary">
          <h3 style="color: #1a1a1a; margin-top: 0; text-align: center;">Rental Summary</h3>
          <div class="summary-item">
            <span class="summary-label">Booking Reference:</span>
            <span>#${orderId}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Vehicle:</span>
            <span>${vehicleModel}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Rental Period:</span>
            <span>${totalDays} days</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Pickup Date:</span>
            <span>${pickupDate}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Return Date:</span>
            <span>${returnDate}</span>
          </div>
          <div class="summary-item" style="border-top: 2px solid #d4af37; padding-top: 15px; margin-top: 10px;">
            <span class="summary-label" style="font-size: 16px;">Total Amount:</span>
            <span style="font-size: 16px; font-weight: bold; color: #166534;">$${totalAmount}</span>
          </div>
        </div>

        ${nextSteps && nextSteps.length > 0 ? `
          <div class="next-steps">
            <h3 style="color: #28a745; margin-top: 0;">What's Next?</h3>
            ${nextSteps.map((step, index) => `
              <div class="step-item">
                <div class="step-number">${index + 1}</div>
                <div>${step}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="loyalty-offer">
          <h3 style="color: #b8941f; margin-top: 0;">🌟 Exclusive Loyalty Offer</h3>
          <p>As a valued BenzFlex customer, enjoy <strong>15% off</strong> your next rental when you book within 30 days!</p>
          <p style="font-size: 12px; margin: 10px 0 0 0;">Use code: <strong>LOYAL15</strong> at checkout</p>
        </div>

        <div class="cta-buttons">
          ${feedbackLink ? `
            <a href="${feedbackLink}" class="cta-button feedback-btn">
              Share Your Experience
            </a>
          ` : ''}
          ${rebookLink ? `
            <a href="${rebookLink}" class="cta-button rebook-btn">
              Book Next Adventure
            </a>
          ` : ''}
        </div>

        <p style="text-align: center; font-style: italic;">
          "Driving redefined, experiences unforgettable."
        </p>

        <div class="footer">
          <p><strong>BenzFlex Concierge Team</strong></p>
          <p>We're here to make every journey exceptional</p>
          <p>Ready for your next adventure? 
            <a href="mailto:concierge@benzflex.com" style="color: #d4af37;">concierge@benzflex.com</a>
          </p>
          <p>© ${new Date().getFullYear()} BenzFlex Luxury Car Rentals. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    RENTAL COMPLETE - THANK YOU FOR CHOOSING BENZFLEX!
    
    Hello ${customerName},
    
    Thank you for completing your luxury rental with BenzFlex! We hope you enjoyed driving the ${vehicleModel} and experienced the premium service we're known for.
    
    RENTAL SUMMARY:
    Booking Reference: #${orderId}
    Vehicle: ${vehicleModel}
    Rental Period: ${totalDays} days
    Pickup Date: ${pickupDate}
    Return Date: ${returnDate}
    Total Amount: $${totalAmount}
    
    ${nextSteps && nextSteps.length > 0 ? `
    WHAT'S NEXT?
    ${nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n    ')}
    ` : ''}
    
    🌟 EXCLUSIVE LOYALTY OFFER
    As a valued BenzFlex customer, enjoy 15% off your next rental when you book within 30 days!
    Use code: LOYAL15 at checkout
    
    ${feedbackLink ? `Share your experience: ${feedbackLink}` : ''}
    ${rebookLink ? `Book your next adventure: ${rebookLink}` : ''}
    
    "Driving redefined, experiences unforgettable."
    
    ---
    BenzFlex Concierge Team
    We're here to make every journey exceptional
    Ready for your next adventure? Contact: concierge@benzflex.com
    © ${new Date().getFullYear()} BenzFlex Luxury Car Rentals. All rights reserved.
  `;

  return this.sendEmail({
    to: customerEmail,
    from: this.senders.concierge,
    subject,
    text,
    html,
  });
}

  // Profile Update Alert for Security-Sensitive Changes
  async sendProfileSecurityAlert(alertData) {
    const {
      email,
      name,
      changedField,
      oldValue,
      newValue,
      timestamp = new Date(),
      ipAddress,
      userAgent,
    } = alertData;

    const subject = `Security Alert: ${changedField} Changed - BenzFlex Account`;

    const formatFieldName = (field) => {
      const fieldMap = {
        email: "Email Address",
        phone: "Phone Number",
        password: "Password",
      };
      return fieldMap[field] || field;
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 28px;
            font-weight: bold;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e5e5e5;
            border-top: none;
            border-radius: 0 0 10px 10px;
          }
          .alert-icon {
            color: #dc3545;
            font-size: 48px;
            text-align: center;
            margin: 20px 0;
          }
          .security-alert {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            border-left: 4px solid #dc3545;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .change-details {
            background: #f8f9fa;
            border: 1px solid #e5e5e5;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
          }
          .change-item {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
          }
          .activity-info {
            background: #e8f4fd;
            border: 1px solid #b8daff;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            font-size: 14px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            color: #6c757d;
          }
          .action-button {
            display: inline-block;
            background: #dc3545;
            color: #ffffff;
            padding: 12px 25px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 15px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BenzFlex</h1>
          <div style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px; letter-spacing: 2px;">
            SECURITY ALERT
          </div>
        </div>
        
        <div class="content">
          <div class="alert-icon">
            🚨
          </div>
          
          <h2 style="color: #dc3545; text-align: center; margin-top: 0;">
            Security Alert: ${formatFieldName(changedField)} Changed
          </h2>
          
          <div class="security-alert">
            <strong>Important Security Notice</strong>
            <p>A sensitive account setting has been updated. Please review this change carefully.</p>
          </div>

          <p>Hello ${name},</p>
          
          <p>We detected a change to your account's ${formatFieldName(changedField).toLowerCase()}.</p>

          <div class="change-details">
            <h3 style="margin-top: 0; color: #1a1a1a;">Change Details</h3>
            <div class="change-item">
              <strong>Field Changed:</strong>
              <span>${formatFieldName(changedField)}</span>
            </div>
            ${oldValue ? `
            <div class="change-item">
              <strong>Previous Value:</strong>
              <span>${oldValue}</span>
            </div>
            ` : ''}
            ${newValue ? `
            <div class="change-item">
              <strong>New Value:</strong>
              <span>${newValue}</span>
            </div>
            ` : ''}
          </div>

          <div class="activity-info">
            <strong>Activity Details:</strong>
            <br>Time: ${new Date(timestamp).toLocaleString()}
            ${ipAddress ? `<br>IP Address: ${ipAddress}` : ''}
            ${userAgent ? `<br>Device: ${userAgent}` : ''}
          </div>

          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL}/security" class="action-button">
              Review Account Security
            </a>
          </div>

          <p><strong>If you made this change:</strong></p>
          <ul>
            <li>No further action is required</li>
            <li>Your account security has been updated</li>
            <li>You may need to use the new information to sign in</li>
          </ul>

          <p style="color: #dc3545; font-weight: bold;">
            If you didn't make this change, please contact our security team immediately at 
            <a href="mailto:security@benzflex.com" style="color: #dc3545;">security@benzflex.com</a>
            or call our security hotline.
          </p>

          <div class="footer">
            <p><strong>BenzFlex Security Team</strong></p>
            <p>This is an automated security alert. Please do not reply to this email.</p>
            <p>For immediate assistance, contact our security team: 
              <a href="mailto:security@benzflex.com">security@benzflex.com</a>
            </p>
            <p>© ${new Date().getFullYear()} BenzFlex Luxury Car Rentals. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      SECURITY ALERT: ${formatFieldName(changedField).toUpperCase()} CHANGED - BenzFlex Account
      
      🚨 Important Security Notice
      A sensitive account setting has been updated. Please review this change carefully.
      
      Hello ${name},
      
      We detected a change to your account's ${formatFieldName(changedField).toLowerCase()}.
      
      CHANGE DETAILS:
      Field Changed: ${formatFieldName(changedField)}
      ${oldValue ? `Previous Value: ${oldValue}` : ''}
      ${newValue ? `New Value: ${newValue}` : ''}
      
      ACTIVITY DETAILS:
      Time: ${new Date(timestamp).toLocaleString()}
      ${ipAddress ? `IP Address: ${ipAddress}` : ''}
      ${userAgent ? `Device: ${userAgent}` : ''}
      
      If you made this change:
      • No further action is required
      • Your account security has been updated
      • You may need to use the new information to sign in
      
      Review your account security: ${process.env.CLIENT_URL}/security
      
      If you didn't make this change, please contact our security team immediately at security@benzflex.com
      
      ---
      BenzFlex Security Team
      This is an automated security alert.
      For immediate assistance, contact our security team: security@benzflex.com
      © ${new Date().getFullYear()} BenzFlex Luxury Car Rentals. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      from: this.senders.security,
      subject,
      text,
      html,
    });
  }

  // Custom email with specified sender
  async sendCustomEmail(customData) {
    const {
      to,
      from = this.senders.bookings, // Allow custom from address
      subject,
      html,
      text,
    } = customData;

    return this.sendEmail({
      to,
      from,
      subject,
      html,
      text,
    });
  }
}

module.exports = new EmailService();
