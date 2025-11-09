// src/utils/dateTimeUtils.js
import { format, formatInTimeZone, toZonedTime } from 'date-fns-tz';

// USA Time Zones - Major cities where you might operate
export const USA_TIME_ZONES = {
  eastern: 'America/New_York',
  central: 'America/Chicago',      // St. Louis is in Central Time
  mountain: 'America/Denver',
  pacific: 'America/Los_Angeles',
  alaska: 'America/Anchorage',
  hawaii: 'Pacific/Honolulu'
};

// Default time zone - set based on your primary location
export const DEFAULT_TIME_ZONE = USA_TIME_ZONES.central; // St. Louis

// Format dates for display in local time
export const formatLocalDate = (date, formatStr = 'MMM d, yyyy') => {
  return format(date, formatStr);
};

// Format dates for display in specific time zone
export const formatDateInTimeZone = (date, timeZone = DEFAULT_TIME_ZONE, formatStr = 'MMM d, yyyy') => {
  return formatInTimeZone(date, timeZone, formatStr);
};

// Convert to specific time zone
export const toTimeZone = (date, timeZone = DEFAULT_TIME_ZONE) => {
  return toZonedTime(date, timeZone);
};

// Get current time in specific time zone
export const getCurrentTimeInZone = (timeZone = DEFAULT_TIME_ZONE) => {
  return toZonedTime(new Date(), timeZone);
};

// Calculate business hours (9 AM - 6 PM local time)
export const isWithinBusinessHours = (date, timeZone = DEFAULT_TIME_ZONE) => {
  const zonedDate = toZonedTime(date, timeZone);
  const hours = zonedDate.getHours();
  return hours >= 9 && hours < 18;
};

// Date validation for USA (consider time zones)
export const isValidUSBookingDate = (date, timeZone = DEFAULT_TIME_ZONE) => {
  const now = getCurrentTimeInZone(timeZone);
  const minDate = new Date(now);
  minDate.setHours(0, 0, 0, 0);
  
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + 365); // 1 year in advance
  
  return date >= minDate && date <= maxDate;
};