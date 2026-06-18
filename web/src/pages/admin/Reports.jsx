import React, { useState } from "react";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
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
      const [monthName, yearString] = dateRange.split(" ");
      const monthMap = {
        January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
        July: 7, August: 8, September: 9, October: 10, November: 11, December: 12
      };
      const monthVal = monthMap[monthName] || 5;
      const yearVal = parseInt(yearString) || 2026;

      const isPrint = action === "print";

      // 1. HEALTH REQUESTS
      if (reportType === "health-diagnostics") {
        const res = await axiosInstance.get("/health-request");
        let data = res.data || [];
        
        // Filter by barangay
        if (barangay !== "all") {
          data = data.filter(item => 
            item.farmerId?.address?.barangay?.toLowerCase() === barangay.toLowerCase()
          );
        }

        // Filter by month/year matching dateRange
        data = data.filter(item => {
          if (!item.createdAt) return false;
          const d = new Date(item.createdAt);
          return d.getMonth() + 1 === monthVal && d.getFullYear() === yearVal;
        });

        if (data.length === 0) {
          toast.error("Zero telemetry records located for selected parameters.");
          return;
        }

        const headers = ["Incident Case #", "Logged Date", "Animal Tag", "Farmer Client", "Symptom Presentation", "Assigned Diagnosis", "Treatment Plan", "Urgency", "Status"];
        const rows = data.map(item => [
          item._id ? `#${item._id.slice(-6)}` : "—",
          item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—",
          item.animalId?.earTag || "—",
          item.farmerId?.name || "—",
          item.symptoms || "—",
          item.diagnosis || "—",
          item.treatment || "—",
          (item.urgency || "low").toUpperCase(),
          (item.status || "pending").toUpperCase()
        ]);

        if (isPrint) {
          const doc = new jsPDF({ orientation: "landscape", format: "a4", unit: "mm" });
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("DEPARTMENT OF AGRICULTURE", doc.internal.pageSize.width / 2, 8, { align: "center" });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.text("Veterinary Health Diagnostics & Triage Logs", doc.internal.pageSize.width / 2, 12, { align: "center" });
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(`HEALTH TRIAGE & DIAGNOSTIC LOGS - ${dateRange.toUpperCase()}`, doc.internal.pageSize.width / 2, 17, { align: "center" });
          
          doc.autoTable({
            head: [headers],
            body: rows,
            theme: "grid",
            styles: { fontSize: 7, cellPadding: 1.5 },
            headStyles: { fillColor: [0, 100, 59], textColor: 255, halign: "center" },
            margin: { top: 23 }
          });
          window.open(doc.output("bloburl"), "_blank");
          toast.success("Health diagnostics PDF registry print ready.");
        } else {
          const csvContent = headers.join(",") + "\n" + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `BreedSmart_Health_Diagnostics_${barangay}_${dateRange.replace(" ", "_")}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success("Health diagnostics CSV registry downloaded.");
        }
        return;
      }

      // 2. INSEMINATION REGISTRY / UNIP ACCOMPLISHMENTS
      const res = await axiosInstance.get(
        `/reports/monthly-accomplishment?month=${monthVal}&year=${yearVal}`
      );
      let data = res.data || [];

      // Filter by barangay
      if (barangay !== "all") {
        data = data.filter(item => 
          item.farmer?.address?.barangay?.toLowerCase() === barangay.toLowerCase()
        );
      }

      // If insemination registry only, filter entries having AI
      if (reportType === "insemination-registry") {
        data = data.filter(item => item.type?.includes("AI"));
      }

      if (data.length === 0) {
        toast.error("Zero telemetry records located for selected parameters.");
        return;
      }

      const headers = [
        "Data", "No.", "Animal ID No.", "Ear Tag No.", "Brand", "Species", "Breed", "Color", "Address", "Farmer",
        "AI Date", "No. of AI", "Estrus", "Sire Breed", "Sire Code",
        "PD Date", "PD Result",
        "CD Date", "No. of Calving", "Calf ID No.", "Sex", "Calving Ease"
      ];
      
      const rows = data.map((item, index) => [
        item.type || "",
        index + 1,
        item.animal?.animalId || "—",
        item.animal?.earTag || "—",
        item.animal?.brand || "—",
        item.animal?.species || "—",
        item.animal?.breed || "—",
        item.animal?.color || "—",
        item.farmer?.address?.barangay || "—",
        item.farmer?.name || "—",
        item.date ? new Date(item.date).toLocaleDateString() : "—",
        item.ai?.attempt || "—",
        item.ai?.estrus || "—",
        item.ai?.sireBreed || "—",
        item.ai?.sireCode || "—",
        item.pd?.date ? new Date(item.pd.date).toLocaleDateString() : "—",
        item.pd?.result || "—",
        item.cd?.date ? new Date(item.cd.date).toLocaleDateString() : "—",
        item.cd?.count || "—",
        item.cd?.calves?.[0]?.animalId || "—",
        item.cd?.calves?.[0]?.sex || "—",
        item.cd?.ease || "—"
      ]);

      if (isPrint) {
        const doc = new jsPDF({ orientation: "landscape", format: "a4", unit: "mm" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("DEPARTMENT OF AGRICULTURE", doc.internal.pageSize.width / 2, 8, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text("Bureau of Animal Industry - Local Government Units", doc.internal.pageSize.width / 2, 11, { align: "center" });
        doc.text("Unified National Artificial Insemination Program", doc.internal.pageSize.width / 2, 14, { align: "center" });
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(
          reportType === "insemination-registry" 
            ? "VETERINARY AI INSEMINATION LOGS" 
            : "MONTHLY ACCOMPLISHMENT REPORT", 
          doc.internal.pageSize.width / 2, 19, { align: "center" }
        );
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(`For the Month of: ${dateRange}    Sector Barangay: ${barangay.toUpperCase()}`, doc.internal.pageSize.width / 2, 23, { align: "center" });

        const structuredHeaders = [
          [
            { content: "Data", rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: "No.", rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: "Animal Identification", colSpan: 7, styles: { halign: 'center' } },
            { content: "Farmer", rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: "Artificial Insemination", colSpan: 5, styles: { halign: 'center' } },
            { content: "Pregnancy Diagnosis", colSpan: 2, styles: { halign: 'center' } },
            { content: "Calf Drop", colSpan: 5, styles: { halign: 'center' } }
          ],
          [
            "Animal ID No.", "Ear Tag No.", "Brand", "Species", "Breed", "Color", "Address",
            "Date", "No. of AI", "Estrus", "Sire Breed", "Sire Code",
            "Date", "Result",
            "Date", "No. of Calving", "Calf ID No.", "Sex", "Calving Ease"
          ]
        ];

        doc.autoTable({
          head: structuredHeaders,
          body: rows,
          theme: "grid",
          styles: { fontSize: 5, cellPadding: 1 },
          headStyles: { fillColor: [0, 100, 59], textColor: 255, halign: "center", fontSize: 5 },
          margin: { top: 26 }
        });
        window.open(doc.output("bloburl"), "_blank");
        toast.success("Breeding registry PDF print ready.");
      } else {
        const csvContent = headers.join(",") + "\n" + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `DA_UNIP_${reportType}_${barangay}_${dateRange.replace(" ", "_")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Breeding registry CSV sheet downloaded.");
      }
    } catch (err) {
      console.error(err);
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
