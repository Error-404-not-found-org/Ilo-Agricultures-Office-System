import React, { useState } from "react";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import {
  Download,
  Printer,
  Calendar,
  Layers,
  MapPin,
  Sparkles,
  ClipboardCheck,
  Activity,
  Award,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import Topbar from "../../components/ui/Topbar";

export default function Reports() {
  const toast = useToast();
  const [reportType, setReportType] = useState("da-unified");
  const [barangay, setBarangay] = useState("all");
  const [dateRange, setDateRange] = useState("May 2026");
  const [isCompiling, setIsCompiling] = useState(false);

  const handleGenerateReport = async (action) => {
    setIsCompiling(true);
    try {
      // Simulate compiling report data
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (action === "csv") {
        // Trigger a CSV download mock
        const headers = ["Barangay", "Report Type", "Compiled Month", "Total AI attempts", "Conceptions Rate", "Health Dispatches"];
        const row = [barangay.toUpperCase(), reportType.toUpperCase(), dateRange, "45", "87%", "14"];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + row.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `BreedSmart_${reportType}_Report_${dateRange.replace(" ", "_")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Spreadsheet compiled and downloaded.");
      } else {
        // Trigger landscape print simulation
        window.print();
        toast.success("Printing sequence finalized.");
      }
    } catch (err) {
      toast.error("Failed compiling requested report.");
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Topbar
        title="Analytics & Exporter Hub"
        subtitle="Compile certified veterinary accomplishments, landscape print DA templates, and analyze metrics"
        searchPlaceholder=""
        searchValue=""
        onSearchChange={() => {}}
      />

      <main className="p-6 max-w-5xl w-full mx-auto space-y-6 flex-1">
        
        {/* Dynamic Metric Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-[#00643b] bg-emerald-50 dark:bg-emerald-950/20">
              <Layers size={16} />
            </div>
            <div>
              <div className="text-xl font-black">94%</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Breeding Accomplishments Rate
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-purple-600 bg-purple-50 dark:bg-purple-950/20">
              <ClipboardCheck size={16} />
            </div>
            <div>
              <div className="text-xl font-black">154</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Total Logs Compiled
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-blue-600 bg-blue-50 dark:bg-blue-950/20">
              <TrendingUp size={16} />
            </div>
            <div>
              <div className="text-xl font-black">88%</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Pregnancy Diagnosis Accuracy
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* LEFT SECTION: Report Compilers Controls */}
          <div className="md:col-span-2 space-y-6">
            <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-3 border-b border-slate-100 dark:border-slate-900/60">
                <Sparkles size={14} className="text-[#00643b]" />
                Compile Government Accomplishment Forms
              </h3>

              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">
                    Report Type Template
                  </label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 outline-none font-bold select select-bordered"
                  >
                    <option value="da-unified">Department of Agriculture Unified Accomplishment</option>
                    <option value="insemination-registry">Veterinary AI Insemination Logs</option>
                    <option value="health-diagnostics">Clinical Health Triage Logs</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                      <MapPin size={10} /> Barangay Sector
                    </label>
                    <select
                      value={barangay}
                      onChange={(e) => setBarangay(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 outline-none font-bold select select-bordered"
                    >
                      <option value="all">All Barangays</option>
                      <option value="poblacion">Poblacion</option>
                      <option value="buray">Buray</option>
                      <option value="cagbang">Cagbang</option>
                      <option value="santa-monica">Santa Monica</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                      <Calendar size={10} /> Compilation Month
                    </label>
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 outline-none font-bold select select-bordered"
                    >
                      <option value="May 2026">May 2026</option>
                      <option value="April 2026">April 2026</option>
                      <option value="March 2026">March 2026</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-900">
                <button
                  onClick={() => handleGenerateReport("print")}
                  disabled={isCompiling}
                  className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 text-xs font-bold gap-1 rounded-xl px-4 cursor-pointer"
                >
                  <Printer size={13} /> Print Official Form
                </button>
                <button
                  onClick={() => handleGenerateReport("csv")}
                  disabled={isCompiling}
                  className="btn btn-sm bg-[#00643b] hover:bg-[#004d2e] border-none text-white text-xs font-black gap-1 rounded-xl px-4 cursor-pointer shadow-sm"
                >
                  <Download size={13} /> {isCompiling ? "Compiling..." : "Export CSV File"}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT SECTION: Roster Guidelines */}
          <div className="space-y-6 text-xs">
            <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
              <h4 className="text-[10px] font-black text-[#00643b] uppercase tracking-widest flex items-center gap-1">
                <Award size={12} /> Standard Compliance
              </h4>
              <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider leading-relaxed text-[9px]">
                Complies with national standards under the Unified National Artificial Insemination Program guidelines.
              </p>
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-900/60 font-semibold text-slate-500">
                <div className="flex justify-between">
                  <span>Authorizing Agency:</span>
                  <span className="font-extrabold text-slate-700 dark:text-slate-300">DA - RFU VI</span>
                </div>
                <div className="flex justify-between">
                  <span>Province Sector:</span>
                  <span className="font-extrabold text-slate-700 dark:text-slate-300">Iloilo - Oton</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
