const manilaDateParts = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(parsed);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
};

export const formatManilaDate = (value) => {
  const parts = manilaDateParts(value);
  return parts ? `${parts.month}/${parts.day}/${parts.year}` : "";
};

export const toExcelManilaDate = (value) => {
  const parts = manilaDateParts(value);
  return parts ? new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))) : "";
};

export const formatUnaipMonth = (year, month) => new Intl.DateTimeFormat("en-PH", {
  month: "long", year: "numeric",
}).format(new Date(Number(year), Number(month) - 1, 1));

export const UNAIP_HEADINGS = [
  "Data", "No.", "Animal ID No.", "Ear Tag No.", "Brand", "Species", "Breed", "Color", "Address", "Farmer",
  "Date", "No. of AI", "Estrus", "Sire Breed", "Sire Code",
  "Date", "Result",
  "Date", "No. of Calving", "Calf ID No.", "Sex", "Calf ID No.", "Sex", "Calving Ease",
];
export const UNAIP_MIN_ROWS = 16;
export const UNAIP_FORM_NAME = "UNAIP Form No. 2 (Revised)";
export const UNAIP_AGENCY = "Bureau of Animal Industry · Livestock Development Council";
export const UNAIP_PROGRAM = "UNIFIED NATIONAL ARTIFICIAL INSEMINATION PROGRAM";
export const UNAIP_REPORT_TITLE = "Monthly Accomplishment Report";
export const UNAIP_REGION = "Region VI";
export const UNAIP_PROVINCE = "Province ILOILO";
export const UNAIP_MUNICIPALITY = "Municipality OTON";
export const UNAIP_LEGEND_LINES = [
  "[ID] Color: dam's color · [AI] Estrus: Natural, Synchronize · [PD] Result: Pregnancy, Empty · [CD] Calving Ease: Abortion, Natural, Difficult, Stillbirth",
  "For twins, use both Calf ID No. / Sex pairs. Blank fields indicate unavailable or unconfirmed data.",
];

const cell = (value) => value === null || value === undefined ? "" : value;

export const getUnaipFormCells = (row, index, formatDate = formatManilaDate) => {
  const { ai, pd, calving } = row;
  const source = row.type === "AI" ? ai : row.type === "PD" ? pd : calving;
  const calves = calving?.calves ?? [];
  return [
    row.type,
    index + 1, source?.animalId, source?.earTag, source?.brand, source?.species, source?.breed, source?.color,
    source?.barangay, source?.farmerName,
    formatDate(ai?.serviceDate), ai?.attemptNumber, ai?.estrus, ai?.sireBreed, ai?.sireCode,
    formatDate(pd?.diagnosisDate), pd?.result,
    formatDate(calving?.calvingDate), "", // Office meaning of No. of Calving is unresolved.
    calves[0]?.earTag, calves[0]?.sex,
    calves[1]?.earTag, calves[1]?.sex,
    calving?.calvingEase,
  ].map(cell);
};

export const getUnaipExtraCalves = (rows) => rows.flatMap((row, index) =>
  (row.calving?.calves ?? []).slice(2).map((calf) => ({
    row: index + 1,
    label: `${cell(calf.earTag) || "Unidentified calf"} (${cell(calf.sex) || "sex unrecorded"})`,
  })));
