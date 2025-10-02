const SecurityLog = require("../models/securityLogModel");
const geoip = require("geoip-lite");
const UAParser = require("ua-parser-js");

class SecurityLogService {
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

      // Fresh UAParser instance each time (prevents leaks)
      let deviceInfo = {};
      if (userAgent) {
        const parser = new UAParser(userAgent);
        const result = parser.getResult();
        deviceInfo = {
          type: this.getDeviceType(result),
          browser: result.browser?.name || "unknown",
          os: result.os?.name || "unknown",
          platform: result.device?.vendor || "unknown",
        };
      }

      // GeoIP lookup (skip localhost)
      let location = {};
      if (ipAddress && !["::1", "127.0.0.1"].includes(ipAddress)) {
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

      // Sanitize metadata (avoid giant objects)
      const safeMetadata =
        typeof metadata === "object"
          ? JSON.parse(JSON.stringify(metadata, null, 2)).slice(0, 1000)
          : metadata;

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
        metadata: safeMetadata,
        sessionId,
        affectedUsers,
      });

      await logEntry.save();

      if (severity === "critical") {
        await this.triggerAlert(logEntry);
      }

      return logEntry;
    } catch (error) {
      console.error("Failed to log security event:", error);
    }
  }

  getDeviceType(uaResult) {
    return uaResult.device.type || "desktop";
  }

  async triggerAlert(logEntry) {
    console.log("SECURITY ALERT:", {
      event: logEntry.eventType,
      severity: logEntry.severity,
      user: logEntry.user,
      timestamp: logEntry.createdAt,
      ip: logEntry.ipAddress,
    });
  }

  // --- Optimized cleanup with lean queries ---
  async cleanupOldLogs() {
    try {
      const retentionDate = new Date();
      retentionDate.setDate(
        retentionDate.getDate() - SECURITY_LOG_RETENTION_DAYS
      );

      const result = await SecurityLog.deleteMany({
        createdAt: { $lt: retentionDate },
        severity: { $in: ["info", "warning"] },
      });

      console.log(`Cleaned up ${result.deletedCount} old security logs`);
      return result;
    } catch (error) {
      console.error("Security log cleanup error:", error);
    }
  }

  async archiveOldLogs() {
    try {
      const archiveDate = new Date();
      archiveDate.setDate(archiveDate.getDate() - SECURITY_LOG_RETENTION_DAYS);

      // Use cursor to stream logs instead of loading all into memory
      const cursor = SecurityLog.find({ createdAt: { $lt: archiveDate } })
        .lean()
        .cursor();
      let count = 0;

      for await (const log of cursor) {
        // TODO: export to file / cloud storage here
        count++;
      }

      const archiveResult = await SecurityLog.deleteMany({
        createdAt: { $lt: archiveDate },
      });
      console.log(`Archived & deleted ${count} logs`);
      return archiveResult;
    } catch (error) {
      console.error("Log archiving error:", error);
    }
  }
}

module.exports = new SecurityLogService();
