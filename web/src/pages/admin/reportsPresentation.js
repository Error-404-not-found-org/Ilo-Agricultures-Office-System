export const getCurrentReportMonth = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const formatReportCount = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count.toLocaleString() : "—";
};
