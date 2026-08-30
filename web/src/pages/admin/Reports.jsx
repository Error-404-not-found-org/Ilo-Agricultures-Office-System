import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Award,
  TrendingUp,
} from "lucide-react";
import { OTON_BARANGAYS } from "../../constants/barangays";
import Topbar from "../../components/layout/Topbar";
import { formatReportCount, getCurrentReportMonth } from "./reportsPresentation";

export default function Reports() {
  const toast = useToast();
  const [reportType, setReportType] = useState("da-unified");
  const [barangay, setBarangay] = useState("all");
  const [compilationMonth, setCompilationMonth] = useState(() => getCurrentReportMonth());
  const [isCompiling, setIsCompiling] = useState(false);

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["admin", "reports-stats"],
    queryFn: async () => {
      const res = await axiosInstance.get("/admin/stats");
      return res.data;
    },
  });

  const { data: farmers = [] } = useQuery({
    queryKey: ["admin", "farmers-list-for-reports"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=farmer");
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
  });

  const dynamicBarangays = useMemo(() => {
    const brgys = new Set();
    OTON_BARANGAYS.forEach((b) => brgys.add(b.trim()));
    farmers.forEach((f) => {
      const b = f.address?.barangay;
      if (b) {
        brgys.add(b.trim());
      }
    });
    return Array.from(brgys).sort();
  }, [farmers]);

  const handleGenerateReport = async (action) => {
    setIsCompiling(true);
    try {
      const [yearString, monthString] = compilationMonth.split("-");
      const currentMonth = getCurrentReportMonth().split("-");
      const monthVal = parseInt(monthString) || parseInt(currentMonth[1]);
      const yearVal = parseInt(yearString) || parseInt(currentMonth[0]);

      const dateObj = new Date(yearVal, monthVal - 1);
      const formattedDateRange = dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      const isPrint = action === "print";

      // Insemination registry / UNIP accomplishments
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
        toast.error("No breeding records found for the selected month and barangay.");
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
        doc.text(`For the Month of: ${formattedDateRange}    Sector Barangay: ${barangay.toUpperCase()}`, doc.internal.pageSize.width / 2, 23, { align: "center" });

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
        link.setAttribute("download", `DA_UNIP_${reportType}_${barangay}_${formattedDateRange.replace(" ", "_")}.csv`);
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
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
      <Topbar
        title="Reports & Exports"
        subtitle="Prepare BreedSmart breeding accomplishments and official Department of Agriculture forms"
        searchPlaceholder=""
        searchValue=""
        onSearchChange={() => {}}
      />

      <main className="p-6 max-w-5xl w-full mx-auto space-y-6 flex-1">
        
        {/* Dynamic Metric Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-base-100 border border-base-300 p-4 rounded-xl flex items-center gap-3 ">
            <div className="p-2.5 rounded-xl shrink-0 text-primary bg-primary/10">
              <Layers size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoadingStats ? "..." : formatReportCount(stats?.inseminations)}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/50 tracking-wider">
                Insemination Entries
              </div>
            </div>
          </div>
          <div className="bg-base-100 border border-base-300 p-4 rounded-xl flex items-center gap-3 ">
            <div className="p-2.5 rounded-xl shrink-0 text-base-content/70 bg-base-200">
              <ClipboardCheck size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoadingStats ? "..." : formatReportCount(stats?.pregnancies)}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/50 tracking-wider">
                Pregnancy Records
              </div>
            </div>
          </div>
          <div className="bg-base-100 border border-base-300 p-4 rounded-xl flex items-center gap-3 ">
            <div className="p-2.5 rounded-xl shrink-0 text-base-content/70 bg-base-200">
              <TrendingUp size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoadingStats ? "..." : formatReportCount(stats?.calvings)}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/50 tracking-wider">
                Calving Records
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* LEFT SECTION: Report Compilers Controls */}
          <div className="md:col-span-2 space-y-6">
            <div className="card bg-base-100 border border-base-300 rounded-2xl p-5  space-y-5">
              <h3 className="text-xs font-black text-base-content/50 uppercase tracking-widest flex items-center gap-1.5 pb-3 border-b border-base-300">
                <Sparkles size={14} className="text-primary" />
                Compile Government Accomplishment Forms
              </h3>

              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label htmlFor="admin-report-type" className="text-[9px] font-black text-base-content/50 uppercase tracking-widest pl-1">
                    Report Type Template
                  </label>
                  <select
                    id="admin-report-type"
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full bg-base-200 border border-base-300 rounded-xl px-4 py-2.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary font-bold select select-bordered"
                  >
                    <option value="da-unified">Department of Agriculture Unified Accomplishment</option>
                    <option value="insemination-registry">Veterinary AI Insemination Logs</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="admin-report-barangay" className="text-[9px] font-black text-base-content/50 uppercase tracking-widest pl-1 flex items-center gap-1">
                      <MapPin size={10} /> Barangay Sector
                    </label>
                    <select
                      id="admin-report-barangay"
                      value={barangay}
                      onChange={(e) => setBarangay(e.target.value)}
                      className="w-full bg-base-200 border border-base-300 rounded-xl px-4 py-2.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary font-bold select select-bordered"
                    >
                      <option value="all">All Barangays</option>
                      {dynamicBarangays.map((brgy) => (
                        <option key={brgy} value={brgy.toLowerCase()}>
                          {brgy}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="admin-report-month" className="text-[9px] font-black text-base-content/50 uppercase tracking-widest pl-1 flex items-center gap-1">
                      <Calendar size={10} /> Compilation Month
                    </label>
                    <input
                      id="admin-report-month"
                      type="month"
                      value={compilationMonth}
                      onChange={(e) => setCompilationMonth(e.target.value)}
                      className="w-full bg-base-200 border border-base-300 rounded-xl px-4 py-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary font-bold input input-bordered text-xs"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-base-300">
                <button
                  onClick={() => handleGenerateReport("print")}
                  disabled={isCompiling}
                  className="btn btn-sm btn-outline border-base-300 text-xs font-bold gap-1 rounded-xl px-4 cursor-pointer"
                >
                  <Printer size={13} /> Print Official Form
                </button>
                <button
                  onClick={() => handleGenerateReport("csv")}
                  disabled={isCompiling}
                  className="btn btn-primary btn-sm"
                >
                  <Download size={13} /> {isCompiling ? "Compiling..." : "Export CSV File"}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT SECTION: Roster Guidelines */}
          <div className="space-y-6 text-xs">
            <div className="card bg-base-100 border border-base-300 rounded-2xl p-5  space-y-3">
              <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                <Award size={12} /> Standard Compliance
              </h4>
              <p className="text-base-content/50 font-bold uppercase tracking-wider leading-relaxed text-[9px]">
                Complies with national standards under the Unified National Artificial Insemination Program guidelines.
              </p>
              <div className="space-y-2 pt-2 border-t border-base-300 font-semibold text-base-content/60">
                <div className="flex justify-between">
                  <span>Authorizing Agency:</span>
                  <span className="font-extrabold text-base-content/75">DA - RFU VI</span>
                </div>
                <div className="flex justify-between">
                  <span>Province Sector:</span>
                  <span className="font-extrabold text-base-content/75">Iloilo - Oton</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
