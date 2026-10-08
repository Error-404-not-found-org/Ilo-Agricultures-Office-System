import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Beef, FileSpreadsheet, HeartPulse, Printer, Syringe } from "lucide-react";
import Topbar from "../../components/layout/Topbar";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import UnaipMonthlyForm from "./UnaipMonthlyForm";

const currentManilaMonth = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year").value}-${parts.find((part) => part.type === "month").value}`;
};

const serviceOptions = [
  { value: "ai", label: "Artificial Insemination", Icon: Syringe },
  { value: "pregnancy", label: "Pregnancy Diagnosis", Icon: HeartPulse },
  { value: "calving", label: "Calving", Icon: Beef },
];

export default function TechnicianReports() {
  const toast = useToast();
  const [selectedMonth, setSelectedMonth] = useState(currentManilaMonth);
  const [selectedService, setSelectedService] = useState("ai");
  const [isExporting, setIsExporting] = useState(false);
  const [reportYear, reportMonth] = selectedMonth.split("-");
  const hasSelectedMonth = Boolean(reportYear && reportMonth);
  const { data: officialMonthly, isPending, isError } = useQuery({
    queryKey: ["technician", "monthly-accomplishment", selectedMonth, selectedService],
    queryFn: async () => (await axiosInstance.get("/reports/monthly-accomplishment", {
      params: { month: Number(reportMonth), year: Number(reportYear), serviceType: selectedService },
    })).data,
    enabled: hasSelectedMonth,
  });
  const count = officialMonthly?.serviceType === selectedService &&
    Array.isArray(officialMonthly?.records) &&
    Number.isInteger(officialMonthly?.count) && officialMonthly.count >= 0 &&
    officialMonthly.count === officialMonthly.records.length
    ? officialMonthly.count : null;
  const selectedOption = serviceOptions.find((option) => option.value === selectedService);

  const printMonthlyForm = () => {
    const clearPrintMode = () => document.body.classList.remove("unaip-printing");
    document.body.classList.add("unaip-printing");
    window.addEventListener("afterprint", clearPrintMode, { once: true });
    try {
      window.print();
    } catch (error) {
      clearPrintMode();
      window.removeEventListener("afterprint", clearPrintMode);
      throw error;
    }
  };

  const exportExcel = async () => {
    if (isExporting || !officialMonthly) return;
    setIsExporting(true);
    try {
      const { downloadUnaipMonthlyWorkbook } = await import("./unaipMonthlyWorkbook");
      await downloadUnaipMonthlyWorkbook(officialMonthly, selectedMonth);
    } catch {
      toast.error("Could not export the monthly accomplishment. Try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content">
      <Topbar title="Reports & Documents" subtitle="Prepare and print your official monthly accomplishment reports." />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">
        <section className="card border border-base-300 bg-base-100 shadow-2xs" aria-labelledby="monthly-accomplishment-title">
          <div className="card-body gap-5">
            <div>
              <h2 id="monthly-accomplishment-title" className="card-title">Monthly Accomplishment</h2>
              <p className="text-sm text-base-content/70">Your completed Artificial Insemination, Pregnancy Diagnosis, and Calving records for the selected month.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex w-full flex-col gap-1 text-sm font-medium">
                Month
                <input className="input w-full" aria-label="Monthly accomplishment month" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
              </label>
              <label className="flex w-full flex-col gap-1 text-sm font-medium">
                Service Type
                <select className="select w-full" aria-label="Monthly accomplishment service type" value={selectedService} onChange={(event) => setSelectedService(event.target.value)}>
                  {serviceOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>

            {!hasSelectedMonth && <p>Choose a month to view official records.</p>}
            {hasSelectedMonth && isPending && <p role="status">Loading official monthly records…</p>}
            {isError && <p role="alert">Could not load the monthly accomplishment. Try again.</p>}
            {officialMonthly && count === null && <p role="alert">Monthly record count is unavailable. Try again.</p>}

            {officialMonthly && count !== null && (
              <>
                <div className="stats border border-base-300 border-l-4 border-l-primary/40 bg-base-100" role="group" aria-label={`${selectedOption.label}: ${count} ${count === 1 ? "record" : "records"}`}>
                  <div className="stat gap-1">
                    <div className="stat-figure rounded-lg bg-primary/10 p-2 text-primary"><selectedOption.Icon size={18} aria-hidden="true" /></div>
                    <div className="stat-title">{selectedOption.label} Records</div>
                    <div className="stat-value text-2xl font-semibold">{count}</div>
                  </div>
                </div>
                <p className="text-sm font-semibold">{count} official {count === 1 ? "record" : "records"}</p>
                {count === 0 && <p className="text-sm text-base-content/70">No completed services recorded for this month.</p>}
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="btn btn-primary" onClick={printMonthlyForm}><Printer size={16} /> Print Monthly Form</button>
                  <button type="button" className="btn btn-outline" onClick={exportExcel} disabled={isExporting}><FileSpreadsheet size={16} /> {isExporting ? "Exporting..." : "Export Excel"}</button>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      {officialMonthly && count !== null && createPortal(<div id="unaip-print-portal"><UnaipMonthlyForm report={officialMonthly} /></div>, document.body)}
    </div>
  );
}
