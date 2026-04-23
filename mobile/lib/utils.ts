import { format, isSunday, setHours, setMinutes, isBefore, isAfter, isSameDay } from 'date-fns';

export const validateRequestTime = (preferredDate: Date, isHoliday: boolean) => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // 1. Sunday Check
  if (isSunday(now)) {
    return { 
      isValid: false, 
      message: "Our office is closed on Sundays. Please submit your request on a weekday or Saturday." 
    };
  }

  // 2. Holiday Check
  if (isHoliday) {
    return { 
      isValid: false, 
      message: "The office is currently closed for a holiday. Requests are not being accepted at this time." 
    };
  }

  // 3. Submission Window Check (Only if requesting for TODAY)
  if (isSameDay(preferredDate, now)) {
    // ASAP Check (Must be before 12 PM)
    if (currentHour >= 12) {
      return { 
        isValid: false, 
        message: "Same-day (ASAP) requests must be submitted before 12:00 PM. Please schedule for tomorrow or later." 
      };
    }
  }

  // 5. Preferred Visit Time Window Check (Visit must be between 8 AM - 6 PM)
  const prefHour = preferredDate.getHours();
  if (prefHour < 8 || prefHour >= 18) {
    return { 
      isValid: false, 
      message: "Please choose a preferred visit time between 8:00 AM and 6:00 PM." 
    };
  }

  return { isValid: true };
};
