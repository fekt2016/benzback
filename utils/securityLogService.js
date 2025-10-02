// services/securityLogService.js
const SecurityLog = require("../models/securityLogModel");
const geoip = require("geoip-lite");
const UAParser = require("ua-parser-js");

class SecurityLogService {
  constructor() {
    this.parser = new UAParser();
  }

  async logEvent(eventData) {
    try {
      const {
        user,
        userTypeModel,
        eventType,
        severity = "info",
        status = "success",
        ipAddress,
        userAgent,
        resourceId,
        resourceType,
        description,
        metadata = {},
        sessionId,
        affectedUsers = [],
      } = eventData;

      // Parse device information
      let deviceInfo = {};
      let location = {};

      if (userAgent) {
        this.parser.setUA(userAgent);
        const result = this.parser.getResult();
        deviceInfo = {
          type: this.getDeviceType(result),
          browser: result.browser.name,
          os: result.os.name,
          platform: result.device.vendor,
        };
      }

      // Get location from IP
      if (ipAddress && ipAddress !== "::1" && ipAddress !== "127.0.0.1") {
        const geo = geoip.lookup(ipAddress);
        if (geo) {
          location = {
            country: geo.country,
            region: geo.region,
            city: geo.city,
            coordinates: {
              latitude: geo.ll[0],
              longitude: geo.ll[1],
            },
          };
        }
      }

      const logEntry = new SecurityLog({
        user,
        userTypeModel,
        eventType,
        severity,
        ipAddress,
        userAgent,
        location,
        deviceInfo,
        status,
        resourceId,
        resourceType,
        description,
        metadata,
        sessionId,
        affectedUsers,
      });

      await logEntry.save();

      // Trigger alerts for critical events
      if (severity === "critical") {
        await this.triggerAlert(logEntry);
      }

      return logEntry;
    } catch (error) {
      console.error("Failed to log security event:", error);
      // Fallback to console logging in case of database failure
      console.log("Security Event (fallback):", eventData);
    }
  }

  getDeviceType(uaResult) {
    if (uaResult.device.type === "mobile") return "mobile";
    if (uaResult.device.type === "tablet") return "tablet";
    if (uaResult.device.type === "smarttv") return "smarttv";
    if (uaResult.device.type === "console") return "console";
    return "desktop";
  }

  async triggerAlert(logEntry) {
    // Implement your alert system here (email, SMS, Slack, etc.)
    console.log("SECURITY ALERT:", {
      event: logEntry.eventType,
      severity: logEntry.severity,
      user: logEntry.user,
      timestamp: logEntry.createdAt,
      ip: logEntry.ipAddress,
    });

    // Example: Send email to admin
    // await sendEmailToAdmin('security-alert@yourapp.com', 'Security Alert', alertMessage);
  }

  // Specific event logging methods
  async logLogin(
    user,
    userTypeModel,
    ipAddress,
    userAgent,
    success,
    metadata = {}
  ) {
    return this.logEvent({
      user,
      userTypeModel,
      eventType: success ? "login_success" : "login_failure",
      severity: success ? "info" : "warning",
      status: success ? "success" : "failure",
      ipAddress,
      userAgent,
      description: success
        ? "User logged in successfully"
        : "Failed login attempt",
      metadata,
    });
  }

  async logPasswordChange(user, userTypeModel, ipAddress, success) {
    return this.logEvent({
      user,
      userTypeModel,
      eventType: "password_change",
      severity: "info",
      status: success ? "success" : "failure",
      ipAddress,
      description: success
        ? "Password changed successfully"
        : "Password change failed",
    });
  }

  async logProductUpdate(user, userTypeModel, productId, changes, ipAddress) {
    return this.logEvent({
      user,
      userTypeModel,
      eventType: "product_update",
      severity: "info",
      ipAddress,
      resourceId: productId,
      resourceType: "Product",
      description: "Product updated",
      metadata: { changes },
    });
  }

  async logOrderCreation(user, userTypeModel, orderId, amount, ipAddress) {
    return this.logEvent({
      user,
      userTypeModel,
      eventType: "order_create",
      severity: "info",
      ipAddress,
      resourceId: orderId,
      resourceType: "Order",
      description: `Order created with amount: ${amount}`,
      metadata: { amount },
    });
  }

  async logSuspiciousActivity(ipAddress, userAgent, eventType, description) {
    return this.logEvent({
      user: null,
      userTypeModel: "System",
      eventType,
      severity: "critical",
      status: "blocked",
      ipAddress,
      userAgent,
      description,
      metadata: { automated: true },
    });
  }
  async cleanupOldLogs() {
    try {
      const retentionDate = new Date();
      retentionDate.setDate(
        retentionDate.getDate() - SECURITY_LOG_RETENTION_DAYS
      );

      const result = await SecurityLog.deleteMany({
        createdAt: { $lt: retentionDate },
        severity: { $in: ["info", "warning"] }, // Keep critical errors longer
      });

      console.log(`Cleaned up ${result.deletedCount} old security logs`);

      // Log the cleanup operation
      await this.logEvent({
        userTypeModel: "System",
        eventType: "system_maintenance",
        severity: "info",
        status: "success",
        description: `Automated security log cleanup completed`,
        metadata: { deletedCount: result.deletedCount },
      });

      return result;
    } catch (error) {
      console.error("Security log cleanup error:", error);
      throw error;
    }
  }
  // Manual log deletion with admin authorization
  async deleteLogsByCriteria(criteria, adminUser) {
    try {
      // Prevent deletion of recent critical logs
      const safeCriteria = {
        ...criteria,
        createdAt: {
          $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Older than 7 days
        },
        severity: { $ne: "critical" },
      };

      const logsToDelete = await SecurityLog.find(safeCriteria);
      const deleteResult = await SecurityLog.deleteMany(safeCriteria);

      // Log the deletion operation
      await this.logEvent({
        user: adminUser._id,
        userTypeModel: "Admin",
        eventType: "data_deletion",
        severity: "info",
        status: "success",
        description: "Security logs deleted by admin",
        metadata: {
          criteria: safeCriteria,
          deletedCount: deleteResult.deletedCount,
          admin: adminUser.email,
        },
      });

      return deleteResult;
    } catch (error) {
      await this.logEvent({
        user: adminUser?._id,
        userTypeModel: "Admin",
        eventType: "data_deletion",
        severity: "error",
        status: "failure",
        description: "Failed to delete security logs",
        metadata: { error: error.message },
      });
      throw error;
    }
  }
  async archiveOldLogs() {
    try {
      const archiveDate = new Date();
      archiveDate.setDate(archiveDate.getDate() - SECURITY_LOG_RETENTION_DAYS);

      // Find logs to archive
      const logsToArchive = await SecurityLog.find({
        createdAt: { $lt: archiveDate },
      });

      if (logsToArchive.length === 0) {
        return { archived: 0 };
      }

      // Here you would:
      // 1. Export to compressed file (JSON, CSV)
      // 2. Upload to cloud storage (S3, Google Cloud Storage)
      // 3. Then delete from database

      const archiveResult = await SecurityLog.deleteMany({
        _id: { $in: logsToArchive.map((log) => log._id) },
      });

      // Log the archiving operation
      await this.logEvent({
        userTypeModel: "System",
        eventType: "system_maintenance",
        severity: "info",
        status: "success",
        description: "Security logs archived",
        metadata: {
          archivedCount: archiveResult.deletedCount,
          archiveDate: archiveDate.toISOString(),
        },
      });

      return archiveResult;
    } catch (error) {
      console.error("Log archiving error:", error);
      throw error;
    }
  }
}

module.exports = new SecurityLogService();
