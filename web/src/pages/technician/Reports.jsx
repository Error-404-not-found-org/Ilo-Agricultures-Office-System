import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Clock,
  AlertCircle,
  Download,
  Trash2,
  Calendar,
  Printer,
  FileSpreadsheet,
  CheckCircle,
  FileCode,
  ShieldAlert,
} from "lucide-react";
import Topbar from "../../components/layout/Topbar";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { downloadCsv, ensureExportableRows } from "../../lib/reportExport";
import StatCard from "../../components/ui/StatCard";
import SectionHeader from "../../components/ui/SectionHeader";
import TimelineCard from "../../components/ui/TimelineCard";
import AlertCard from "../../components/ui/AlertCard";

const filterActivityRecords = (records, { searchQuery, reportType, barangay, dateRange, statusFilter }) => {
  const query = searchQuery.toLowerCase();
  const now = new Date().getTime();

  return records.filter((record) => {
    const matchesSearch = [record.farmer, record.animalId, record.earTag, record.breed, record.details]
      .join(" ")
      .toLowerCase()
      .includes(query);
    if (!matchesSearch) return false;

    if (reportType === "breeding-audit" && !["AI", "PD", "CD"].includes(record.type)) return false;
    if (reportType === "health-summary" && record.type !== "HL") return false;
    if (barangay !== "all" && record.barangay.toLowerCase() !== barangay.toLowerCase()) return false;

    // Status Filter
    if (statusFilter !== "all") {
      const isCompleted = record.details.toLowerCase().includes("completed") || record.type !== "HL";
      if (statusFilter === "completed" && !isCompleted) return false;
      if (statusFilter === "pending" && isCompleted) return false;
    }

    const recordTime = record.date.getTime();
    if (dateRange === "7-days") {
      return recordTime >= now - 7 * 24 * 60 * 60 * 1000;
    }
    if (dateRange === "30-days") {
      return recordTime >= now - 30 * 24 * 60 * 60 * 1000;
    }
    if (dateRange === "ytd") {
      return recordTime >= new Date(new Date().getFullYear(), 0, 1).getTime();
    }

    return true;
  });
};

