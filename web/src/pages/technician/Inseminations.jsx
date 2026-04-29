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
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import TaskActionModal from "../../components/modals/TaskActionModal";
import { useToast } from "../../contexts/ToastContext";

export default function Inseminations() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [filter, setFilter] = useState(
    searchParams.get("filter") || "All Tasks",
  );

  // Sync filter state with URL
  useEffect(() => {
    const queryFilter = searchParams.get("filter");
    setFilter(queryFilter || "All Tasks");
  }, [searchParams]);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
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
      const insemRes = await axiosInstance.get("/technician/inseminations");
      const insemData = insemRes.data.inseminations || [];

      const formattedInsems = insemData.map((item) => ({
        id: item._id,
        type: "insemination",
        label: item.attemptNumber > 1 ? "Re-Insemination" : "AI Procedure",
        task:
          item.attemptNumber > 1
            ? "Re-Insemination"
            : "Artificial Insemination",
        date: new Date(
          item.scheduledDate ||
            item.preferredDate ||
            item.inseminationDate ||
            item.createdAt,
        ),
        displayDate:
          item.scheduledDate ||
          item.preferredDate ||
          item.inseminationDate ||
          item.createdAt,
        status: item.status,
        farmer: item.farmerId?.name || "Unknown",
        location: item.farmerId?.address?.barangay || "Unknown Sector",
        animal: item.animalId,
        urgency: item.attemptNumber > 1 ? "high" : "routine",
        icon: Syringe,
        raw: item,
      }));

      const combined = [...formattedInsems].sort((a, b) => b.date - a.date);
      setTasks(combined);
    } catch (error) {
      console.error("Failed to fetch all tasks", error);
    } finally {
      setLoading(false);
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
    else if (filter === "Accepted")
      passStatus =
        task.status === "in-progress" ||
        task.status === "approved" ||
        task.status === "approved";
    else if (filter === "Completed")
      passStatus = task.status === "done" || task.status === "resolved";

    // Date Filter
    let passDate = true;
    if (selectedCalendarDate) {
      const td = new Date(task.date);
      passDate =
        td.getDate() === selectedCalendarDate.getDate() &&
        td.getMonth() === selectedCalendarDate.getMonth() &&
        td.getFullYear() === selectedCalendarDate.getFullYear();
    }

    return passStatus && passDate;
  });

  const getStatusBadge = (status) => {
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
    if (s === "done" || s === "resolved")
      return (
        <span className="px-3 py-1 bg-base-300 text-base-content/40 text-[10px] font-black rounded-full border border-base-300 uppercase tracking-tighter">
          Completed
        </span>
      );
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

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4 sm:px-6 lg:px-8 bg-base-200 min-h-screen">
      {/* Header & Filter Row */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-10 pt-6">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-[#074033] dark:bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-[#074033]/20 transition-all">
              <Syringe className="text-white" size={28} />
            </div>
            <h1 className="text-4xl font-black text-base-content tracking-tighter uppercase leading-none">
              Inseminations
            </h1>
          </div>
          <p className="text-base-content/40 font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
            <Info size={14} className="text-emerald-500" />
            Breeding Command: Manage artificial insemination cycles and sector tasks.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 self-start xl:self-auto">
          <button
            onClick={() => setIsWalkInModalOpen(true)}
            className="py-3 px-8 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] bg-[#074033] dark:bg-emerald-600 text-white shadow-xl shadow-[#074033]/15 hover:translate-y-[-2px] transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Register Walk-in AI
          </button>
          <div className="bg-base-100 rounded-2xl p-1.5 inline-flex items-center shadow-sm border border-base-300">
            {["All Tasks", "Pending", "Accepted", "Completed"].map((lbl) => (
              <button
                key={lbl}
                onClick={() => handleFilterChange(lbl)}
                className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${filter === lbl ? "bg-[#074033] dark:bg-emerald-600 text-white shadow-md" : "text-base-content/40 hover:text-base-content"}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Table Area */}
        <div className="xl:col-span-3 bg-base-100 rounded-4xl shadow-xl border border-base-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table w-full border-separate border-spacing-y-0">
              <thead>
                <tr className="bg-base-200/50 text-base-content border-b border-base-300">
                  <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] opacity-30">
                    Mission Identity
                  </th>
                  <th className="px-6 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] opacity-30">
                    Schedule & Sector
                  </th>
                  <th className="px-6 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] opacity-30">
                    Farmer Context
                  </th>
                  <th className="px-6 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] opacity-30">
                    Livestock Info
                  </th>
                  <th className="px-6 py-6 text-center text-[10px] font-black uppercase tracking-[0.2em] opacity-30">
                    Status
                  </th>
                  <th className="px-8 py-6 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-32 text-center">
                      <div className="w-20 h-20 bg-base-200 rounded-full flex items-center justify-center mx-auto mb-6 border border-base-300">
                        <CheckCircle2 size={40} className="text-base-content/10" />
                      </div>
                      <h3 className="text-lg font-black text-base-content/20 uppercase tracking-widest">
                        No AI missions in this sector
                      </h3>
                      {selectedCalendarDate && (
                        <button
                          onClick={() => setSelectedCalendarDate(null)}
                          className="mt-4 text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:underline"
                        >
                          Clear Date Filter
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={task.id}
                      className="group hover:bg-base-200/50 transition-all cursor-default"
                    >
                      <td className="px-8 py-7">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110 ${task.urgency === "high" ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/20"}`}
                          >
                            <Syringe size={24} strokeWidth={2.5} />
                          </div>
                          <div>
                            <p className="font-black text-base-content tracking-tighter text-[15px]">
                              {task.label}
                            </p>
                            <p
                              className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${task.urgency === "high" ? "text-rose-500" : "text-emerald-500/60"}`}
                            >
                              {task.urgency === "high"
                                ? "Priority Mission"
                                : "Standard Procedure"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-7">
                        <p className="text-base-content font-black text-sm tracking-tighter">
                          {task.date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-base-content/40 font-black text-[10px] uppercase tracking-widest mt-1 flex items-center gap-1">
                          <MapPin size={10} className="text-blue-500" /> {task.location}
                        </p>
                      </td>
                      <td className="px-6 py-7 text-sm">
                        <p className="text-base-content font-black tracking-tighter">
                          {task.farmer}
                        </p>
                        <p className="text-base-content/30 font-black text-[10px] mt-1 shrink-0 uppercase tracking-widest">
                          CONT: {task.raw?.farmerId?.phoneNumber || "N/A"}
                        </p>
                      </td>
                      <td className="px-6 py-7">
                        <div className="flex items-center gap-3">
                          {task.animal?.imageUrl ? (
                            <img
                              src={task.animal.imageUrl}
                              className="w-9 h-9 rounded-xl object-cover border border-base-300"
                              alt="Livestock"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-base-200 items-center justify-center flex text-base-content/20 border border-base-300 font-black text-[9px]">
                              TAG
                            </div>
                          )}
                          <div>
                            <p className="text-base-content font-black text-sm leading-none mb-1 tracking-tighter">
                              #{task.animal?.earTag || "---"}
                            </p>
                            <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest">
                              {task.animal?.breed || task.animal?.species}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-7 text-center">
                        {getStatusBadge(task.status)}
                      </td>
                      <td className="px-8 py-7 text-right">
                        <button
                          onClick={() => {
                            setSelectedTask(task);
                            setIsTaskModalOpen(true);
                          }}
                          className="h-10 px-6 bg-base-200 hover:bg-emerald-600 hover:text-white text-base-content/60 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95 border border-base-300 hover:border-emerald-600"
                        >
                          Manage Cycle
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Calendar Filter */}
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

          {/* Stats Overview */}
          <div className="bg-[#074033] rounded-4xl p-8 shadow-2xl shadow-emerald-900/10 text-white flex flex-col gap-8">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-6">
                Breeding Stats
              </h4>
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-3xl font-black">
                      {tasks.filter((t) => t.status === "pending").length}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                      Pending Requests
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
                      Completed AI Cycles
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

      <TaskActionModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        taskData={selectedTask}
        onSuccess={fetchAllTasks}
      />

      <AnimatePresence>
        {isWalkInModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsWalkInModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-base-100 rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative border border-base-300"
            >
              <div className="absolute top-8 right-8">
                <button
                  onClick={() => setIsWalkInModalOpen(false)}
                  className="p-3 hover:bg-base-200 rounded-2xl transition-all text-base-content/20 hover:text-base-content"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-10">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                  <Plus size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-base-content uppercase tracking-tighter">
                    Field Cycle
                  </h3>
                  <p className="text-[10px] font-black uppercase text-base-content/30 tracking-widest">
                    Register immediate AI procedure
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-base-content/30 mb-2 block ml-1">
                      Farmer Contact
                    </label>
                    <input
                      type="text"
                      placeholder="Name or Phone"
                      className="w-full h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm focus:ring-2 focus:ring-emerald-500 transition-all text-base-content placeholder:text-base-content/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-base-content/30 mb-2 block ml-1">
                      Ear Tag ID
                    </label>
                    <input
                      type="text"
                      placeholder="#0000"
                      className="w-full h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm focus:ring-2 focus:ring-emerald-500 transition-all text-base-content placeholder:text-base-content/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-base-content/30 mb-2 block ml-1">
                    Sire Code / Breed
                  </label>
                  <input
                    type="text"
                    placeholder="Sire Identity"
                    className="w-full h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm focus:ring-2 focus:ring-emerald-500 transition-all text-base-content placeholder:text-base-content/20"
                  />
                </div>
                <button
                  onClick={() => {
                    toast.success("Walk-in recorded!");
                    setIsWalkInModalOpen(false);
                  }}
                  className="w-full h-16 bg-[#074033] dark:bg-emerald-600 hover:scale-[1.02] active:scale-95 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-emerald-900/20 transition-all mt-4"
                >
                  Submit Cycle
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
