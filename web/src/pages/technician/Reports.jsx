import React, { useState, useMemo } from "react";
import {
  FileText,
  Clock,
  HardDrive,
  AlertCircle,
  Download,
  Trash2,
  Play,
  CheckCircle,
  Settings,
  Calendar,
  Layers,
} from "lucide-react";
import Topbar from "../../components/ui/Topbar";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";

export default function FieldReports() {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilingStep, setCompilingStep] = useState("");
  
  // ---- REPORT GENERATOR STATE ----
  const [reportType, setReportType] = useState("breeding-audit");
  const [dateRange, setDateRange] = useState("30-days");
  const [barangay, setBarangay] = useState("all");
  const [format, setFormat] = useState("pdf");

  // ---- DYNAMIC AUTOMATED SCHEDULES ----
  const [schedules, setSchedules] = useState([
    { id: "S-1", name: "Weekly Health Bulletin to Admin", time: "Friday, 5:00 PM", active: true },
    { id: "S-2", name: "Monthly Breeding Ledger to Regional Office", time: "1st of Month, 8:00 AM", active: true },
    { id: "S-3", name: "Real-time Hotspot Alerts via SMS", time: "Instant on detection", active: false },
  ]);

  // ---- REPORT LIBRARY STATE ----
  const [reports, setReports] = useState([
    {
      id: "REP-2026-05",
      name: "Monthly Breeding Ledger Audit - May 2026",
      date: "May 30, 2026",
      size: "2.4 MB",
      format: "PDF",
      type: "Breeding Audit",
      status: "Published",
    },
    {
      id: "REP-2026-04",
      name: "Disease Outbreak Telemetry Log - San Miguel",
      date: "May 27, 2026",
      size: "820 KB",
      format: "PDF",
      type: "Health Summary",
      status: "Published",
    },
    {
      id: "REP-2026-03",
      name: "Farmer Engagement & Activities Summary - Q1",
      date: "May 15, 2026",
      size: "4.1 MB",
      format: "EXCEL",
      type: "Farmer Activities",
      status: "Published",
    },
    {
      id: "REP-2026-02",
      name: "Livestock Demographics Census Dataset",
      date: "May 02, 2026",
      size: "12.8 KB",
      format: "CSV",
      type: "Livestock Census",
      status: "Archived",
    },
  ]);

  const toggleSchedule = (id) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
    toast.success("Notification schedule updated.");
  };

  const handleGenerateReport = (e) => {
    e.preventDefault();
    if (isCompiling) return;

    setIsCompiling(true);
    const steps = [
      "Connecting to animal census database...",
      "Aggregating regional pregnancy diagnostic metrics...",
      "Verifying technician insemination ledger signatures...",
      "Compiling output layouts and styles...",
      "Publishing report token to ledger..."
    ];

    let currentStep = 0;
    setCompilingStep(steps[0]);

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setCompilingStep(steps[currentStep]);
      } else {
        clearInterval(interval);
        
        const typeLabels = {
          "breeding-audit": "Breeding Audit",
          "health-summary": "Health Summary",
          "farmer-activity": "Farmer Activities",
          "census": "Livestock Census"
        };

        const newReportName = `${typeLabels[reportType]} - ${
          barangay === "all" ? "Global" : barangay
        } (${dateRange === "7-days" ? "7d" : dateRange === "30-days" ? "30d" : "YTD"})`;

        const newReport = {
          id: `REP-2026-06-${Math.floor(Math.random() * 900) + 100}`,
          name: newReportName,
          date: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          }),
          size: `${(Math.random() * 3 + 0.5).toFixed(1)} MB`,
          format: format.toUpperCase(),
          type: typeLabels[reportType],
          status: "Published",
        };

        setReports((prev) => [newReport, ...prev]);
        setIsCompiling(false);
        setCompilingStep("");
        toast.success("Municipal report compiled and archived successfully!");
      }
    }, 600);
  };

  // ---- DYNAMIC DOCUMENT EXPORTER (PDF/EXCEL/CSV TELEMETRY STREAM) ----
  const handleDownloadReport = async (report) => {
    try {
      toast.info(`Fetching live data aggregates for: ${report.name}...`);
      
      // Pull live accomplishment metrics from database
      const now = new Date();
      const res = await axiosInstance.get(
        `/reports/monthly-accomplishment?month=${now.getMonth() + 1}&year=${now.getFullYear()}`
      );
      const data = res.data || [];
      
      if (data.length === 0) {
        return toast.error("Zero telemetry records located for selected month scope.");
      }

      // Build CSV output stream
      const headers = [
        "Record Date",
        "Animal Species",
        "Animal Breed",
        "Ear Tag",
        "Farmer Owner",
        "Service Scope",
        "AI Estrus Type",
        "AI Sire Code",
        "PD Outcome Result",
        "CD Calves Count"
      ];
      
      const rows = data.map((item) => [
        item.date ? new Date(item.date).toLocaleDateString() : "N/A",
        item.animal?.species || "N/A",
        item.animal?.breed || "N/A",
        item.animal?.earTag || "N/A",
        item.farmer?.name || "N/A",
        item.type || "N/A",
        item.ai?.estrus || "N/A",
        item.ai?.sireCode || "N/A",
        item.pd?.result || "N/A",
        item.cd?.count || "N/A"
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8," +
        headers.join(",") +
        "\n" +
        rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `DA_${report.name.replace(/\s+/g, "_")}_${new Date().toLocaleDateString()}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Document published to spreadsheet and downloaded successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to construct regional report spreadsheet.");
    }
  };

  const handleDeleteReport = (id) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
    toast.success("Report deleted from municipal archives.");
  };

  // ---- DYNAMIC FILTER PIPE ----
  const filteredReports = useMemo(() => {
    return reports.filter((r) =>
      [r.name, r.type, r.format].join(" ").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, reports]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Topbar
        title="Field Reports"
        subtitle="Compliance compilation, spatial telemetry logs, and officer audits"
        searchPlaceholder="Search compiled reports..."
        searchValue={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
      />

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0 font-sans">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Reports Compiled",
              val: `${reports.length} Records`,
              color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20",
              icon: <FileText size={16} />,
            },
            {
              label: "Schedules Configured",
              val: `${schedules.filter((s) => s.active).length} Active`,
              color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20",
              icon: <Clock size={16} />,
            },
            {
              label: "Cloud Storage",
              val: "7.3 MB / 100 MB",
              color: "text-purple-600 bg-purple-50 dark:bg-purple-950/20",
              icon: <HardDrive size={16} />,
            },
            {
              label: "Officer Inspections",
              val: "2 Pending",
              color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20",
              icon: <AlertCircle size={16} />,
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs hover:shadow-md transition-shadow"
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <div className="text-lg font-black tracking-tight">{stat.val}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Double-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left panel: Compiler form */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
              <Play size={13} className="text-[#00643b] dark:text-emerald-500" /> Report Compilation Engine
            </h3>

            {isCompiling ? (
              <div className="py-10 flex flex-col items-center justify-center space-y-4 text-center">
                <span className="loading loading-spinner loading-md text-[#00643b] dark:text-emerald-500" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Compiling Ledger Metrics</h4>
                  <p className="text-xs text-slate-400 font-mono italic animate-pulse">{compilingStep}</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGenerateReport} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label text-[10px] font-bold uppercase tracking-wider text-slate-400">Report Scope / Type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="select select-bordered select-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  >
                    <option value="breeding-audit">Breeding Ledger Audit</option>
                    <option value="health-summary">Health & Disease Outbreaks Summary</option>
                    <option value="farmer-activity">Farmer Engagement logs</option>
                    <option value="census">Livestock Demographics Census</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label text-[10px] font-bold uppercase tracking-wider text-slate-400">Time Interval</label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="select select-bordered select-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  >
                    <option value="7-days">Last 7 Days</option>
                    <option value="30-days">Last 30 Days</option>
                    <option value="ytd">Year-To-Date (YTD)</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label text-[10px] font-bold uppercase tracking-wider text-slate-400">Geographic Segment</label>
                  <select
                    value={barangay}
                    onChange={(e) => setBarangay(e.target.value)}
                    className="select select-bordered select-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  >
                    <option value="all">All Barangays</option>
                    <option value="San Miguel">San Miguel</option>
                    <option value="Santa Barbara">Santa Barbara</option>
                    <option value="Pavia">Pavia</option>
                    <option value="Oton">Oton</option>
                    <option value="Mandurriao">Mandurriao</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label text-[10px] font-bold uppercase tracking-wider text-slate-400">Output Export Layout</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="select select-bordered select-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  >
                    <option value="pdf">PDF Document (.pdf)</option>
                    <option value="excel">Excel Spreadsheet (.xlsx)</option>
                    <option value="csv">Comma Separated Dataset (.csv)</option>
                  </select>
                </div>

                <div className="md:col-span-2 pt-3 flex justify-end">
                  <button
                    type="submit"
                    className="btn btn-sm bg-[#00643b] hover:bg-[#004d2e] border-none text-white text-xs font-bold rounded-xl px-5 flex items-center gap-1.5"
                  >
                    <Play size={12} /> Compile &amp; Publish Report
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right panel: schedules */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
              <Settings size={13} /> Automated Dispatch Schedules
            </h3>

            <div className="space-y-3">
              {schedules.map((sch) => (
                <div
                  key={sch.id}
                  className="flex items-start justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-xl"
                >
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                      {sch.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold flex items-center gap-1">
                      <Calendar size={10} /> {sch.time}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={sch.active}
                    onChange={() => toggleSchedule(sch.id)}
                    className="toggle toggle-emerald toggle-xs shrink-0 cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom panel: list of compiled reports */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers size={13} /> Publications Library
            </h3>
            <span className="text-[10px] text-slate-400 font-bold">
              Displaying {filteredReports.length} publications
            </span>
          </div>

          <div className="flex-1 overflow-x-auto">
            {filteredReports.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 italic text-xs font-semibold">
                No reports publications matching query criteria.
              </div>
            ) : (
              <table className="table table-xs w-full divide-y divide-slate-100 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 text-left">Report Document Title</th>
                    <th className="py-3 px-4 text-left">Date Compiled</th>
                    <th className="py-3 px-4 text-left">Scope Type</th>
                    <th className="py-3 px-4 text-left">File Size</th>
                    <th className="py-3 px-4 text-center">Format</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {report.name}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono">{report.date}</td>
                      <td className="py-3.5 px-4 text-xs">{report.type}</td>
                      <td className="py-3.5 px-4 text-xs font-mono">{report.size}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-md ${
                          report.format === "PDF"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                            : report.format === "EXCEL"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                        }`}>
                          {report.format}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[9px] font-bold uppercase ${
                          report.status === "Published" ? "text-emerald-500" : "text-slate-400"
                        }`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleDownloadReport(report)}
                            className="btn btn-ghost btn-xs btn-circle text-slate-400 hover:text-[#00643b] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Download Report"
                          >
                            <Download size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteReport(report.id)}
                            className="btn btn-ghost btn-xs btn-circle text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Delete Report"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