export default function FieldReports() {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  // ---- REPORT GENERATOR STATE ----
  const reportType = "breeding-audit";
  const dateRange = "30-days";
  const barangay = "all";
  const statusFilter = "all";

  // ---- REPORT LIBRARY STATE ----
  const [reports, setReports] = useState([]);

  // ---- LIVE ACTIVITY RECORDS STATE ----
  const [bottomTab, setBottomTab] = useState("live-records");
  const [activityRecords, setActivityRecords] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  // ---- TASKS QUERY ----
  const { data: tasksData = [] } = useQuery({
    queryKey: ["technician", "reports-tasks"],
    queryFn: async () => {
      const res = await axiosInstance.get("/tasks", { params: { scope: "all", limit: 100 } });
      return res.data?.data || res.data || [];
    }
  });

  const fetchActivityRecords = async () => {
    setIsLoadingActivities(true);
    try {
      const [insRes, pregRes, calvRes, healthRes] = await Promise.all([
        axiosInstance.get("/technician/inseminations?limit=100"),
        axiosInstance.get("/technician/pregnancy-checks?limit=100"),
        axiosInstance.get("/technician/calvings?limit=100"),
        axiosInstance.get("/health-request", { params: { page: 1, limit: 100 } }),
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
          species: ins.animalId?.type || ins.animalId?.species || "—",
          breed: ins.animalId?.breed || "—",
          color: ins.animalId?.color || "—",
          barangay: ins.farmerId?.address?.barangay || "—",
          farmer: ins.farmerId?.name || "—",
          date: date,
          formattedDate: date.toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          details: `Sire: ${ins.sireCode || "—"} (${ins.sireBreed || "—"}) - Attempt #${ins.attemptNumber ?? "Not recorded"}`,
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
          species: preg.animalId?.type || preg.animalId?.species || "—",
          breed: preg.animalId?.breed || "—",
          color: preg.animalId?.color || "—",
          barangay: preg.farmerId?.address?.barangay || "—",
          farmer: preg.farmerId?.name || "—",
          date: date,
          formattedDate: date.toLocaleDateString("en-PH", {
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
          species: calv.animalId?.type || calv.animalId?.species || "—",
          breed: calv.animalId?.breed || "—",
          color: calv.animalId?.color || "—",
          barangay: calv.farmerId?.address?.barangay || "—",
          farmer: calv.farmerId?.name || "—",
          date: date,
          formattedDate: date.toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          details: `Calves: ${calv.numberOfCalves ?? calv.calves?.length ?? "Not recorded"} (${calv.calvingEase || "Not recorded"})`,
          rawDate: date.getTime(),
        });
      });

      (healthRes.data?.data || []).forEach((health) => {
        const date = new Date(health.createdAt);
        allEvents.push({
          id: health._id,
          type: "HL",
          animalId: health.animalId?.animalId || "—",
          earTag: health.animalId?.earTag || "—",
          brand: health.animalId?.brand || "—",
          species: health.animalId?.type || health.animalId?.species || "—",
          breed: health.animalId?.breed || "—",
          color: health.animalId?.color || "—",
          barangay: health.farmerId?.address?.barangay || "—",
          farmer: health.farmerId?.name || "—",
          date: date,
          formattedDate: date.toLocaleDateString("en-PH", {
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
    Promise.resolve().then(() => fetchActivityRecords());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      if (["Livestock Census", "Livestock Registry"].includes(reportTypeClean)) {
        const res = await axiosInstance.get("/animals/all", {
          params: { page: 1, limit: 100, barangay: report.params?.barangay !== "all" ? report.params?.barangay : undefined },
        });
        let data = res.data?.data || res.data?.animals || [];
        const targetBrgy = report.params?.barangay || "all";
        if (targetBrgy !== "all") {
          data = data.filter(item =>
            item.farmerId?.address?.barangay?.toLowerCase() === targetBrgy.toLowerCase()
          );
        }

        if (!ensureExportableRows(data, toast, "No livestock registry records match this report.")) return;

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

          doc.autoTable({
            head: [headers],
            body: rows,
            theme: "grid",
            styles: { fontSize: 7, cellPadding: 1.5 },
            headStyles: { fillColor: [0, 100, 59], textColor: 255 },
            margin: { top: 26 }
          });
          doc.save(`DA_Census_Report_${targetBrgy}_${new Date().toLocaleDateString()}.pdf`);
        } else {
          downloadCsv({ headers, rows, fileName: `DA_Livestock_Registry_${targetBrgy}_${new Date().toLocaleDateString()}` });
        }
        return toast.success("Census dataset exported successfully.");
      }

      if (["Farmer Activities", "Farmer Activity"].includes(reportTypeClean)) {
        const [farmersRes, animalsRes] = await Promise.all([
          axiosInstance.get("/user?role=farmer"),
          axiosInstance.get("/animals/all", { params: { page: 1, limit: 100 } })
        ]);
        const farmers = farmersRes.data || [];
        const animals = animalsRes.data?.data || animalsRes.data?.animals || [];

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

        if (!ensureExportableRows(data, toast, "No farmer activity records match this report.")) return;

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
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("FARMER ENGAGEMENT AND ROSTER REPORT", doc.internal.pageSize.width / 2, 20, { align: "center" });

          doc.autoTable({
            head: [headers],
            body: rows,
            theme: "grid",
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [0, 100, 59], textColor: 255 },
            margin: { top: 25 }
          });
          doc.save(`DA_Farmer_Roster_${targetBrgy}_${new Date().toLocaleDateString()}.pdf`);
        } else {
          downloadCsv({ headers, rows, fileName: `DA_Farmer_Activity_${targetBrgy}_${new Date().toLocaleDateString()}` });
        }
        return toast.success("Farmer activities database exported successfully.");
      }

      if (["Health Summary", "Health Assistance Summary"].includes(reportTypeClean)) {
        const res = await axiosInstance.get("/health-request", { params: { page: 1, limit: 100 } });
        let healthData = res.data?.data || [];

        const targetBrgy = report.params?.barangay || "all";
        if (targetBrgy !== "all") {
          healthData = healthData.filter(item =>
            item.farmerId?.address?.barangay?.toLowerCase() === targetBrgy.toLowerCase()
          );
        }

        if (!ensureExportableRows(healthData, toast, "No health assistance records match this report.")) return;

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
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text("DISEASE OUTBREAK & HEALTH TELEMETRY REPORT", doc.internal.pageSize.width / 2, 18, { align: "center" });

          doc.autoTable({
            head: [headers],
            body: rows,
            theme: "grid",
            styles: { fontSize: 7, cellPadding: 1.5 },
            headStyles: { fillColor: [0, 100, 59], textColor: 255 },
            margin: { top: 24 }
          });
          doc.save(`DA_Health_Summary_${targetBrgy}_${new Date().toLocaleDateString()}.pdf`);
        } else {
          downloadCsv({ headers, rows, fileName: `DA_Health_Assistance_Summary_${targetBrgy}_${new Date().toLocaleDateString()}` });
        }
        return toast.success("Health dispatches dataset exported successfully.");
      }

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

      if (!ensureExportableRows(data, toast, "No breeding accomplishment records match this report.")) return;

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
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("MONTHLY ACCOMPLISHMENT REPORT", doc.internal.pageSize.width / 2, 19, { align: "center" });

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
          headStyles: { fillColor: [0, 100, 59], textColor: 255, fontSize: 5 },
          margin: { top: 26 }
        });
        doc.save(`DA_UNIP_Report_${monthVal}_${yearVal}_${targetBrgy}.pdf`);
      } else {
        downloadCsv({ headers, rows, fileName: `DA_Breeding_Accomplishment_${monthVal}_${yearVal}_${targetBrgy}` });
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
    return filterActivityRecords(activityRecords, { searchQuery, reportType, barangay, dateRange, statusFilter });
  }, [activityRecords, searchQuery, reportType, barangay, dateRange, statusFilter]);

  // Dynamic calculations for operational summary
  const summaryKPIs = useMemo(() => {
    const pendingCount = tasksData.filter((t) => ["claimed", "assigned"].includes(t.status?.toLowerCase())).length;
    const cancelledCount = tasksData.filter((t) => t.status?.toLowerCase() === "cancelled").length;
    return {
      aiCompleted: activityRecords.filter((r) => r.type === "AI").length,
      pdDue: activityRecords.filter((r) => r.type === "PD").length,
      openHealthCases: activityRecords.filter((r) => r.type === "HL" && !r.details.toLowerCase().includes("completed") && !r.details.toLowerCase().includes("resolved")).length,
      calvingEvents: activityRecords.filter((r) => r.type === "CD").length,
      pendingFollowups: pendingCount,
      cancelledRequests: cancelledCount,
    };
  }, [activityRecords, tasksData]);

  // Scheduled backend tasks are the source of truth for operational planning.
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    return tasksData
      .filter((task) => {
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const complete = ["completed", "done", "cancelled"].includes(
          String(task.status || "").toLowerCase(),
        );
        return dueDate && !Number.isNaN(dueDate.getTime()) && dueDate >= today && !complete;
      })
      .map((task) => {
        const dueDate = new Date(task.dueDate);
        const animal = task.animalIds?.[0] || {};
        return {
          time: dueDate.toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          rawTime: dueDate.getTime(),
          title: task.notes || String(task.taskType || "Scheduled task").replaceAll("_", " "),
          subtitle: `${animal.earTag || animal.animalId || "Animal not recorded"} · ${task.farmerId?.name || "Farmer not recorded"}`,
          badgeText: task.category || "Scheduled",
          badgeColor: "badge-info",
          icon: "📋",
        };
      })
      .sort((a, b) => a.rawTime - b.rawTime)
      .slice(0, 5);
  }, [tasksData]);

  // Operational priority alerts
  const operationalAlerts = useMemo(() => {
    const today = new Date();
    return tasksData
      .filter((task) => {
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const complete = ["completed", "done", "cancelled"].includes(
          String(task.status || "").toLowerCase(),
        );
        return dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < today && !complete;
      })
      .map((task) => ({
        id: `alert-task-${task._id}`,
        title: "Overdue scheduled task",
        description: task.notes || "This backend task is past its scheduled due date.",
        urgency: task.priority === 1 ? "high" : "medium",
        icon: "⚠️",
      }))
      .slice(0, 4);
  }, [tasksData]);

  // Barangay workload composition
  const barangayWorkload = useMemo(() => {
    const counts = {};
    activityRecords.forEach(r => {
      if (r.barangay && r.barangay !== "—") {
        counts[r.barangay] = (counts[r.barangay] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / (activityRecords.length || 1)) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [activityRecords]);

  // Export filtered logs
  const handleDirectExport = (exportFormat) => {
    const headers = ["Type", "Animal ID", "Ear Tag", "Farmer Owner", "Barangay", "Details", "Date"];
    const rows = filteredActivityRecords.map(r => [
      r.type,
      r.animalId,
      r.earTag,
      r.farmer,
      r.barangay,
      r.details,
      r.formattedDate
    ]);

    if (exportFormat === "csv") {
      downloadCsv({ headers, rows, fileName: `DA_Filtered_Activity_${new Date().toLocaleDateString()}` });
      toast.success("CSV dataset exported successfully.");
    } else if (exportFormat === "print") {
      window.print();
    } else {
      const doc = new jsPDF({ orientation: "landscape", format: "a4", unit: "mm" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("DEPARTMENT OF AGRICULTURE", doc.internal.pageSize.width / 2, 8, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("FILTERED WORKS ACTIVITY EXPORT", doc.internal.pageSize.width / 2, 14, { align: "center" });

      doc.autoTable({
        head: [headers],
        body: rows,
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [0, 100, 59], textColor: 255 },
        margin: { top: 20 }
      });
      doc.save(`DA_Filtered_Activity_${new Date().toLocaleDateString()}.pdf`);
      toast.success("PDF report generated successfully.");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
      <Topbar
        title="Operations Center"
        subtitle="Live tracking of breeding schedules, follow-up timelines, and municipal dispatches"
        searchPlaceholder="Search operational logs..."
        searchValue={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
      />

      <main className="p-6 space-y-6 flex-1 flex flex-col min-h-0 font-sans">

        {/* 1. Operational Summary Row */}
        <section>
          <SectionHeader title="Operational Summary" subtitle="Key metrics detailing active field processes in the municipality" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <StatCard label="AI Completed" value={`${summaryKPIs.aiCompleted}`} icon={<CheckCircle size={16} />} />
            <StatCard label="PD Checks due" value={`${summaryKPIs.pdDue}`} icon={<Calendar size={16} />} />
            <StatCard label="Open Health Cases" value={`${summaryKPIs.openHealthCases}`} icon={<AlertCircle size={16} />} trendType="negative" />
            <StatCard label="Calving Events" value={`${summaryKPIs.calvingEvents}`} icon={<FileCode size={16} />} />
            <StatCard label="Pending Follow-ups" value={`${summaryKPIs.pendingFollowups}`} icon={<Clock size={16} />} />
            <StatCard label="Cancelled Requests" value={`${summaryKPIs.cancelledRequests}`} icon={<ShieldAlert size={16} />} />
          </div>
        </section>

        {/* Chronological & Alerts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* 2. Upcoming Events timeline */}
          <div className="lg:col-span-6 bg-base-100 border border-base-300 rounded-2xl p-5 shadow-2xs">
            <SectionHeader title="Upcoming Events Timeline" subtitle="Technician calendar planning: expected calvings, PDs, and heat checks" />
            <div className="space-y-4 mt-4">
              {upcomingEvents.length === 0 ? (
                <p className="text-xs text-base-content/40 italic font-semibold py-4 text-center">
                  No upcoming timeline events scheduled.
                </p>
              ) : (
                upcomingEvents.map((evt, i) => (
                  <TimelineCard
                    key={i}
                    time={evt.time}
                    title={evt.title}
                    subtitle={evt.subtitle}
                    badgeText={evt.badgeText}
                    badgeColor={evt.badgeColor}
                    icon={evt.icon}
                  />
                ))
              )}
            </div>
          </div>

          {/* 3. Operational Alerts */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-base-100 border border-base-300 rounded-2xl p-5 shadow-2xs">
              <SectionHeader title="Operational Alerts" subtitle="Crucial alerts requiring immediate intervention or confirmation" />
              <div className="space-y-3 mt-4">
                {operationalAlerts.length === 0 ? (
                  <p className="text-xs text-base-content/40 italic font-semibold py-4 text-center">
                    All operations are running on schedule.
                  </p>
                ) : (
                  operationalAlerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      title={alert.title}
                      description={alert.description}
                      urgency={alert.urgency}
                      icon={alert.icon}
                    />
                  ))
                )}
              </div>
            </div>

            {/* 4. Municipality Workload */}
            <div className="bg-base-100 border border-base-300 rounded-2xl p-5 shadow-2xs">
              <SectionHeader title="Municipality Workload distribution" subtitle="Barangay task concentration analysis" />
              <div className="space-y-3 mt-4">
                {barangayWorkload.map((brgy, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-base-content">{brgy.name}</span>
                      <span className="font-bold text-base-content/50 font-mono">{brgy.count} logs ({brgy.percentage}%)</span>
                    </div>
                    <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${brgy.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* 5. Report Workspace Table */}
        <div className="bg-base-100 border border-base-300 rounded-2xl shadow-2xs overflow-hidden flex-1 flex flex-col min-h-0">

          <div className="p-4 border-b border-base-300 flex justify-between items-center bg-base-200/50 flex-wrap gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBottomTab("live-records")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold tracking-wide uppercase transition-all cursor-pointer ${
                  bottomTab === "live-records"
                    ? "bg-primary text-white shadow-xs"
                    : "text-base-content/60 hover:bg-base-200"
                }`}
              >
                Live Work Logs
              </button>
              <button
                type="button"
                onClick={() => setBottomTab("library")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold tracking-wide uppercase transition-all cursor-pointer ${
                  bottomTab === "library"
                    ? "bg-primary text-white shadow-xs"
                    : "text-base-content/60 hover:bg-base-200"
                }`}
              >
                Municipal Archives
              </button>
            </div>

            {/* Export Selection Tools */}
            {bottomTab === "live-records" && filteredActivityRecords.length > 0 && (
              <div className="flex items-center gap-1.5 border border-base-300 bg-base-100 rounded-xl p-1.5">
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-base-content/40 px-2">Export Tools:</span>
                <button
                  type="button"
                  onClick={() => handleDirectExport("pdf")}
                  className="btn btn-ghost btn-xs text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <FileText size={12} className="text-rose-500" /> PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectExport("csv")}
                  className="btn btn-ghost btn-xs text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet size={12} className="text-emerald-500" /> CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectExport("print")}
                  className="btn btn-ghost btn-xs text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Printer size={12} className="text-blue-500" /> Print
                </button>
              </div>
            )}
          </div>

          {/* Table content panel */}
          <div className="flex-1 overflow-x-auto">
            {bottomTab === "live-records" ? (
              isLoadingActivities ? (
                <div className="p-12 flex flex-col items-center justify-center space-y-2 text-base-content/40">
                  <span className="loading loading-spinner loading-md text-primary" />
                  <p className="text-xs font-semibold italic animate-pulse">Syncing live records...</p>
                </div>
              ) : filteredActivityRecords.length === 0 ? (
                <div className="p-12 text-center text-base-content/40 italic text-xs font-semibold">
                  No live work logs match your current query filters.
                </div>
              ) : (
                <table className="table table-sm w-full divide-y divide-base-300">
                  <thead className="bg-base-200 text-base-content/50 uppercase font-bold tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-5 text-center w-[70px]">Type</th>
                      <th className="py-3 px-4 text-left">Animal / Tag</th>
                      <th className="py-3 px-4 text-left">Farmer Client</th>
                      <th className="py-3 px-4 text-left">Location</th>
                      <th className="py-3 px-4 text-left">Event Details</th>
                      <th className="py-3 px-5 text-right">Date Occurred</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-300 text-base-content/85 font-semibold text-xs">
                    {filteredActivityRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-base-200/50 transition-colors">
                        <td className="py-3 px-5 text-center">
                          <span className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] border ${
                            record.type === "AI"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : record.type === "PD"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                              : record.type === "HL"
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }`}>
                            {record.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-base-content">
                          {record.animalId} <span className="text-base-content/40 font-normal">({record.earTag})</span>
                        </td>
                        <td className="py-3 px-4 text-xs font-bold">{record.farmer}</td>
                        <td className="py-3 px-4 text-xs font-medium">{record.barangay}</td>
                        <td className="py-3 px-4 text-xs font-medium text-base-content/75">
                          {record.details}
                        </td>
                        <td className="py-3 px-5 text-right text-xs font-mono font-bold text-base-content/60">{record.formattedDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : filteredReports.length === 0 ? (
              <div className="p-12 text-center text-base-content/40 italic text-xs font-semibold">
                No archived report documents matching criteria.
              </div>
            ) : (
              <table className="table table-sm w-full divide-y divide-base-300">
                <thead className="bg-base-200 text-base-content/50 uppercase font-bold tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-5 text-left">Document Title</th>
                    <th className="py-3 px-4 text-left">Compiled</th>
                    <th className="py-3 px-4 text-left">Scope</th>
                    <th className="py-3 px-4 text-left">File Size</th>
                    <th className="py-3 px-4 text-center">Format</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-300 text-base-content/85 font-semibold text-xs">
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-base-200/50 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-base-content">
                        {report.name}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono">{report.date}</td>
                      <td className="py-3.5 px-4 text-xs font-medium">{report.type}</td>
                      <td className="py-3.5 px-4 text-xs font-mono">{report.size}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] border ${
                          report.format === "PDF"
                            ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        }`}>
                          {report.format}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-500">
                          {report.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleDownloadReport(report)}
                            className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-primary hover:bg-base-200 cursor-pointer"
                            title="Download Report"
                          >
                            <Download size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteReport(report.id)}
                            className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-rose-600 hover:bg-base-200 cursor-pointer"
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
