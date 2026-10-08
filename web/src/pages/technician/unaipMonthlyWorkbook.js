import ExcelJS from "exceljs";
import { buildUnaipMonthlyRows } from "./unaipMonthlyRows";
import {
  formatUnaipMonth, getUnaipExtraCalves, getUnaipFormCells, toExcelManilaDate,
  UNAIP_AGENCY, UNAIP_FORM_NAME, UNAIP_HEADINGS, UNAIP_LEGEND_LINES,
  UNAIP_MIN_ROWS, UNAIP_MUNICIPALITY, UNAIP_PROGRAM, UNAIP_PROVINCE,
  UNAIP_REGION, UNAIP_REPORT_TITLE,
} from "./unaipMonthlyFormData";

const columns = [9, 6, 16, 14, 12, 12, 16, 12, 18, 24, 14, 10, 13, 16, 13, 14, 15, 14, 16, 14, 8, 14, 8, 16];
const dataStartRow = 12;
const border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };

export function unaipWorkbookFilename(selectedMonth) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)) throw new Error("Invalid monthly accomplishment month");
  return `BreedSmart_Accomplishment_${selectedMonth}.xlsx`;
}

export function buildUnaipMonthlyWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Monthly Accomplishment", {
    pageSetup: {
      orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.1, footer: 0.1 },
    },
  });
  columns.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });

  const mergedText = (range, text, size = 9) => {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(":")[0]);
    cell.value = text;
    cell.font = { name: "Arial", size, bold: true, color: { argb: "FF000000" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  };
  mergedText("A1:J1", UNAIP_FORM_NAME);
  mergedText("K1:X1", UNAIP_AGENCY);
  mergedText("A4:X4", UNAIP_PROGRAM, 12);
  mergedText("A5:X5", UNAIP_REPORT_TITLE, 11);
  mergedText("A6:X6", `For the Month of ${formatUnaipMonth(report.year, report.month)}`, 10);
  mergedText("A8:D8", UNAIP_REGION);
  mergedText("E8:H8", UNAIP_PROVINCE);
  mergedText("I8:L8", UNAIP_MUNICIPALITY);
  sheet.getRow(4).height = 20;
  sheet.getRow(6).height = 18;

  for (const [range, heading] of [
    ["A10:J10", "Animal Identification"],
    ["K10:O10", "Artificial Insemination"],
    ["P10:Q10", "Pregnancy Diagnosis"],
    ["R10:X10", "Calf Drop"],
  ]) mergedText(range, heading);
  UNAIP_HEADINGS.forEach((heading, index) => { sheet.getCell(11, index + 1).value = heading; });

  const rows = buildUnaipMonthlyRows(report);
  for (let rowIndex = 0; rowIndex < Math.max(UNAIP_MIN_ROWS, rows.length); rowIndex += 1) {
    const values = rows[rowIndex] ? getUnaipFormCells(rows[rowIndex], rowIndex, toExcelManilaDate) : Array(UNAIP_HEADINGS.length).fill("");
    values.forEach((value, index) => { sheet.getCell(dataStartRow + rowIndex, index + 1).value = value; });
    sheet.getRow(dataStartRow + rowIndex).height = 20;
  }

  const lastTableRow = dataStartRow + Math.max(UNAIP_MIN_ROWS, rows.length) - 1;
  for (let rowIndex = 10; rowIndex <= lastTableRow; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = border;
      cell.font = { name: "Arial", size: rowIndex <= 11 ? 8 : 9, bold: rowIndex <= 11, color: { argb: "FF000000" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: rowIndex <= 11 ? "center" : "left", wrapText: true };
    });
  }
  sheet.getRow(10).height = 20;
  sheet.getRow(11).height = 30;
  for (let rowIndex = dataStartRow; rowIndex <= lastTableRow; rowIndex += 1) {
    for (const columnIndex of [11, 16, 18]) sheet.getCell(rowIndex, columnIndex).numFmt = "mm/dd/yyyy";
  }

  let footerRow = lastTableRow + 2;
  for (const line of UNAIP_LEGEND_LINES) {
    mergedText(`A${footerRow}:X${footerRow}`, line, 8);
    sheet.getCell(footerRow, 1).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    sheet.getRow(footerRow).height = 24;
    footerRow += 1;
  }
  for (const calf of getUnaipExtraCalves(rows)) {
    mergedText(`A${footerRow}:X${footerRow}`, `Additional calf references: Row ${calf.row}: ${calf.label}`, 8);
    sheet.getCell(footerRow, 1).alignment = { horizontal: "left" };
    footerRow += 1;
  }
  mergedText(`A${footerRow + 2}:H${footerRow + 2}`, "Prepared by:");
  mergedText(`P${footerRow + 2}:X${footerRow + 2}`, "Noted by:");
  sheet.getCell(footerRow + 3, 1).value = "________________________";
  sheet.getCell(footerRow + 3, 16).value = "________________________";
  sheet.pageSetup.printArea = `A1:X${footerRow + 3}`;

  return workbook;
}

export async function downloadUnaipMonthlyWorkbook(report, selectedMonth) {
  const filename = unaipWorkbookFilename(selectedMonth);
  const workbook = buildUnaipMonthlyWorkbook(report);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
