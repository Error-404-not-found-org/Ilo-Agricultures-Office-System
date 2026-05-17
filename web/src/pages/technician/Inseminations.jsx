import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartPulse,
  Syringe,
  MapPin,
  ChevronRight,
  FileText,
  CheckCircle2,
  Clock,
  MoreVertical,
  X,
  AlertCircle,
  Info,
  Plus,
  Calendar as CalendarIcon,
  Trash2,
  Search,
  History,
  Activity,
  ClipboardList,
  Download,
  Timer,
  Eye,
  Pencil,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import TaskActionModal from "../../components/modals/TaskActionModal";
import PregnancyDiagnosisModal from "../../components/modals/PregnancyDiagnosisModal";
import WalkInAIModal from "../../components/modals/WalkInAIModal";
import MissionDetailsModal from "../../components/modals/MissionDetailsModal";
import AnimalHistoryDrawer from "../../components/modals/AnimalHistoryDrawer";
import ConfirmDeleteModal from "../../components/modals/ConfirmDeleteModal";
import { useToast } from "../../contexts/ToastContext";

export default function Inseminations() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All Tasks");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [isDiagnosisModalOpen, setIsDiagnosisModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState(null);
  const [diagnosisTask, setDiagnosisTask] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Batch Selection State
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

  // Sync filter state with URL
  useEffect(() => {
    const queryFilter = searchParams.get("filter");
    setFilter(queryFilter || "All Tasks");
  }, [searchParams]);

  const handleRowClick = (task) => {
    if (task) {
      setSelectedTask(task);
      setIsDetailsModalOpen(true);
    }
  };

  const toggleTaskSelection = (task, e) => {
    e.stopPropagation();

    setSelectedTaskIds((prev) =>
      prev.includes(task.id)
        ? prev.filter((id) => id !== task.id)
        : [...prev, task.id],
    );
  };

  const toggleSelectAll = () => {
    if (
      selectedTaskIds.length === paginatedTasks.length &&
      paginatedTasks.length > 0
    ) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(paginatedTasks.map((t) => t.id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedTaskIds.length === 0) return;

    setIsBatchProcessing(true);
    try {
      await Promise.all(
        selectedTaskIds.map((id) =>
          axiosInstance.delete(`/insemination/${id}`),
        ),
      );
      toast.success(
        `Successfully deleted ${selectedTaskIds.length} AI missions`,
      );
      setSelectedTaskIds([]);
      fetchAllTasks();
    } catch (error) {
      console.error("Batch delete failed", error);
      toast.error("Failed to delete some missions");
    } finally {
      setIsBatchProcessing(false);
      setIsBatchDeleteModalOpen(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredTasks.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "AI Mission Type",
      "Date",
      "Farmer",
      "Location",
      "Ear Tag",
      "Breed",
      "Status",
      "Pregnancy Status",
    ];
    const rows = filteredTasks.map((t) => [
      t.label,
      t.date.toLocaleDateString(),
      t.farmer,
      t.location,
      t.animal?.earTag || "---",
      t.animal?.breed || "---",
      t.status,
      t.pregnancyCheck?.status || "Pending PD",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Insemination_Breeding_Report_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Breeding report exported successfully");
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setCurrentPage(1); // Reset to first page on filter change
    if (newFilter === "All Tasks") {
      searchParams.delete("filter");
    } else {
      searchParams.set("filter", newFilter);
    }
    setSearchParams(searchParams);
  };

  const fetchAllTasks = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        axiosInstance.get("/technician/inseminations"),
        axiosInstance.get("/technician/pregnancy-checks"),
        axiosInstance.get("/technician/calvings"),
        axiosInstance.get("/ai-request")
      ]);

      const [insemRes, pregRes, calvRes, aiReqRes] = results.map(r => 
        r.status === 'fulfilled' ? r.value.data : (r.status === 'rejected' ? { data: [] } : { data: [] })
      );

      // Format Inseminations
      const formattedInsems = (insemRes.inseminations || []).map((item) => {
        const date = new Date(item.inseminationDate || item.scheduledDate || item.preferredDate || item.createdAt);
        return {
          id: item._id,
          type: "insemination",
          label: item.attemptNumber > 1 ? "Re-Insemination" : "AI Procedure",
          task: item.attemptNumber > 1 ? "Re-Insemination" : "Artificial Insemination",
          date,
          displayDate: item.scheduledDate || item.preferredDate || item.inseminationDate || item.createdAt,
          status: item.status || "completed",
          pregnancyCheck: item.pregnancyId ? {
            status: item.pregnancyId.pregnancyDiagnosis?.result === "Pregnant" ? "Positive" : "Negative",
            raw: item.pregnancyId
          } : null,
          farmer: item.farmerId?.name || "Unknown",
          location: item.farmerId?.address?.barangay || "Unknown Sector",
          animal: item.animalId,
          daysSinceAI: Math.floor((new Date() - date) / (1000 * 60 * 60 * 24)),
          urgency: item.attemptNumber > 1 ? "high" : "routine",
          icon: Syringe,
          raw: item,
        };
      });

      // Format Pregnancy Checks
      const formattedPregnancies = (pregRes.data || []).map((item) => ({
        id: item._id,
        type: "pregnancy",
        label: "Pregnancy Check",
        task: "Pregnancy Diagnosis",
        date: new Date(item.checkDate || item.createdAt),
        displayDate: item.checkDate || item.createdAt,
        status: item.status || "completed",
        farmer: item.farmerId?.name || "Unknown",
        location: item.farmerId?.address?.barangay || "Unknown Sector",
        animal: item.animalId,
        icon: HeartPulse,
        raw: item,
      }));

      // Format Calf Drops
      const formattedCalfDrops = (calvRes.data || []).map((item) => ({
        id: item._id,
        type: "calving",
        label: "Calf Drop",
        task: "Livestock Birth",
        date: new Date(item.calvingDate || item.createdAt),
        displayDate: item.calvingDate || item.createdAt,
        status: item.status || "completed",
        farmer: item.farmerId?.name || "Unknown",
        location: item.farmerId?.address?.barangay || "Unknown Sector",
        animal: item.animalId,
        icon: History,
        raw: item,
      }));

      // Format AI Requests (Pending/Raw requests)
      const formattedAiRequests = (Array.isArray(aiReqRes) ? aiReqRes : []).map((item) => ({
        id: item._id,
        type: "ai-request",
        label: "AI Request",
        task: "Technician Dispatch",
        date: new Date(item.preferredDate || item.createdAt),
        displayDate: item.preferredDate || item.createdAt,
        status: item.status || "pending",
        farmer: item.farmerId?.name || "Unknown",
        location: item.farmerId?.address?.barangay || "Unknown Sector",
        animal: item.animalId,
        icon: ClipboardList,
        raw: item,
      }));

      const combined = [
        ...formattedInsems,
        ...formattedPregnancies,
        ...formattedCalfDrops,
        ...formattedAiRequests
      ].sort((a, b) => b.date - a.date);

      setTasks(combined);
    } catch (error) {
      console.error("Failed to fetch all tasks", error);
    } finally {
      setLoading(false);
    }
  };
  const handleDeleteTask = async () => {
    if (!taskToDelete) return;

    const task = tasks.find(t => t.id === taskToDelete);
    if (!task) return;

    try {
      const endpoint = task.type === 'insemination' 
        ? `/insemination/${task.id}`
        : task.type === 'pregnancy'
          ? `/technician/pregnancy-checks/${task.id}`
          : task.type === 'calving'
            ? `/technician/calvings/${task.id}`
            : `/ai-request/${task.id}`;

      await axiosInstance.delete(endpoint);
      toast.success("Record deleted successfully");
      fetchAllTasks();
    } catch (error) {
      console.error("Failed to delete task", error);
      toast.error(error.response?.data?.message || "Failed to delete record");
    } finally {
      setTaskToDelete(null);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  };

  const today = new Date();
  const currentMonth = currentDate.toLocaleString("default", { month: "long" });
  const currentYear = currentDate.getFullYear();
  const daysInMonth = new Date(
    currentYear,
    currentDate.getMonth() + 1,
    0,
  ).getDate();
  const firstDayOfMonth = new Date(
    currentYear,
    currentDate.getMonth(),
    1,
  ).getDay();

  // Adjust for Monday start
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: adjustedFirstDay }, (_, i) => i);

  const taskCountsByDate = tasks.reduce((acc, t) => {
    const td = new Date(t.date);
    if (
      td.getMonth() === currentDate.getMonth() &&
      td.getFullYear() === currentYear
    ) {
      const d = td.getDate();
      acc[d] = (acc[d] || 0) + 1;
    }
    return acc;
  }, {});

  useEffect(() => {
    fetchAllTasks();
  }, []);

  const filteredTasks = tasks.filter((task) => {
    // Status Filter
    let passStatus = true;
    if (filter === "Pending") passStatus = task.status === "pending";
    else if (filter === "In-Progress")
      passStatus = task.status === "in-progress" || task.status === "approved";
    else if (filter === "Completed")
      passStatus = task.status === "done" || task.status === "resolved";
    else if (filter === "Needs Diagnosis")
      passStatus = task.status === "done" && !task.pregnancyCheck;
    else if (filter === "Golden Window")
      passStatus =
        task.status === "done" &&
        !task.pregnancyCheck &&
        task.daysSinceAI >= 25 &&
        task.daysSinceAI <= 45;

    // Search Filter
    let passSearch = true;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const farmerName = (task.farmer || "").toLowerCase();
      const earTag = (task.animal?.earTag || "").toLowerCase();
      const address = (task.location || "").toLowerCase();
      const breed = (task.animal?.breed || "").toLowerCase();

      passSearch =
        farmerName.includes(q) ||
        earTag.includes(q) ||
        address.includes(q) ||
        breed.includes(q);
    }

    // Date Filter (Calendar)
    let passDate = true;
    if (selectedCalendarDate) {
      const td = new Date(task.date);
      passDate =
        td.getDate() === selectedCalendarDate.getDate() &&
        td.getMonth() === selectedCalendarDate.getMonth() &&
        td.getFullYear() === selectedCalendarDate.getFullYear();
    }

    return passStatus && passSearch && passDate;
  });

  // Barangay Distribution Calculation
  const barangayStats = tasks.reduce((acc, t) => {
    if (
      t.status === "pending" ||
      t.status === "in-progress" ||
      t.status === "approved"
    ) {
      acc[t.location] = (acc[t.location] || 0) + 1;
    }
    return acc;
  }, {});

  const sortedBarangays = Object.entries(barangayStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Calculate Pagination
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const getStatusBadge = (status, task) => {
    const s = status?.toLowerCase() || "";
    if (s === "pending")
      return (
        <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-black rounded-full border border-amber-500/20 uppercase tracking-tighter shadow-sm">
          Pending
        </span>
      );
    if (s === "in-progress" || s === "approved")
      return (
        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 text-[10px] font-black rounded-full border border-emerald-500/20 uppercase tracking-tighter shadow-sm">
          In Progress
        </span>
      );

    if (s === "done" || s === "resolved") {
      if (task.pregnancyCheck) {
        return (
          <span
            className={`px-3 py-1 ${task.pregnancyCheck.status === "Positive" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"} text-[10px] font-black rounded-full border uppercase tracking-tighter`}
          >
            Confirmed {task.pregnancyCheck.status}
          </span>
        );
      }

      if (task.daysSinceAI >= 25 && task.daysSinceAI <= 45) {
        return (
          <div className="flex flex-col items-center gap-1 group/badge relative">
            <span className="px-3 py-1 bg-purple-600 text-white text-[10px] font-black rounded-full border border-purple-500/20 uppercase tracking-tighter animate-pulse shadow-lg shadow-purple-500/20">
              Golden Window
            </span>
            <span className="text-[9px] font-black text-purple-600 flex items-center gap-1">
              <Timer size={10} /> Day {task.daysSinceAI}
            </span>
          </div>
        );
      }

      if (task.daysSinceAI > 45) {
        return (
          <div className="flex flex-col items-center gap-1">
            <span className="px-3 py-1 bg-amber-500/10 text-amber-600 text-[10px] font-black rounded-full border border-amber-500/20 uppercase tracking-tighter">
              Standard Check
            </span>
            <span className="text-[9px] font-bold text-amber-400">
              Day {task.daysSinceAI} Since AI
            </span>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center gap-1">
          <span className="px-3 py-1 bg-base-300 text-base-content/40 text-[10px] font-black rounded-full border border-base-300 uppercase tracking-tighter">
            Recovery Phase
          </span>
          <span className="text-[9px] font-bold text-base-content/20">
            Day {task.daysSinceAI}
          </span>
        </div>
      );
    }

    return (
      <span className="px-3 py-1 bg-base-300 text-base-content/40 text-[10px] font-black rounded-full border border-base-300 uppercase tracking-tighter">
        {status}
      </span>
    );
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex justify-center items-center flex-col min-h-[50vh] gap-3 bg-base-200">
        <span className="loading loading-infinity loading-lg text-emerald-600 scale-150"></span>
        <p className="text-base-content/40 font-black uppercase tracking-widest text-[10px] animate-pulse">
          Loading Missions...
        </p>
      </div>
    );
  }

  const stats = {
    total: tasks.length,
    success: tasks.filter((t) => t.pregnancyCheck?.status === "Positive")
      .length,
    goldenWindow: tasks.filter(
      (t) =>
        t.status === "done" &&
        !t.pregnancyCheck &&
        t.daysSinceAI >= 25 &&
        t.daysSinceAI <= 45,
    ).length,
    active: tasks.filter(
      (t) =>
        t.status === "pending" ||
        t.status === "in-progress" ||
        t.status === "approved",
    ).length,
  };

  const completedWithPD = tasks.filter(
    (t) => t.status === "done" && t.pregnancyCheck,
  ).length;
  const successRate =
    completedWithPD > 0
      ? Math.round((stats.success / completedWithPD) * 100)
      : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 bg-base-200 min-h-screen">
      {/* Control Console (Two-Row Redesign) */}
      <div className="flex flex-col gap-6 mb-8">
        {/* Top Row: Brand & Search */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#074033] dark:bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-[#074033]/20">
              <Syringe className="text-white" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30 leading-none mb-1 text-left">
                Reproductive Ops
              </p>
              <p className="text-xs font-black text-emerald-500 uppercase tracking-widest">
                Breeding Intelligence
              </p>
            </div>
          </div>

          <div className="relative group">
            <Search
              size={14}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20 group-focus-within:text-emerald-500 transition-colors"
            />
            <input
              type="text"
              placeholder="Search Tag, Breed, or Location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 pl-10 pr-4 bg-base-100 border border-base-300 rounded-xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all xl:w-[500px] w-full placeholder:text-base-content/20 shadow-sm"
            />
          </div>
        </div>

        {/* Bottom Row: Filters & Actions */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="bg-base-100 rounded-xl p-1 inline-flex items-center shadow-sm border border-base-300 h-10 overflow-x-auto max-w-full">
            {[
              "All Tasks",
              "Pending",
              "In-Progress",
              "Completed",
              "Golden Window",
            ].map((lbl) => (
              <button
                key={lbl}
                onClick={() => handleFilterChange(lbl)}
                className={`h-full px-5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300 flex items-center whitespace-nowrap ${filter === lbl ? "bg-[#074033] dark:bg-emerald-600 text-white shadow-md" : "text-base-content/40 hover:text-base-content"}`}
              >
                {lbl}
                {lbl === "Golden Window" && stats.goldenWindow > 0 && (
                  <span className="ml-2 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] animate-bounce">
                    {stats.goldenWindow}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex gap-2 self-end xl:self-auto">
            <button
              onClick={handleExportCSV}
              className="h-10 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white dark:bg-slate-900 border border-base-300 hover:bg-base-200 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Download size={14} /> Export
            </button>
            <button
              onClick={() => setIsWalkInModalOpen(true)}
              className="h-10 px-6 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#074033] dark:bg-emerald-600 text-white shadow-xl shadow-[#074033]/15 hover:translate-y-[-2px] transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Plus size={14} /> Register Walk-in AI
            </button>
          </div>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total AI Attempts",
            value: stats.total,
            icon: ClipboardList,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            label: "Active Requests",
            value: stats.active,
            icon: Activity,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
          },
          {
            label: "AI Success Rate",
            value: `${successRate}%`,
            icon: HeartPulse,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Golden Window",
            value: stats.goldenWindow,
            icon: Timer,
            color: "text-purple-500",
            bg: "bg-purple-500/10",
          },
        ].map((s, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900/50 rounded-3xl p-5 border border-base-300 dark:border-slate-800 shadow-sm flex items-center gap-4 group hover:border-emerald-500/30 transition-all"
          >
            <div
              className={`w-12 h-12 ${s.bg} ${s.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}
            >
              <s.icon size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-base-content/30">
                {s.label}
              </p>
              <p className="text-xl font-black text-base-content tracking-tighter">
                {s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 relative">
        {/* Bulk Action Bar */}
        <AnimatePresence>
          {selectedTaskIds.length > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 z-999 bg-slate-900 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-8 border border-white/10 backdrop-blur-xl"
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                  Selection Active
                </span>
                <span className="text-sm font-bold">
                  {selectedTaskIds.length} Missions Selected
                </span>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="flex gap-2">
                <button
                  disabled={isBatchProcessing}
                  onClick={() => setIsBatchDeleteModalOpen(true)}
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isBatchProcessing ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Batch Delete
                </button>
                <button
                  onClick={() => setSelectedTaskIds([])}
                  className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table Area */}
        <div className="xl:col-span-3 bg-base-100 rounded-4xl shadow-xl border border-base-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table w-full border-separate border-spacing-y-0">
              <thead>
                <tr className="bg-base-200/50 text-base-content border-b border-base-300">
                  <th className="w-12 px-6 py-4">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-primary rounded-md"
                      checked={
                        selectedTaskIds.length === paginatedTasks.length &&
                        paginatedTasks.length > 0
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-[9px] font-black uppercase tracking-[0.2em] opacity-30">
                    Mission Identity
                  </th>
                  <th className="px-6 py-4 text-left text-[9px] font-black uppercase tracking-[0.2em] opacity-30">
                    Schedule & Sector
                  </th>
                  <th className="px-6 py-4 text-left text-[9px] font-black uppercase tracking-[0.2em] opacity-30">
                    Farmer Context
                  </th>
                  <th className="px-6 py-4 text-left text-[9px] font-black uppercase tracking-[0.2em] opacity-30">
                    Livestock Info
                  </th>
                  <th className="px-6 py-4 text-center text-[9px] font-black uppercase tracking-[0.2em] opacity-30">
                    Reproduction Progress
                  </th>
                  <th className="px-6 py-4 text-center text-[9px] font-black uppercase tracking-[0.2em] opacity-30">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300">
                {paginatedTasks.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-20 text-center">
                      <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mx-auto mb-4 border border-base-300">
                        <CheckCircle2
                          size={32}
                          className="text-base-content/10"
                        />
                      </div>
                      <h3 className="text-sm font-black text-base-content/20 uppercase tracking-widest">
                        No active cycles in this view
                      </h3>
                    </td>
                  </tr>
                ) : (
                  paginatedTasks.map((task) => (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={task.id}
                      onClick={() => handleRowClick(task)}
                      className={`group hover:bg-base-200/50 transition-all cursor-pointer ${selectedTaskIds.includes(task.id) ? "bg-emerald-500/5" : ""}`}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary rounded-md"
                          checked={selectedTaskIds.includes(task.id)}
                          onChange={(e) => toggleTaskSelection(task, e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 ${task.urgency === "high" ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/20"}`}
                          >
                            <Syringe size={20} strokeWidth={2.5} />
                          </div>
                          <div>
                            <p className="font-black text-base-content tracking-tighter text-sm">
                              {task.label}
                            </p>
                            <p
                              className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${task.urgency === "high" ? "text-rose-500" : "text-emerald-500/60"}`}
                            >
                              {task.urgency === "high" ? "Priority" : "Routine"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-base-content font-black text-[13px] tracking-tighter">
                          {task.date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-base-content/40 font-black text-[9px] uppercase tracking-widest mt-0.5 flex items-center gap-1">
                          <MapPin size={8} className="text-blue-500" />{" "}
                          {task.location}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <p className="text-base-content font-black tracking-tighter text-[13px]">
                          {task.farmer}
                        </p>
                        <p className="text-base-content/30 font-black text-[8px] mt-0.5 shrink-0 uppercase tracking-widest">
                          {task.raw?.farmerId?.phoneNumber || "N/A"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-base-200 items-center justify-center flex text-base-content/20 border border-base-300 font-black text-[8px]">
                            TAG
                          </div>
                          <div>
                            <p className="text-base-content font-black text-[13px] leading-none mb-0.5 tracking-tighter">
                              #{task.animal?.earTag || "---"}
                            </p>
                            <p className="text-[9px] font-black text-base-content/40 uppercase tracking-widest">
                              {task.animal?.breed || task.animal?.species}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(task.status, task)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTask(task);
                              setIsDetailsModalOpen(true);
                            }}
                            className="p-2 hover:bg-blue-500/10 text-blue-500 rounded-lg transition-all active:scale-90 border border-transparent hover:border-blue-500/20"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>

                          {(task.status === "done" || task.status === "resolved") && !task.pregnancyCheck && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDiagnosisTask(task);
                                setIsDiagnosisModalOpen(true);
                              }}
                              className="p-2 hover:bg-purple-500/10 text-purple-600 rounded-lg transition-all active:scale-90 border border-transparent hover:border-purple-500/20"
                              title="Record Pregnancy Result"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          )}

                          {task.status !== "done" && task.status !== "resolved" && task.status !== "rejected" && task.status !== "cancelled" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTask(task);
                                setIsTaskModalOpen(true);
                              }}
                              className="p-2 hover:bg-emerald-500/10 text-emerald-600 rounded-lg transition-all active:scale-90 border border-transparent hover:border-emerald-500/20"
                              title="Update Status"
                            >
                              <Pencil size={16} />
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTaskToDelete(task.id);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-2 hover:bg-rose-500/10 text-rose-400 hover:text-rose-600 rounded-lg transition-all active:scale-90 border border-transparent hover:border-rose-500/20"
                            title="Delete Permanently"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-8 py-4 bg-base-200/30 border-t border-base-300 flex items-center justify-between">
              <p className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">
                Page {currentPage} of {totalPages} ({filteredTasks.length}{" "}
                missions)
              </p>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  className="h-8 px-4 rounded-lg bg-white dark:bg-slate-900 border border-base-300 text-[10px] font-black uppercase disabled:opacity-30 transition-all active:scale-95"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  className="h-8 px-4 rounded-lg bg-[#074033] text-white text-[10px] font-black uppercase disabled:opacity-30 transition-all active:scale-95"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Controls */}
        <div className="xl:col-span-1 space-y-6 flex flex-col h-full self-start sticky top-24">
          <div className="bg-base-100 rounded-4xl shadow-xl border border-base-300 p-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-base-content text-lg tracking-tighter uppercase">
                {currentMonth} {currentYear}
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 hover:bg-base-200 rounded-xl text-base-content/20 transition-colors"
                >
                  <ChevronRight className="rotate-180" size={18} />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-base-200 rounded-xl text-base-content/20 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-base-content/20 mb-4 tracking-widest">
              <div>Mo</div>
              <div>Tu</div>
              <div>We</div>
              <div>Th</div>
              <div>Fr</div>
              <div>Sa</div>
              <div>Su</div>
            </div>
            <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center text-[13px] font-black text-base-content">
              {blanks.map((b) => (
                <div key={`blank-${b}`} className="p-2"></div>
              ))}
              {days.map((d) => {
                const dateKey = new Date(
                  currentYear,
                  currentDate.getMonth(),
                  d,
                );
                const hasTask = taskCountsByDate[d];
                const isToday =
                  d === today.getDate() &&
                  currentDate.getMonth() === today.getMonth() &&
                  currentDate.getFullYear() === today.getFullYear();
                const isSelected =
                  selectedCalendarDate &&
                  d === selectedCalendarDate.getDate() &&
                  currentDate.getMonth() === selectedCalendarDate.getMonth() &&
                  currentDate.getFullYear() ===
                    selectedCalendarDate.getFullYear();

                return (
                  <button
                    key={`day-${d}`}
                    onClick={() =>
                      setSelectedCalendarDate(isSelected ? null : dateKey)
                    }
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center relative transition-all duration-300 shadow-sm
                           ${isSelected ? "bg-[#074033] dark:bg-emerald-600 text-white shadow-emerald-600/30 scale-110" : isToday ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500" : "text-base-content/60 hover:bg-base-200"}`}
                  >
                    <span className="relative z-10">{d}</span>
                    {hasTask && !isSelected && (
                      <span
                        className={`absolute bottom-0 w-1 h-1 rounded-full ${isToday ? "bg-emerald-700" : "bg-[#074033]"}`}
                      ></span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedCalendarDate && (
              <div className="mt-8 pt-6 border-t border-base-300 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex justify-between items-center bg-base-200 rounded-2xl p-4 border border-base-300">
                  <div className="flex items-center gap-3">
                    <CalendarIcon size={16} className="text-emerald-500" />
                    <p className="text-[10px] font-black uppercase text-base-content/40 tracking-widest">
                      {selectedCalendarDate.toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCalendarDate(null)}
                    className="text-[10px] font-black text-rose-500 hover:scale-110 transition-transform uppercase"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Breeding Hotspots */}
          <div className="bg-base-100 rounded-4xl shadow-xl border border-base-300 p-8">
            <div className="flex items-center gap-2 mb-6">
              <MapPin size={18} className="text-emerald-500" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-base-content/60">
                Breeding Hotspots
              </h4>
            </div>
            <div className="space-y-4">
              {sortedBarangays.length > 0 ? (
                sortedBarangays.map(([name, count], i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-tighter">
                      <span>{name}</span>
                      <span className="text-emerald-500">
                        {count} Active AI
                      </span>
                    </div>
                    <div className="h-1 w-full bg-base-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min((count / stats.active) * 100, 100)}%`,
                        }}
                        className="h-full bg-emerald-500"
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[9px] font-bold text-base-content/20 uppercase text-center py-4">
                  No active AI cycles to track
                </p>
              )}
            </div>
          </div>

          {/* Stats Overview */}
          <div className="bg-[#074033] rounded-4xl p-8 shadow-2xl shadow-emerald-900/10 text-white flex flex-col gap-8">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-6">
                Breeding Summary
              </h4>
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-3xl font-black">
                      {tasks.filter((t) => t.status === "pending").length}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                      Pending Deployments
                    </p>
                  </div>
                  <Syringe size={32} className="opacity-20 translate-y-1" />
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-3xl font-black">
                      {
                        tasks.filter(
                          (t) => t.status === "done" || t.status === "resolved",
                        ).length
                      }
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                      Completed AI Procedures
                    </p>
                  </div>
                  <CheckCircle2
                    size={32}
                    className="opacity-20 translate-y-1"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <WalkInAIModal
        isOpen={isWalkInModalOpen}
        onClose={() => setIsWalkInModalOpen(false)}
        onSuccess={fetchAllTasks}
      />

      <AnimalHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        animalId={selectedAnimalId}
      />

      <PregnancyDiagnosisModal
        isOpen={isDiagnosisModalOpen}
        onClose={() => setIsDiagnosisModalOpen(false)}
        taskData={diagnosisTask}
        onSuccess={fetchAllTasks}
      />

      <TaskActionModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        task={selectedTask}
        onSuccess={fetchAllTasks}
      />

      <MissionDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        task={selectedTask}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setTaskToDelete(null);
        }}
        onConfirm={handleDeleteTask}
        title="Delete AI Mission"
        message="You are about to permanently remove this insemination record. This action will purge the breeding cycle history for this animal."
      />
      <ConfirmDeleteModal
        isOpen={isBatchDeleteModalOpen}
        onClose={() => setIsBatchDeleteModalOpen(false)}
        onConfirm={handleBatchDelete}
        title="Batch Delete AI Records"
        message={`You are about to permanently delete ${selectedTaskIds.length} breeding records. This will remove all AI attempt history and cannot be reversed.`}
      />
    </div>
  );
}
