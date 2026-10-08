import { buildUnaipMonthlyRows } from "./unaipMonthlyRows";
import {
  formatUnaipMonth, getUnaipExtraCalves, getUnaipFormCells,
  UNAIP_AGENCY, UNAIP_FORM_NAME, UNAIP_HEADINGS, UNAIP_LEGEND_LINES,
  UNAIP_MIN_ROWS, UNAIP_MUNICIPALITY, UNAIP_PROGRAM, UNAIP_PROVINCE,
  UNAIP_REGION, UNAIP_REPORT_TITLE,
} from "./unaipMonthlyFormData";
import "./unaipMonthlyForm.css";

const display = (value) => value === null || value === undefined ? "" : String(value);

export default function UnaipMonthlyForm({ report }) {
  const rows = buildUnaipMonthlyRows(report);
  const extraCalves = getUnaipExtraCalves(rows);
  return (
    <article id="unaip-monthly-print" className="unaip-form" aria-label="UNAIP monthly accomplishment print form">
      <div className="unaip-topline"><span>{UNAIP_FORM_NAME}</span><span>{UNAIP_AGENCY}</span></div>
      <div className="unaip-heading">
        <div>{UNAIP_REGION}<br />{UNAIP_PROVINCE}<br />{UNAIP_MUNICIPALITY}</div>
        <div><strong>{UNAIP_PROGRAM}</strong><br />{UNAIP_REPORT_TITLE}<br />For the Month of {formatUnaipMonth(report.year, report.month)}</div>
      </div>
      <table className="unaip-table">
        <thead>
          <tr><th colSpan="10">Animal Identification</th><th colSpan="5">Artificial Insemination</th><th colSpan="2">Pregnancy Diagnosis</th><th colSpan="7">Calf Drop</th></tr>
          <tr>{UNAIP_HEADINGS.map((heading, index) => <th key={`${heading}-${index}`}>{heading}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => <tr key={`${row.ai?.recordId ?? ""}-${row.pd?.recordId ?? ""}-${row.calving?.recordId ?? ""}-${index}`}>{getUnaipFormCells(row, index).map((value, cell) => <td key={cell}>{display(value)}</td>)}</tr>)}
          {Array.from({ length: Math.max(0, UNAIP_MIN_ROWS - rows.length) }, (_, index) => <tr key={`blank-${index}`}>{UNAIP_HEADINGS.map((_, cell) => <td key={cell}>&nbsp;</td>)}</tr>)}
        </tbody>
      </table>
      {extraCalves.length > 0 && <p className="unaip-extra-calves">Additional calf references: {extraCalves.map((calf) => `Row ${calf.row}: ${calf.label}`).join("; ")}</p>}
      <div className="unaip-footer">
        <p>{UNAIP_LEGEND_LINES[0]}<br />{UNAIP_LEGEND_LINES[1]}</p>
        <div className="unaip-signatures"><div>Prepared by:<br /><span>________________________</span></div><div>Noted by:<br /><span>________________________</span></div></div>
      </div>
    </article>
  );
}
