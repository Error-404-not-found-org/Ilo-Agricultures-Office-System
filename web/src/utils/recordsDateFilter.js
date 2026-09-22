const getManilaDateValue = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
};

export const getCurrentManilaMonth = (date = new Date()) =>
  getManilaDateValue(date).slice(0, 7);

export const isMonthValue = (value) =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(value || "");

export const getMonthBounds = (monthValue) => {
  if (!isMonthValue(monthValue)) return { fromDate: "", toDate: "" };
  const [year, month] = monthValue.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    fromDate: `${monthValue}-01`,
    toDate: `${monthValue}-${String(lastDay).padStart(2, "0")}`,
  };
};

const shiftMonth = (monthValue, offset) => {
  const [year, month] = monthValue.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
};

const addDateOnlyDays = (dateValue, offset) => {
  const [year, month, day] = dateValue.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + offset));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
};

export const RECORDS_DATE_PRESETS = new Set([
  "this-month",
  "last-month",
  "last-30-days",
]);

export const resolveRecordsDateFilter = (searchParams, now = new Date()) => {
  const month = searchParams.get("month") || "";
  const fromDate = searchParams.get("fromDate") || "";
  const toDate = searchParams.get("toDate") || "";
  if (isMonthValue(month)) {
    return { preset: "select-month", month, ...getMonthBounds(month) };
  }
  if (fromDate || toDate) {
    return { preset: "custom", month: "", fromDate, toDate };
  }

  const preset = searchParams.get("datePreset") || "all";
  const currentDate = getManilaDateValue(now);
  const currentMonth = currentDate.slice(0, 7);
  if (preset === "this-month") {
    return { preset, month: "", ...getMonthBounds(currentMonth) };
  }
  if (preset === "last-month") {
    return {
      preset,
      month: "",
      ...getMonthBounds(shiftMonth(currentMonth, -1)),
    };
  }
  if (preset === "last-30-days") {
    return {
      preset,
      month: "",
      fromDate: addDateOnlyDays(currentDate, -29),
      toDate: currentDate,
    };
  }
  return { preset: "all", month: "", fromDate: "", toDate: "" };
};
