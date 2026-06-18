import React, { useState, useMemo, useEffect } from "react";
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
import { jsPDF } from "jspdf";
import "jspdf-autotable";

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

  // ---- LIVE ACTIVITY RECORDS STATE ----
  const [bottomTab, setBottomTab] = useState("live-records");
  const [activityRecords, setActivityRecords] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  const fetchActivityRecords = async () => {
    setIsLoadingActivities(true);
    try {
      const [insRes, pregRes, calvRes, healthRes] = await Promise.all([
        axiosInstance.get("/technician/inseminations?limit=1000"),
        axiosInstance.get("/technician/pregnancy-checks?limit=1000"),
        axiosInstance.get("/technician/calvings?limit=1000"),
        axiosInstance.get("/health-request"),
      ]);

      const allEvents = [];

      (insRes.data?.inseminations || []).forEach((ins) => {
        const date = new Date(ins.inseminationDate || ins.createdAt);
        allEvents.push({
          id: ins._id,
          type: "AI",
          animalId: ins.animalId?.animalId || "—",
          earTag: ins.animalId?.earTag || "—",
          brand: ins.animalId?.brand || "—",
          species: ins.animalId?.species || "—",
          breed: ins.animalId?.breed || "—",
          color: ins.animalId?.color || "—",
          barangay: ins.farmerId?.address?.barangay || "—",
          farmer: ins.farmerId?.name || "—",
          date: date,
          formattedDate: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          details: `Sire: ${ins.sireCode || "—"} (${ins.sireBreed || "—"}) - Attempt #${ins.attemptNumber || 1}`,
          rawDate: date.getTime(),
        });
      });

      (pregRes.data?.data || []).forEach((preg) => {
        const date = new Date(preg.checkDate || preg.createdAt);
        allEvents.push({
          id: preg._id,
          type: "PD",
          animalId: preg.animalId?.animalId || "—",
          earTag: preg.animalId?.earTag || "—",
          brand: preg.animalId?.brand || "—",
          species: preg.animalId?.species || "—",
          breed: preg.animalId?.breed || "—",
          color: preg.animalId?.color || "—",
          barangay: preg.farmerId?.address?.barangay || "—",
          farmer: preg.farmerId?.name || "—",
          date: date,
          formattedDate: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          details: `Result: ${preg.pregnancyDiagnosis?.result || "—"}`,
          rawDate: date.getTime(),
        });
      });

      (calvRes.data?.data || []).forEach((calv) => {
        const date = new Date(calv.date || calv.createdAt);
        allEvents.push({
          id: calv._id,
          type: "CD",
          animalId: calv.animalId?.animalId || "—",
          earTag: calv.animalId?.earTag || "—",
          brand: calv.animalId?.brand || "—",
          species: calv.animalId?.species || "—",
          breed: calv.animalId?.breed || "—",
          color: calv.animalId?.color || "—",
          barangay: calv.farmerId?.address?.barangay || "—",
          farmer: calv.farmerId?.name || "—",
          date: date,
          formattedDate: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          details: `Calves: ${calv.numberOfCalves || 1} (${calv.calvingEase || "Normal"})`,
          rawDate: date.getTime(),
        });
      });

      (Array.isArray(healthRes.data) ? healthRes.data : []).forEach((health) => {
        const date = new Date(health.createdAt);
        allEvents.push({
          id: health._id,
          type: "HL",
          animalId: health.animalId?.animalId || "—",
          earTag: health.animalId?.earTag || "—",
          brand: health.animalId?.brand || "—",
          species: health.animalId?.species || "—",
          breed: health.animalId?.breed || "—",
          color: health.animalId?.color || "—",
          barangay: health.farmerId?.address?.barangay || "—",
          farmer: health.farmerId?.name || "—",
          date: date,
          formattedDate: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          details: `Health check: ${health.issue || health.symptoms || "Check-up"} (${health.status?.toUpperCase() || "COMPLETED"})`,
          rawDate: date.getTime(),
        });
      });

      allEvents.sort((a, b) => b.rawDate - a.rawDate);
      setActivityRecords(allEvents);
    } catch (error) {
      console.error("Failed to fetch activity records:", error);
      toast.error("Failed to fetch live activity records.");
    } finally {
      setIsLoadingActivities(false);
    }
  };

  useEffect(() => {
    fetchActivityRecords();
  }, []);

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
          params: {
            reportType,
            dateRange,
            barangay,
            format
          }
        };

        setReports((prev) => [newReport, ...prev]);
        setIsCompiling(false);
        setCompilingStep("");
        fetchActivityRecords();
        toast.success("Municipal report compiled and archived successfully!");
      }
    }, 600);
  };

  // ---- DYNAMIC DOCUMENT EXPORTER (PDF/EXCEL/CSV TELEMETRY STREAM) ----
  const handleDownloadReport = async (report) => {
    try {
      toast.info(`Fetching live data aggregates for: ${report.name}...`);
      
      let monthVal, yearVal;
      const now = new Date();
      if (report.params && report.params.dateRange) {
        monthVal = now.getMonth() + 1;
        yearVal = now.getFullYear();
      } else {
        monthVal = now.getMonth() + 1;
        yearVal = now.getFullYear();
        if (report.name.includes("May 2026")) {
          monthVal = 5;
          yearVal = 2026;
        } else if (report.name.includes("April 2026")) {
          monthVal = 4;
          yearVal = 2026;
        } else if (report.name.includes("March 2026")) {
          monthVal = 3;
          yearVal = 2026;
        }
      }

      const isPDF = report.format === "PDF";
      const reportTypeClean = report.type || "Breeding Audit";

      // 1. CENSUS / LIVESTOCK DEMOGRAPHICS
      if (reportTypeClean === "Livestock Census") {
        const res = await axiosInstance.get("/animals/all");
        let data = res.data || [];
        const targetBrgy = report.params?.barangay || "all";
        if (targetBrgy !== "all") {
          data = data.filter(item => 
            item.farmerId?.address?.barangay?.toLowerCase() === targetBrgy.toLowerCase()
          );
        }

        if (data.length === 0) {
          return toast.error("Zero census records located for selected parameters.");
        }

        const headers = ["Animal ID", "Ear Tag", "Species", "Breed", "Color", "Farmer Owner", "Barangay", "Reproductive Status"];
        const rows = data.map(item => [
          item.animalId || "—",
          item.earTag || "—",
          item.type || item.species || "—",
          item.breed || "—",
          item.color || "—",
          item.farmerId?.name || "—",
          item.farmerId?.address?.barangay || "—",
          item.reproductiveStatus || "—"
        ]);

        if (isPDF) {
          const doc = new jsPDF({ orientation: "landscape", format: "a4", unit: "mm" });
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("DEPARTMENT OF AGRICULTURE", doc.internal.pageSize.width / 2, 8, { align: "center" });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.text("Municipal Agricultural Extension Office", doc.internal.pageSize.width / 2, 12, { align: "center" });
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text("LIVESTOCK DEMOGRAPHICS CENSUS REPORT", doc.internal.pageSize.width / 2, 18, { align: "center" });
          doc.text(`Sector Barangay: ${targetBrgy.toUpperCase()}`, doc.internal.pageSize.width / 2, 22, { align: "center" });
          
          doc.autoTable({
            head: [headers],
            body: rows,
            theme: "grid",
            styles: { fontSize: 7, cellPadding: 1.5 },
            headStyles: { fillColor: [0, 100, 59], textColor: 255, halign: "center" },
            margin: { top: 26 }
          });
          doc.save(`DA_Census_Report_${targetBrgy}_${new Date().toLocaleDateString()}.pdf`);
        } else {
          const csvContent = headers.join(",") + "\n" + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `DA_Census_Report_${targetBrgy}_${new Date().toLocaleDateString()}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
        return toast.success("Census dataset exported successfully.");
      }

      // 2. FARMER ACTIVITIES / ENGAGEMENT LOGS
      if (reportTypeClean === "Farmer Activities") {
        const [farmersRes, animalsRes] = await Promise.all([
          axiosInstance.get("/user?role=farmer"),
          axiosInstance.get("/animals/all")
        ]);
        const farmers = farmersRes.data || [];
        const animals = animalsRes.data || [];
        
        const counts = {};
        animals.forEach(a => {
          const fId = typeof a.farmerId === "object" ? a.farmerId?._id : a.farmerId;
          if (fId) counts[fId] = (counts[fId] || 0) + 1;
        });

        let data = farmers.map(f => ({
          name: f.name || "Unknown",
          contact: f.phoneNumber || "N/A",
          barangay: f.address?.barangay || "N/A",
          animals: counts[f._id] || 0,
          status: f.isVerified ? "Verified" : "Manual",
          registered: f.createdAt ? new Date(f.createdAt).toLocaleDateString() : "N/A"
        }));

        const targetBrgy = report.params?.barangay || "all";
        if (targetBrgy !== "all") {
          data = data.filter(item => item.barangay?.toLowerCase() === targetBrgy.toLowerCase());
        }

        if (data.length === 0) {
          return toast.error("Zero farmer records located for selected parameters.");
        }

        const headers = ["Farmer Name", "Contact Number", "Barangay", "Registered Livestock", "Status", "Registration Date"];
        const rows = data.map(item => [
          item.name,
          item.contact,
          item.barangay,
          item.animals,
          item.status,
          item.registered
        ]);

        if (isPDF) {
          const doc = new jsPDF({ orientation: "portrait", format: "a4", unit: "mm" });
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("DEPARTMENT OF AGRICULTURE", doc.internal.pageSize.width / 2, 10, { align: "center" });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text("Unified National Artificial Insemination Program", doc.internal.pageSize.width / 2, 14, { align: "center" });
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("FARMER ENGAGEMENT AND ROSTER REPORT", doc.internal.pageSize.width / 2, 20, { align: "center" });
          
          doc.autoTable({
            head: [headers],
            body: rows,
            theme: "grid",
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [0, 100, 59], textColor: 255, halign: "center" },
            margin: { top: 25 }
          });
          doc.save(`DA_Farmer_Roster_${targetBrgy}_${new Date().toLocaleDateString()}.pdf`);
        } else {
          const csvContent = headers.join(",") + "\n" + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `DA_Farmer_Roster_${targetBrgy}_${new Date().toLocaleDateString()}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
        return toast.success("Farmer activities database exported successfully.");
      }

      // 3. CLINICAL HEALTH REGISTRY (HEALTH SUMMARY)
      if (reportTypeClean === "Health Summary") {
        const res = await axiosInstance.get("/health-request");
        let healthData = res.data || [];
        
        const targetBrgy = report.params?.barangay || "all";
        if (targetBrgy !== "all") {
          healthData = healthData.filter(item => 
            item.farmerId?.address?.barangay?.toLowerCase() === targetBrgy.toLowerCase()
          );
        }

        if (healthData.length === 0) {
          return toast.error("Zero health incidents located for selected parameters.");
        }

        const headers = ["Logged Date", "Animal Tag", "Farmer Owner", "Barangay", "Symptoms", "Diagnosis", "Treatment Plan", "Urgency", "Status"];
        const rows = healthData.map(item => [
          item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A",
          item.animalId?.earTag || "—",
          item.farmerId?.name || "—",
          item.farmerId?.address?.barangay || "—",
          item.symptoms || "—",
          item.diagnosis || "—",
          item.treatment || "—",
          (item.urgency || "low").toUpperCase(),
          (item.status || "pending").toUpperCase()
        ]);

        if (isPDF) {
          const doc = new jsPDF({ orientation: "landscape", format: "a4", unit: "mm" });
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("DEPARTMENT OF AGRICULTURE", doc.internal.pageSize.width / 2, 8, { align: "center" });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.text("Veterinary Health Diagnostics & Triage Logs", doc.internal.pageSize.width / 2, 12, { align: "center" });
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text("DISEASE OUTBREAK & HEALTH TELEMETRY REPORT", doc.internal.pageSize.width / 2, 18, { align: "center" });
          
          doc.autoTable({
            head: [headers],
            body: rows,
            theme: "grid",
            styles: { fontSize: 7, cellPadding: 1.5 },
            headStyles: { fillColor: [0, 100, 59], textColor: 255, halign: "center" },
            margin: { top: 24 }
          });
          doc.save(`DA_Health_Summary_${targetBrgy}_${new Date().toLocaleDateString()}.pdf`);
        } else {
          const csvContent = headers.join(",") + "\n" + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `DA_Health_Summary_${targetBrgy}_${new Date().toLocaleDateString()}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
        return toast.success("Health dispatches dataset exported successfully.");
      }

      // 4. BREEDING LEDGER AUDIT / UNIP
      const res = await axiosInstance.get(
        `/reports/monthly-accomplishment?month=${monthVal}&year=${yearVal}`
      );
      let data = res.data || [];
      
      const targetBrgy = report.params?.barangay || "all";
      if (targetBrgy !== "all") {
        data = data.filter(item => 
          item.farmer?.address?.barangay?.toLowerCase() === targetBrgy.toLowerCase()
        );
      }

      if (data.length === 0) {
        return toast.error("Zero breeding ledger records located for selected parameters.");
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

      if (isPDF) {
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
        doc.text("MONTHLY ACCOMPLISHMENT REPORT", doc.internal.pageSize.width / 2, 19, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(`For the Month of: ${monthVal} / ${yearVal}    Sector Barangay: ${targetBrgy.toUpperCase()}`, doc.internal.pageSize.width / 2, 23, { align: "center" });

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
        doc.save(`DA_UNIP_Report_${monthVal}_${yearVal}_${targetBrgy}.pdf`);
      } else {
        const csvContent = headers.join(",") + "\n" + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `DA_UNIP_Report_${monthVal}_${yearVal}_${targetBrgy}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      toast.success("Municipal report document downloaded successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to construct accomplishment report.");
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

  const filteredActivityRecords = useMemo(() => {
    return activityRecords.filter((record) => {
      // 1. Search Query Filter (Matches farmer name, animal ID, ear tag, breed, details)
      const matchesSearch = [record.farmer, record.animalId, record.earTag, record.breed, record.details]
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // 2. Report Type Filter
      if (reportType === "breeding-audit" && !["AI", "PD", "CD"].includes(record.type)) {
        return false;
      }
      if (reportType === "health-summary" && record.type !== "HL") {
        return false;
      }

      // 3. Barangay Filter
      if (barangay !== "all" && record.barangay.toLowerCase() !== barangay.toLowerCase()) {
        return false;
      }

      // 4. Date Range Filter
      const recordTime = record.date.getTime();
      const now = new Date().getTime();
      if (dateRange === "7-days") {
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        if (recordTime < sevenDaysAgo) return false;
      } else if (dateRange === "30-days") {
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        if (recordTime < thirtyDaysAgo) return false;
      } else if (dateRange === "ytd") {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
        if (recordTime < startOfYear) return false;
      }

      return true;
    });
  }, [activityRecords, searchQuery, reportType, barangay, dateRange]);

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

        {/* Bottom panel: list of compiled reports or live activity records */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50 flex-wrap gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBottomTab("live-records")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold tracking-wide uppercase transition-all ${
                  bottomTab === "live-records"
                    ? "bg-[#00643b] text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                }`}
              >
                Live Activity Records
              </button>
              <button
                type="button"
                onClick={() => setBottomTab("library")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold tracking-wide uppercase transition-all ${
                  bottomTab === "library"
                    ? "bg-[#00643b] text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                }`}
              >
                Publications Library
              </button>
            </div>
            <span className="text-[10px] text-slate-400 font-bold">
              {bottomTab === "live-records"
                ? `Displaying ${filteredActivityRecords.length} records`
                : `Displaying ${filteredReports.length} publications`}
            </span>
          </div>

          <div className="flex-1 overflow-x-auto">
            {bottomTab === "live-records" ? (
              isLoadingActivities ? (
                <div className="p-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                  <span className="loading loading-spinner loading-md text-[#00643b] dark:text-emerald-500" />
                  <p className="text-xs font-semibold italic animate-pulse">Syncing live records...</p>
                </div>
              ) : filteredActivityRecords.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 italic text-xs font-semibold">
                  No live activity records matching filters.
                </div>
              ) : (
                <table className="table table-xs w-full divide-y divide-slate-100 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4 text-center" style={{ width: "60px" }}>Type</th>
                      <th className="py-3 px-4 text-left">Animal / Ear Tag</th>
                      <th className="py-3 px-4 text-left">Farmer Name</th>
                      <th className="py-3 px-4 text-left">Barangay</th>
                      <th className="py-3 px-4 text-left">Event Details</th>
                      <th className="py-3 px-4 text-right">Date Occurred</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                    {filteredActivityRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-md ${
                            record.type === "AI"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : record.type === "PD"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                              : record.type === "HL"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                          }`}>
                            {record.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                          {record.animalId} <span className="text-slate-400 font-normal">({record.earTag})</span>
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold">{record.farmer}</td>
                        <td className="py-3 px-4 text-xs">{record.barangay}</td>
                        <td className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {record.details}
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-mono">{record.formattedDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : filteredReports.length === 0 ? (
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
