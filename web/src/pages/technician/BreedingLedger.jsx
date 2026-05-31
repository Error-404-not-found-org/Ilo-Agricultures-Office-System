import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import { TableRowSkeleton } from "../../components/Skeleton";
import {
  Search,
  Download,
  Printer,
  ListChecks,
  Syringe,
  Clock,
  CheckCircle,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Info,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  Baby,
} from "lucide-react";
import Topbar from "../../components/ui/Topbar";

export default function BreedingLedger() {
  const toast = useToast();
  const queryClient = useQueryClient();

  // ---- APPLICATION STATES ----
  const [activeTab, setActiveTab] = useState("insemination"); // "insemination", "pregnancy", "calving"
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  const itemsPerPage = 10;

  // ---- LIVE CONCURRENT DATA PIPELINE ----
  const { data: inseminations = [], isLoading: isLoadingIns } = useQuery({
    queryKey: ["technician", "inseminations-list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/inseminations?limit=1000");
      return res.data?.inseminations || [];
    }
  });

  const { data: pregnancyChecks = [], isLoading: isLoadingPreg } = useQuery({
    queryKey: ["technician", "pregnancy-checks-list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/pregnancy-checks?limit=1000");
      return res.data?.data || [];
    }
  });

  const { data: calvings = [], isLoading: isLoadingCalvings } = useQuery({
    queryKey: ["technician", "calvings-list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/calvings?limit=1000");
      return res.data?.data || [];
    }
  });

  const isLoading = isLoadingIns || isLoadingPreg || isLoadingCalvings;

  // ---- DYNAMIC STATS RESOLVERS ----
  const stats = useMemo(() => {
    const totalInseminations = inseminations.length;
    const confirmedPregnancies = pregnancyChecks.filter(
      p => p.pregnancyDiagnosis?.result === "Pregnant"
    ).length;
    const totalCalvings = calvings.length;
    const pendingAI = inseminations.filter(
      i => i.status === "pending" || i.status === "in-progress"
    ).length;
    const totalRecords = totalInseminations + pregnancyChecks.length + totalCalvings;

    return {
      totalRecords,
      totalInseminations,
      confirmedPregnancies,
      totalCalvings,
      pendingAI,
    };
  }, [inseminations, pregnancyChecks, calvings]);

  // ---- MEMOIZED DATA PROCESSING (Sorting & Filtering) ----
  const processedRecords = useMemo(() => {
    let list = [];
    if (activeTab === "insemination") {
      list = inseminations.map(ins => {
        const visitDate = ins.scheduledDate || ins.preferredDate || ins.createdAt;
        return {
          id: ins._id,
          date: new Date(visitDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          rawDate: visitDate,
          farmer: ins.farmerId?.name || "N/A",
          animal: ins.animalId?.earTag || "N/A",
          barangay: ins.farmerId?.address?.barangay || "Oton",
          type: "AI",
          detail: ins.sireCode ? `Sire: ${ins.sireCode}` : ins.sireBreed ? `Sire: ${ins.sireBreed}` : "—",
          status: ins.status || "pending",
          attemptNumber: ins.attemptNumber || 1,
          comment: ins.comment || "",
          technicianNote: ins.technicianNote || "",
          sireBreed: ins.sireBreed || "",
          sireCode: ins.sireCode || "",
          estrus: ins.estrus || "Natural"
        };
      });
    } else if (activeTab === "pregnancy") {
      list = pregnancyChecks.map(preg => {
        const checkDate = preg.pregnancyDiagnosis?.date || preg.createdAt;
        return {
          id: preg._id,
          date: new Date(checkDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          rawDate: checkDate,
          farmer: preg.farmerId?.name || "N/A",
          animal: preg.animalId?.earTag || "N/A",
          barangay: preg.farmerId?.address?.barangay || "Oton",
          type: "Pregnancy Check",
          result: preg.pregnancyDiagnosis?.result || "Pending Result",
          targetCalvingDate: preg.targetCalvingDate 
            ? new Date(preg.targetCalvingDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "—",
          technicianNote: preg.technicianNote || "",
          status: preg.pregnancyDiagnosis?.result === "Pregnant" ? "done" : preg.pregnancyDiagnosis?.result === "Empty" ? "rejected" : "pending"
        };
      });
    } else if (activeTab === "calving") {
      list = calvings.map(calv => {
        const calvingDate = calv.date || calv.createdAt;
        return {
          id: calv._id,
          date: new Date(calvingDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          rawDate: calvingDate,
          farmer: calv.farmerId?.name || "N/A",
          animal: calv.animalId?.earTag || "N/A",
          barangay: calv.farmerId?.address?.barangay || "Oton",
          type: "Calving",
          numberOfCalves: calv.numberOfCalves || calv.calves?.length || 1,
          calvingEase: calv.calvingEase || "Natural",
          calves: calv.calves || [],
          locationAddress: calv.locationAddress || "Oton, Iloilo",
          technicianNote: calv.technicianNote || "",
          status: "done"
        };
      });
    }

    // Apply text search queries
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => 
        r.farmer.toLowerCase().includes(q) ||
        r.animal.toLowerCase().includes(q) ||
        r.barangay.toLowerCase().includes(q) ||
        (r.detail && r.detail.toLowerCase().includes(q)) ||
        (r.result && r.result.toLowerCase().includes(q)) ||
        (r.calvingEase && r.calvingEase.toLowerCase().includes(q)) ||
        r.id.toLowerCase().includes(q)
      );
    }

    // Apply status filters
    if (statusFilter) {
      list = list.filter(r => r.status === statusFilter);
    }

    // Apply date/month filter
    if (monthFilter) {
      list = list.filter(r => r.date.includes(monthFilter));
    }

    // Apply dynamic column sorting
    if (sortConfig.key) {
      list.sort((a, b) => {
        const valA = String(a[sortConfig.key] || "");
        const valB = String(b[sortConfig.key] || "");
        return valA.localeCompare(valB) * (sortConfig.direction === "asc" ? 1 : -1);
      });
    } else {
      list.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());
    }

    return list;
  }, [activeTab, inseminations, pregnancyChecks, calvings, searchQuery, statusFilter, monthFilter, sortConfig]);

  // ---- PAGINATION COMPUTATION ----
  const totalItems = processedRecords.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = processedRecords.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setMonthFilter("");
    setCurrentPage(1);
  };

  const handleOpenModal = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleDeleteRecord = async (record) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete ${activeTab === "insemination" ? "AI Insemination" : activeTab === "pregnancy" ? "Pregnancy Check" : "Calving"} Record`,
      message: `Are you sure you want to delete this historical ${activeTab} record entry? This operation cannot be undone.`,
      onConfirm: async () => {
        try {
          let endpoint = "";
          if (activeTab === "insemination") {
            endpoint = `/insemination/${record.id}`;
          } else if (activeTab === "pregnancy") {
            endpoint = `/technician/pregnancy-checks/${record.id}`;
          } else if (activeTab === "calving") {
            endpoint = `/technician/calvings/${record.id}`;
          }

          await axiosInstance.delete(endpoint);
          toast.success("Entry removed successfully.");
          
          // Invalidate queries to trigger refresh
          queryClient.invalidateQueries(["technician", "inseminations-list"]);
          queryClient.invalidateQueries(["technician", "pregnancy-checks-list"]);
          queryClient.invalidateQueries(["technician", "calvings-list"]);
        } catch (err) {
          toast.error("Failed to remove historical entry.");
        }
      }
    });
  };

  // Helper values for dynamic UI styling templates
  const avatarBgColors = [
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
    "bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400",
  ];

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "done":
      case "Pregnant":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50";
      case "in-progress":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50";
      case "approved":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/50";
      case "rejected":
      case "Empty":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50";
      default:
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50";
    }
  };

  const getStatusLabel = (status) => {
    return (
      {
        done: "Completed",
        "in-progress": "In Progress",
        pending: "Pending",
        approved: "Approved",
        rejected: "Failed / Empty",
        Pregnant: "Pregnant",
        Empty: "Empty",
      }[status] || status
    );
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (processedRecords.length === 0) {
      toast.error("No entries available to export.");
      return;
    }
    
    let headers = [];
    let rows = [];

    if (activeTab === "insemination") {
      headers = ["Record ID", "Visit Date", "Farmer Name", "Animal Tag", "Barangay", "Attempt", "Sire Genetics", "Estrus", "Status"];
      rows = processedRecords.map(r => [
        r.id,
        r.date,
        r.farmer,
        r.animal,
        r.barangay,
        `Attempt #${r.attemptNumber}`,
        r.sireCode || r.sireBreed || "N/A",
        r.estrus,
        getStatusLabel(r.status)
      ]);
    } else if (activeTab === "pregnancy") {
      headers = ["Record ID", "Diagnosis Date", "Farmer Name", "Animal Tag", "Barangay", "Diagnosis Outcome", "Target Calving Date", "Technician Notes"];
      rows = processedRecords.map(r => [
        r.id,
        r.date,
        r.farmer,
        r.animal,
        r.barangay,
        r.result,
        r.targetCalvingDate,
        r.technicianNote || "None"
      ]);
    } else if (activeTab === "calving") {
      headers = ["Record ID", "Calving Date", "Farmer Name", "Animal Tag", "Barangay", "Calves Born", "Calving Ease", "Location", "Technician Notes"];
      rows = processedRecords.map(r => [
        r.id,
        r.date,
        r.farmer,
        r.animal,
        r.barangay,
        r.numberOfCalves,
        r.calvingEase,
        r.locationAddress || "N/A",
        r.technicianNote || "None"
      ]);
    }

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BreedSmart_${activeTab}_records_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---- DYNAMIC DEPARTMENT OF AGRICULTURE (DA) COMPILATION PIPELINE ----
  const daReportEntries = useMemo(() => {
    const ai = inseminations.map(ins => {
      const visitDate = ins.scheduledDate || ins.preferredDate || ins.createdAt;
      return {
        type: "AI",
        animalId: ins.animalId?.animalId || "—",
        earTag: ins.animalId?.earTag || "—",
        brand: ins.animalId?.brand || "—",
        species: ins.animalId?.species || "Cattle",
        breed: ins.animalId?.breed || "Crossbreed",
        color: ins.animalId?.color || "N/A",
        address: `${ins.farmerId?.address?.barangay || "Oton"}, Oton, Iloilo`,
        farmer: ins.farmerId?.name || "—",
        aiDate: new Date(visitDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
        attempt: ins.attemptNumber || 1,
        estrus: ins.estrus || "Natural",
        sireBreed: ins.sireBreed || "—",
        sireCode: ins.sireCode || "—",
        pdDate: "—",
        pdResult: "—",
        cdDate: "—",
        cdCount: "—",
        calf1Id: "—",
        calf1Sex: "—",
        calf2Id: "—",
        calf2Sex: "—",
        cdEase: "—",
        rawDate: visitDate
      };
    });

    const pd = pregnancyChecks.map(preg => {
      const checkDate = preg.pregnancyDiagnosis?.date || preg.createdAt;
      return {
        type: "PD",
        animalId: preg.animalId?.animalId || "—",
        earTag: preg.animalId?.earTag || "—",
        brand: preg.animalId?.brand || "—",
        species: preg.animalId?.species || "Cattle",
        breed: preg.animalId?.breed || "Crossbreed",
        color: preg.animalId?.color || "N/A",
        address: `${preg.farmerId?.address?.barangay || "Oton"}, Oton, Iloilo`,
        farmer: preg.farmerId?.name || "—",
        aiDate: "—",
        attempt: "—",
        estrus: "—",
        sireBreed: "—",
        sireCode: "—",
        pdDate: new Date(checkDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
        pdResult: preg.pregnancyDiagnosis?.result || "Pending Result",
        cdDate: "—",
        cdCount: "—",
        calf1Id: "—",
        calf1Sex: "—",
        calf2Id: "—",
        calf2Sex: "—",
        cdEase: "—",
        rawDate: checkDate
      };
    });

    const cd = calvings.map(calv => {
      const calvingDate = calv.date || calv.createdAt;
      const calf1 = calv.calves?.[0] || {};
      const calf2 = calv.calves?.[1] || {};
      return {
        type: "CD",
        animalId: calv.animalId?.animalId || "—",
        earTag: calv.animalId?.earTag || "—",
        brand: calv.animalId?.brand || "—",
        species: calv.animalId?.species || "Cattle",
        breed: calv.animalId?.breed || "Crossbreed",
        color: calv.animalId?.color || "N/A",
        address: `${calv.farmerId?.address?.barangay || "Oton"}, Oton, Iloilo`,
        farmer: calv.farmerId?.name || "—",
        aiDate: "—",
        attempt: "—",
        estrus: "—",
        sireBreed: "—",
        sireCode: "—",
        pdDate: "—",
        pdResult: "—",
        cdDate: new Date(calvingDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
        cdCount: calv.numberOfCalves || calv.calves?.length || 1,
        calf1Id: calf1.earTag || "—",
        calf1Sex: calf1.sex || "—",
        calf2Id: calf2.earTag || "—",
        calf2Sex: calf2.sex || "—",
        cdEase: calv.calvingEase || "Natural",
        rawDate: calvingDate
      };
    });

    return [...ai, ...pd, ...cd].sort(
      (a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime()
    );
  }, [inseminations, pregnancyChecks, calvings]);

  const handleExportDAReport = () => {
    if (daReportEntries.length === 0) {
      toast.error("No breeding actions available to export.");
      return;
    }

    const headers = [
      "Data Type",
      "Animal ID No.",
      "Ear Tag No.",
      "Brand",
      "Species",
      "Breed",
      "Color",
      "Address",
      "Farmer",
      "AI Date",
      "No. of AI (Attempt)",
      "Estrus",
      "Sire Breed",
      "Sire Code",
      "PD Date",
      "PD Result",
      "Calving Date",
      "No. of Calving",
      "Calf 1 ID",
      "Calf 1 Sex",
      "Calf 2 ID",
      "Calf 2 Sex",
      "Calving Ease"
    ];

    const rows = daReportEntries.map(r => [
      r.type,
      r.animalId,
      r.earTag,
      r.brand,
      r.species,
      r.breed,
      r.color,
      r.address,
      r.farmer,
      r.aiDate,
      r.attempt,
      r.estrus,
      r.sireBreed,
      r.sireCode,
      r.pdDate,
      r.pdResult,
      r.cdDate,
      r.cdCount,
      r.calf1Id,
      r.calf1Sex,
      r.calf2Id,
      r.calf2Sex,
      r.cdEase
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + "DEPARTMENT OF AGRICULTURE\n"
      + "Bureau of Animal Industry - Unified National Artificial Insemination Program\n"
      + "Monthly Accomplishment Report\n\n"
      + headers.join(",") + "\n" 
      + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DA_Unified_AI_Accomplishment_Report_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Topbar
        title="Breeding Ledger"
        subtitle="Unified lifecycle logs tracking Insemination, Pregnancy, and Calving Drop progression"
        searchPlaceholder={`Search within ${activeTab === "insemination" ? "AI records" : activeTab === "pregnancy" ? "pregnancy diagnostics" : "calving logs"}...`}
        searchValue={searchQuery}
        onSearchChange={(e) => {
          setSearchQuery(e.target.value);
          setCurrentPage(1);
        }}
      >
        <button
          onClick={handleExportCSV}
          className="btn btn-sm bg-[#00643b] hover:bg-[#004d2e] border-none text-white text-xs font-bold gap-1.5 rounded-xl px-4 cursor-pointer"
        >
          <Download size={13} /> Export Tab CSV
        </button>
      </Topbar>

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {/* Dynamic Breeding Mini Grid Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            {
              label: "Breeding Actions",
              val: stats.totalRecords,
              color: "text-[#00643b] bg-emerald-50 dark:bg-emerald-950/20",
              icon: <Layers size={16} />,
            },
            {
              label: "Inseminations Done",
              val: stats.totalInseminations,
              color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20",
              icon: <Syringe size={16} />,
            },
            {
              label: "Pregnant Confirmed",
              val: stats.confirmedPregnancies,
              color: "text-purple-600 bg-purple-50 dark:bg-purple-950/20",
              icon: <Sparkles size={16} />,
            },
            {
              label: "Calvings Logged",
              val: stats.totalCalvings,
              color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20",
              icon: <Baby size={16} />,
            },
            {
              label: "Pending AI Tasks",
              val: stats.pendingAI,
              color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20",
              icon: <Clock size={16} />,
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
                <div className="text-xl font-black tracking-tight">
                  {isLoading ? "..." : stat.val}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Cohesive Reproduction Tab Swapping ribbon */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          {[
            { id: "insemination", label: "Insemination (AI)", count: stats.totalInseminations, color: "border-blue-500 text-blue-600" },
            { id: "pregnancy", label: "Pregnancy Check (PD)", count: pregnancyChecks.length, color: "border-purple-500 text-purple-600" },
            { id: "calving", label: "Calving / Calf Drop (CD)", count: stats.totalCalvings, color: "border-emerald-500 text-emerald-600" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setCurrentPage(1);
                clearFilters();
              }}
              className={`py-3 px-6 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === tab.id
                  ? `${tab.color} bg-white dark:bg-slate-950 font-extrabold rounded-t-xl`
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id 
                  ? "bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-350"
                  : "bg-slate-100/60 dark:bg-slate-900/60 text-slate-400"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filters and Datatable Platform wrapper */}
        <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top Filter Ribbon */}
          <div className="flex items-center gap-2 flex-wrap mb-4 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wide px-1">
              <SlidersHorizontal size={13} />
              <span>Filters:</span>
            </div>

            {activeTab === "insemination" && (
              <select
                className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 focus:bg-white! dark:focus:bg-slate-950! focus:border-[#00643b] dark:focus:border-emerald-500 text-slate-700 dark:text-slate-200 outline-none transition-all duration-200"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="done">Completed</option>
                <option value="in-progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
              </select>
            )}

            {activeTab === "pregnancy" && (
              <select
                className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 focus:bg-white! dark:focus:bg-slate-950! focus:border-[#00643b] dark:focus:border-emerald-500 text-slate-700 dark:text-slate-200 outline-none transition-all duration-200"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Outcomes</option>
                <option value="done">Pregnant</option>
                <option value="rejected">Empty</option>
              </select>
            )}

            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 focus:bg-white! dark:focus:bg-slate-950! focus:border-[#00643b] dark:focus:border-emerald-500 text-slate-700 dark:text-slate-200 outline-none transition-all duration-200"
              value={monthFilter}
              onChange={(e) => {
                setMonthFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Months</option>
              <option value="May">May 2026</option>
              <option value="Apr">April 2026</option>
              <option value="Mar">March 2026</option>
            </select>

            {(statusFilter || monthFilter || searchQuery) && (
              <button
                onClick={clearFilters}
                className="btn btn-sm btn-ghost text-xs text-rose-600 font-bold gap-1 rounded-lg cursor-pointer"
              >
                <X size={12} /> Clear Filters
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <button
                onClick={handleExportDAReport}
                className="btn btn-xs bg-linear-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 border-none text-white text-[11px] font-bold gap-1.5 rounded-xl px-3 cursor-pointer shadow-sm"
                title="Export Department of Agriculture Unified Report"
              >
                <Sparkles size={11} /> DA Report (CSV)
              </button>
              <button
                onClick={() => window.print()}
                className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 text-[11px] font-bold gap-1.5 rounded-xl px-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Printer size={11} /> Print Official Form
              </button>
              <span className="text-xs text-slate-400 font-semibold border-l border-slate-200 dark:border-slate-800 pl-2 whitespace-nowrap">
                {isLoading ? "Fetching records..." : `${totalItems} entry${totalItems !== 1 ? "s" : ""} matched`}
              </span>
            </div>
          </div>

          {/* Core Service Database Grid */}
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="table w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-wider select-none">
                  {/* Dynamic Column Headers depending on Active Tab */}
                  {activeTab === "insemination" && (
                    <>
                      {["id", "date", "farmer", "animal", "barangay", "attempt", "detail", "status"].map((colKey) => (
                        <th
                          key={colKey}
                          onClick={() => handleSort(colKey)}
                          className="p-3.5 pl-5 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>
                              {colKey === "id" ? "#" : colKey === "detail" ? "Sire Details" : colKey}
                            </span>
                            {sortConfig.key === colKey && (
                              <span className="text-[10px] text-[#00643b]">
                                {sortConfig.direction === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </>
                  )}

                  {activeTab === "pregnancy" && (
                    <>
                      {["id", "date", "farmer", "animal", "barangay", "result", "targetCalvingDate"].map((colKey) => (
                        <th
                          key={colKey}
                          onClick={() => handleSort(colKey)}
                          className="p-3.5 pl-5 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>
                              {colKey === "id" ? "#" : colKey === "date" ? "Diagnosis Date" : colKey === "result" ? "Outcome" : colKey === "targetCalvingDate" ? "Est. Calving Date" : colKey}
                            </span>
                            {sortConfig.key === colKey && (
                              <span className="text-[10px] text-[#00643b]">
                                {sortConfig.direction === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </>
                  )}

                  {activeTab === "calving" && (
                    <>
                      {["id", "date", "farmer", "animal", "barangay", "numberOfCalves", "calvingEase"].map((colKey) => (
                        <th
                          key={colKey}
                          onClick={() => handleSort(colKey)}
                          className="p-3.5 pl-5 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>
                              {colKey === "id" ? "#" : colKey === "date" ? "Calving Date" : colKey === "numberOfCalves" ? "Offspring Born" : colKey === "calvingEase" ? "Calving Ease" : colKey}
                            </span>
                            {sortConfig.key === colKey && (
                              <span className="text-[10px] text-[#00643b]">
                                {sortConfig.direction === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </>
                  )}
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                {isLoading ? (
                  [...Array(6)].map((_, idx) => <TableRowSkeleton key={idx} />)
                ) : paginatedRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="text-center p-12 text-slate-400 dark:text-slate-500 font-medium"
                    >
                      No matching reproduction entries found for {activeTab === "insemination" ? "AI visits" : activeTab === "pregnancy" ? "pregnancy diagnostics" : "calving logs"}.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((r, i) => {
                    const initials = r.farmer
                      ? r.farmer.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                      : "FI";
                    const colorIndex = i % avatarBgColors.length;

                    return (
                      <tr
                        key={r.id}
                        onClick={() => handleOpenModal(r)}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors cursor-pointer"
                      >
                        <td className="p-3.5 pl-5 font-bold text-slate-400 truncate max-w-[80px]">
                          #{r.id.slice(-6)}
                        </td>
                        <td className="p-3.5 font-medium whitespace-nowrap">
                          {r.date}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${avatarBgColors[colorIndex]}`}
                            >
                              {initials}
                            </div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {r.farmer}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 font-extrabold text-[#00643b] dark:text-[#10b981]">
                          {r.animal}
                        </td>
                        <td className="p-3.5 font-medium text-slate-500">
                          {r.barangay}
                        </td>

                        {/* RENDER INSEMINATION COLUMNS */}
                        {activeTab === "insemination" && (
                          <>
                            <td className="p-3.5 font-bold text-slate-700 dark:text-slate-350">
                              Attempt #{r.attemptNumber || 1}
                            </td>
                            <td className="p-3.5 font-medium max-w-[140px] truncate text-slate-600 dark:text-slate-400">
                              {r.detail}
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${getStatusBadgeClass(r.status)}`}
                              >
                                {getStatusLabel(r.status)}
                              </span>
                            </td>
                          </>
                        )}

                        {/* RENDER PREGNANCY COLUMNS */}
                        {activeTab === "pregnancy" && (
                          <>
                            <td className="p-3.5">
                              <span
                                className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider border ${
                                  r.result === "Pregnant"
                                    ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400"
                                    : r.result === "Empty"
                                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400"
                                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400"
                                }`}
                              >
                                {r.result}
                              </span>
                            </td>
                            <td className="p-3.5 font-bold text-[#00643b] dark:text-emerald-500">
                              {r.targetCalvingDate}
                            </td>
                          </>
                        )}

                        {/* RENDER CALVING COLUMNS */}
                        {activeTab === "calving" && (
                          <>
                            <td className="p-3.5 font-bold text-slate-700 dark:text-slate-300">
                              {r.numberOfCalves} calf / calves
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider border ${
                                  ["Normal", "Natural"].includes(r.calvingEase)
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                                    : ["Difficult", "Cesarean"].includes(r.calvingEase)
                                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400"
                                      : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400"
                                }`}
                              >
                                {r.calvingEase}
                              </span>
                            </td>
                          </>
                        )}

                        <td
                          className="p-3.5 pr-5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenModal(r)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-800 hover:border-[#00643b] dark:hover:border-emerald-600 hover:text-[#00643b] flex items-center gap-1 transition-all bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 cursor-pointer"
                            >
                              <Eye size={12} /> Inspect
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(r)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between mt-3">
            <span className="text-[11px] font-medium text-slate-400">
              Showing {totalItems === 0 ? 0 : startIndex + 1}–
              {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}{" "}
              ledger items
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
                className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1.5 disabled:opacity-40"
              >
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <button
                    key={pageNumber}
                    disabled={isLoading}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                      currentPage === pageNumber
                        ? "bg-[#00643b] text-white shadow-xs"
                        : "border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ),
              )}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages || isLoading}
                className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1.5 disabled:opacity-40"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ===== DETAILED INSPECTION MODAL ===== */}
      {isModalOpen && selectedRecord && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="card w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400 uppercase">
                  {activeTab === "insemination" ? "AI Insemination" : activeTab === "pregnancy" ? "Pregnancy Diagnosis" : "Calving Event"} Details
                </span>
                <span
                  className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${getStatusBadgeClass(selectedRecord.status)}`}
                >
                  {getStatusLabel(selectedRecord.status)}
                </span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn btn-xs btn-ghost btn-circle text-slate-400 hover:text-rose-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-900 text-xs">
              {[
                { key: "Date Registered", val: selectedRecord.date },
                { key: "Farmer Client Name", val: selectedRecord.farmer },
                {
                  key: "Ear Tag Reference ID",
                  val: selectedRecord.animal,
                  customStyle: "text-[#00643b] font-black",
                },
                {
                  key: "Deployment Sector",
                  val: `${selectedRecord.barangay}, Oton, Iloilo`,
                },
              ].map((row, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center py-2.5"
                >
                  <span className="text-slate-400 font-semibold text-left">
                    {row.key}
                  </span>
                  <span
                    className={`font-bold text-slate-800 dark:text-slate-200 text-right ${row.customStyle || ""}`}
                  >
                    {row.val}
                  </span>
                </div>
              ))}

              {/* DYNAMIC TAB FIELDS FOR INSEMINATION */}
              {activeTab === "insemination" && (
                <>
                  {[
                    { key: "Sire Breed", val: selectedRecord.sireBreed || "N/A" },
                    { key: "Sire Code Reference", val: selectedRecord.sireCode || "N/A" },
                    { key: "Attempt Number", val: `#${selectedRecord.attemptNumber}` },
                    { key: "Estrus Detection", val: selectedRecord.estrus },
                    { key: "Farmer Observations", val: selectedRecord.comment || "None", customStyle: "italic text-slate-500" },
                    { key: "Technician Observations", val: selectedRecord.technicianNote || "None", customStyle: "italic text-[#00643b] dark:text-emerald-400" }
                  ].map((row, index) => (
                    <div key={index} className="flex justify-between items-center py-2.5">
                      <span className="text-slate-400 font-semibold text-left">{row.key}</span>
                      <span className={`font-bold text-slate-800 dark:text-slate-200 text-right ${row.customStyle || ""}`}>{row.val}</span>
                    </div>
                  ))}
                </>
              )}

              {/* DYNAMIC TAB FIELDS FOR PREGNANCY CHECK */}
              {activeTab === "pregnancy" && (
                <>
                  {[
                    { key: "Pregnancy Diagnostic", val: selectedRecord.result, customStyle: "text-purple-600 dark:text-purple-400 font-black" },
                    { key: "Estimated Calving Date", val: selectedRecord.targetCalvingDate, customStyle: "text-[#00643b] dark:text-emerald-400 font-extrabold" },
                    { key: "Technician Remarks", val: selectedRecord.technicianNote || "None", customStyle: "italic text-slate-500" }
                  ].map((row, index) => (
                    <div key={index} className="flex justify-between items-center py-2.5">
                      <span className="text-slate-400 font-semibold text-left">{row.key}</span>
                      <span className={`font-bold text-slate-800 dark:text-slate-200 text-right ${row.customStyle || ""}`}>{row.val}</span>
                    </div>
                  ))}
                </>
              )}

              {/* DYNAMIC TAB FIELDS FOR CALVING */}
              {activeTab === "calving" && (
                <>
                  {[
                    { key: "Calving Ease Tier", val: selectedRecord.calvingEase, customStyle: "font-black" },
                    { key: "Offspring Born Count", val: `${selectedRecord.numberOfCalves} calf / calves` },
                    { key: "Delivery Address", val: selectedRecord.locationAddress },
                    { key: "Technician Comments", val: selectedRecord.technicianNote || "None", customStyle: "italic text-slate-500" }
                  ].map((row, index) => (
                    <div key={index} className="flex justify-between items-center py-2.5">
                      <span className="text-slate-400 font-semibold text-left">{row.key}</span>
                      <span className={`font-bold text-slate-800 dark:text-slate-200 text-right ${row.customStyle || ""}`}>{row.val}</span>
                    </div>
                  ))}

                  {/* Newborn Details Render Cards */}
                  {selectedRecord.calves && selectedRecord.calves.length > 0 && (
                    <div className="py-3 space-y-2">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Registered Offspring</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedRecord.calves.map((calf, index) => (
                          <div key={index} className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-xl flex flex-col">
                            <span className="font-extrabold text-[#00643b] dark:text-[#10b981] text-[11px]">Tag: {calf.earTag || "Pending Assign"}</span>
                            <span className="text-slate-400 text-[10px] font-bold mt-0.5 uppercase tracking-wide">Sex: {calf.sex === "M" ? "Male" : "Female"}</span>
                            <span className="text-slate-400 text-[10px] font-semibold">Weight: {calf.weight ? `${calf.weight} kg` : "N/A"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <Info size={14} className="text-[#00643b] shrink-0" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Historical breeding records immutable unless authorized.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-900">
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 rounded-xl px-4 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CUSTOM MODERN CONFIRMATION DIALOG ===== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in animate-duration-200">
          <div className="card w-full max-w-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-slate-400 font-extrabold text-[10px] tracking-widest uppercase">
              <span>{confirmModal.title || "Confirm Deletion"}</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed pr-2">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-900">
              <button
                onClick={() => setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null })}
                className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 rounded-xl px-4 text-xs font-bold cursor-pointer text-slate-500 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null });
                }}
                className="btn btn-sm text-white border-none rounded-xl px-5 text-xs font-black cursor-pointer bg-rose-600 hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DEPARTMENT OF AGRICULTURE UNIFIED ACCOMPLISHMENT REPORT (PRINT TEMPLATE) ===== */}
      <div id="da-print-report" className="hidden print:block text-[10px] text-black bg-white p-2">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { size: landscape; margin: 10mm; }
            body > div:first-child { display: none !important; }
            #da-print-report { display: block !important; width: 100% !important; }
            table { border-collapse: collapse; width: 100%; font-size: 8px; }
            th, td { border: 1px solid black !important; padding: 2px 4px !important; text-align: center; }
            th { background-color: #f1f5f9 !important; font-weight: bold; }
          }
        `}} />
        
        {/* Document Header */}
        <div className="text-center space-y-0.5 mb-4">
          <p className="font-extrabold uppercase text-[10px]">Department of Agriculture</p>
          <p className="text-[8px] font-bold text-slate-700">Bureau of Animal Industry - Livestock Development Council - National Dairy Authority - Philippine Carabao Center</p>
          <p className="text-[8px] font-bold text-slate-700">DA Regional Field Units - Local Government Units</p>
          <p className="font-black text-[11px] uppercase tracking-wide mt-1">UNIFIED NATIONAL ARTIFICIAL INSEMINATION PROGRAM</p>
          <p className="font-bold text-[9px] mt-1 italic">Monthly Accomplishment Report</p>
          <div className="flex justify-between text-[8px] font-bold mt-2 px-10">
            <span>For the Month of: <span className="underline font-bold">{monthFilter || new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span></span>
            <span>Submitted Date: <span className="underline font-bold">__________________</span></span>
          </div>
          <div className="flex justify-start text-[8px] font-bold gap-8 px-10 mt-1">
            <span>Region: <span className="underline font-black">VI</span></span>
            <span>Province: <span className="underline font-black">ILOILO</span></span>
            <span>Municipality/City: <span className="underline font-black">OTON</span></span>
          </div>
        </div>

        {/* Official Layout Table */}
        <table className="border-collapse border border-black w-full text-[8px]">
          <thead>
            <tr className="bg-slate-100 text-center font-bold">
              <th rowSpan={2} className="border border-black p-1 text-center">Data</th>
              <th colSpan={8} className="border border-black p-1 text-center">Animal identification</th>
              <th colSpan={5} className="border border-black p-1 text-center">Artificial Insemination</th>
              <th colSpan={2} className="border border-black p-1 text-center">Pregnancy Diagnosis</th>
              <th colSpan={7} className="border border-black p-1 text-center">Calf Drop</th>
            </tr>
            <tr className="bg-slate-50 text-center font-bold">
              <th className="border border-black p-1">Animal ID</th>
              <th className="border border-black p-1">Ear Tag</th>
              <th className="border border-black p-1">Brand</th>
              <th className="border border-black p-1">Species</th>
              <th className="border border-black p-1">Breed</th>
              <th className="border border-black p-1">Color</th>
              <th className="border border-black p-1">Address</th>
              <th className="border border-black p-1">Farmer</th>
              
              <th className="border border-black p-1">Date</th>
              <th className="border border-black p-1">No. of AI</th>
              <th className="border border-black p-1">Estrus</th>
              <th className="border border-black p-1">Sire Breed</th>
              <th className="border border-black p-1">Sire Code</th>
              
              <th className="border border-black p-1">Date</th>
              <th className="border border-black p-1">Result</th>
              
              <th className="border border-black p-1">Date</th>
              <th className="border border-black p-1">No. of Calving</th>
              <th className="border border-black p-1">Calf 1 ID</th>
              <th className="border border-black p-1">Sex 1</th>
              <th className="border border-black p-1">Calf 2 ID</th>
              <th className="border border-black p-1">Sex 2</th>
              <th className="border border-black p-1">Calving ease</th>
            </tr>
          </thead>
          <tbody>
            {daReportEntries.length === 0 ? (
              <tr>
                <td colSpan={23} className="text-center p-4 text-slate-400">No official accomplishment records generated.</td>
              </tr>
            ) : (
              daReportEntries.map((row, index) => (
                <tr key={index} className="text-center">
                  <td className="border border-black p-1 font-bold">{row.type}</td>
                  <td className="border border-black p-1">{row.animalId}</td>
                  <td className="border border-black p-1 font-semibold">{row.earTag}</td>
                  <td className="border border-black p-1">{row.brand}</td>
                  <td className="border border-black p-1">{row.species}</td>
                  <td className="border border-black p-1">{row.breed}</td>
                  <td className="border border-black p-1">{row.color}</td>
                  <td className="border border-black p-1 text-left">{row.address}</td>
                  <td className="border border-black p-1 font-bold text-left">{row.farmer}</td>
                  
                  <td className="border border-black p-1 font-medium">{row.aiDate}</td>
                  <td className="border border-black p-1 font-bold">{row.attempt}</td>
                  <td className="border border-black p-1">{row.estrus}</td>
                  <td className="border border-black p-1">{row.sireBreed}</td>
                  <td className="border border-black p-1">{row.sireCode}</td>
                  
                  <td className="border border-black p-1 font-medium">{row.pdDate}</td>
                  <td className="border border-black p-1 font-bold">{row.pdResult}</td>
                  
                  <td className="border border-black p-1 font-medium">{row.cdDate}</td>
                  <td className="border border-black p-1 font-bold">{row.cdCount}</td>
                  <td className="border border-black p-1">{row.calf1Id}</td>
                  <td className="border border-black p-1">{row.calf1Sex}</td>
                  <td className="border border-black p-1">{row.calf2Id}</td>
                  <td className="border border-black p-1">{row.calf2Sex}</td>
                  <td className="border border-black p-1 font-bold">{row.cdEase}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Document Signatures Block */}
        <div className="flex justify-between items-center mt-10 px-12 text-[8px] font-bold">
          <div className="text-center space-y-6">
            <p>Prepared by:</p>
            <div className="border-t border-black pt-1 w-48 mx-auto">
              <p className="font-extrabold uppercase">Cyrus T. Depamaylo</p>
              <p className="text-slate-500">Provincial AI Coordinator</p>
            </div>
          </div>
          <div className="text-center space-y-6">
            <p>Noted by:</p>
            <div className="border-t border-black pt-1 w-48 mx-auto">
              <p className="font-extrabold uppercase">Alexande F. Labuda</p>
              <p className="text-slate-500">Acting Supervising Agriculturist</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
