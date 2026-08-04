export const safeReportValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replace(/\r?\n|\r/g, " ").trim();
};

export const sanitizeFileName = (value, fallback = "BreedSmart_Report") => {
  const normalized = String(value || fallback)
    .split("")
    .map((char) => (char.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(char) ? "_" : char))
    .join("")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 140);
  return normalized || fallback;
};

export const buildCsv = (headers, rows, preamble = []) => {
  const encodeCell = (value) => `"${safeReportValue(value).replace(/"/g, '""')}"`;
  const headerLine = headers.map(encodeCell).join(",");
  const rowLines = rows.map((row) => row.map(encodeCell).join(","));
  return [...preamble.filter(Boolean), headerLine, ...rowLines].join("\n");
};

export const downloadCsv = ({ headers, rows, fileName, preamble = [] }) => {
  const csvContent = buildCsv(headers, rows, preamble);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${sanitizeFileName(fileName)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const ensureExportableRows = (rows, toast, message = "No report data available to export.") => {
  if (Array.isArray(rows) && rows.length > 0) return true;
  toast?.error?.(message);
  return false;
};
