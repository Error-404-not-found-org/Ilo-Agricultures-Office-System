import { isSunday, isBefore } from 'date-fns';

export const validateRequestTime = (preferredDate: Date, isHoliday: boolean) => {
  const now = new Date();

  // 1. Holiday Check
  if (isHoliday) {
    return { 
      isValid: false, 
      message: "The office is currently closed for a holiday. Requests are not being accepted at this time." 
    };
  }

  // 2. Sunday Check - Cannot schedule a visit on a Sunday
  if (isSunday(preferredDate)) {
    return { 
      isValid: false, 
      message: "Our office is closed on Sundays. Please choose a weekday or Saturday for your visit." 
    };
  }

  // 3. Past Time Check (cannot schedule a date/time that has already passed)
  if (isBefore(preferredDate, now)) {
    return {
      isValid: false,
      message: "You cannot schedule a visit for a time that has already passed."
    };
  }

  // 4. Same-Day Cutoff Check
  const isToday = preferredDate.toDateString() === now.toDateString();
  const currentHour = now.getHours();
  if (isToday && currentHour >= 17) {
    return {
      isValid: false,
      message: "Office hours have ended for today (5:00 PM cutoff). Please schedule your request for tomorrow or another upcoming date."
    };
  }

  // 5. Preferred Visit Time Window Check (Visit must be between 8 AM - 5:59 PM)
  const prefHour = preferredDate.getHours();
  if (prefHour < 8 || prefHour >= 18) {
    return { 
      isValid: false, 
      message: "Please choose a preferred visit time between 8:00 AM and 6:00 PM." 
    };
  }

  return { isValid: true };
};
