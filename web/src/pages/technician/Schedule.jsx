import React, { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Syringe,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
  Map,
  User,
  MapPin,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Zap,
  Lock,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/ui/Topbar";
import TaskActionModal from "../../components/modals/TaskActionModal";
import WalkInAIModal from "../../components/modals/WalkInAIModal";
import WalkInHealthModal from "../../components/modals/WalkInHealthModal";

export default function DeploymentSchedule() {
  const queryClient = useQueryClient();

  // ---- DATE NAVIGATION STATES ----
  const [viewDate, setViewDate] = useState(new Date()); // Month/Year view
  const [selectedDate, setSelectedDate] = useState(new Date()); // Selected day filter
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // ---- MODAL STATES ----
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isAppointmentMenuOpen, setIsAppointmentMenuOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  const { data: dbUser } = useQuery({
    queryKey: ["technician", "profile-me"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/profile");
      return res.data || {};
    },
  });

  // ---- FETCH INTEGRATED SCHEDULE DATA ----
  const { data: rawAgenda = [], isLoading } = useQuery({
    queryKey: ["technician", "schedule"],
    queryFn: async () => {
      const res = await axiosInstance.get(
        "/technician/dashboard-data?fullAgenda=true"
      );
      return res.data.agendaItems || [];
    },
  });

  // ---- CALENDAR CALCULATOR ENGINE ----
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  const totalDays = daysInMonth(currentYear, currentMonth);
  const startDay = firstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () =>
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () =>
    setViewDate(new Date(currentYear, currentMonth + 1, 1));

  const isSameDay = (d1, d2) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // ---- LIVE INDICATOR (DOTS) MATRIX CALCULATOR ----
  const taskCountsByDate = useMemo(() => {
    return (rawAgenda || []).reduce((acc, item) => {
      const itemDateVal = item.scheduledDate || item.preferredDate || item.displayDate;
      if (!itemDateVal) return acc;

      const itemDate = new Date(itemDateVal);
      if (
        itemDate.getMonth() === currentMonth &&
        itemDate.getFullYear() === currentYear
      ) {
        const day = itemDate.getDate();
        acc[day] = (acc[day] || 0) + 1;
      }
      return acc;
    }, {});
  }, [rawAgenda, currentMonth, currentYear]);

  // ---- DYNAMIC MATRIX FILTERING PIPELINE ----
  const filteredTasks = useMemo(() => {
    return (
      rawAgenda?.filter((item) => {
        const itemDateVal = item.scheduledDate || item.preferredDate || item.displayDate;
        if (!itemDateVal) return false;

        const itemDate = new Date(itemDateVal);
        const selected = new Date(selectedDate);

        // Normalize both to midnight to eliminate timezone offset inconsistencies
        itemDate.setHours(0, 0, 0, 0);
        selected.setHours(0, 0, 0, 0);

        const matchesDate = itemDate.getTime() === selected.getTime();
        const matchesCategory =
          selectedCategory === "all" ||
          item.type === selectedCategory ||
          (selectedCategory === "insemination" && item.type === "ai");

        const q = searchQuery.toLowerCase();
        const matchesSearch =
          !searchQuery ||
          item.task?.toLowerCase().includes(q) ||
          item.farmer?.toLowerCase().includes(q) ||
          item.location?.toLowerCase().includes(q);

        return matchesDate && matchesCategory && matchesSearch;
      }) || []
    );
  }, [rawAgenda, selectedDate, selectedCategory, searchQuery]);

  const handleOpenRouteGuide = () => {
    window.open("https://maps.google.com", "_blank");
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Topbar Layout */}
      <Topbar
        title="Deployment Schedule"
        subtitle="Operational Timeline — manage and track field service deployments"
      >
        <div className="relative">
          <button
            onClick={() => setIsAppointmentMenuOpen(!isAppointmentMenuOpen)}
            className="btn btn-sm bg-[#00643b] hover:bg-[#004d2e] border-none text-white text-xs font-bold gap-1.5 rounded-xl px-4"
          >
            <Plus size={13} /> Add Appointment
          </button>

          {isAppointmentMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsAppointmentMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                <button
                  onClick={() => {
                    setIsAIModalOpen(true);
                    setIsAppointmentMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-slate-700 dark:text-slate-300 flex items-center gap-2"
                >
                  <Syringe size={14} className="text-blue-500" />
                  <span>Artificial Insemination</span>
                </button>
                <button
                  onClick={() => {
                    setIsHealthModalOpen(true);
                    setIsAppointmentMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-slate-700 dark:text-slate-300 flex items-center gap-2"
                >
                  <HeartPulse size={14} className="text-rose-500" />
                  <span>Clinical Health Check</span>
                </button>
              </div>
            </>
          )}
        </div>
      </Topbar>

      {/* Main Timeline Workspace Content */}
      <main className="p-6 space-y-5">
        {/* Header Banner Block - Gradient Brand Alignment */}
        <div className="relative bg-linear-to-r from-[#074033] to-[#065f46] text-white p-6 rounded-2xl shadow-xs space-y-2 overflow-hidden">
          <div className="relative z-10 flex items-center gap-2 text-[#a7f3d0] font-extrabold text-[10px] tracking-widest uppercase">
            <CalendarIcon size={14} />
            <span>Operational Timeline</span>
          </div>
          <h2 className="relative z-10 text-2xl font-black tracking-tight">
            Deployment Schedule
          </h2>
          <p className="relative z-10 text-xs text-emerald-100/80 max-w-xl font-medium leading-relaxed">
            View confirmed visits, sync breeding cycles, and coordinate travel
            routes across Supa, Pulo, and Oton sectors efficiently.
          </p>
          <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px]" />
        </div>

        {/* Dashboard Operational Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">
          {/* Left Panel Sidebar Wrapper */}
          <div className="space-y-4">
            {/* Interactive Monthly Calendar Matrix */}
            <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-400">
                  {viewDate.toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={prevMonth}
                    className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button
                    onClick={nextMonth}
                    className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>

              {/* Day Header Labels */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-2 select-none">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                  <span key={i}>{day}</span>
                ))}
              </div>

              {/* Day Numerical Grids */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty slots for the first week offset */}
                {Array.from({ length: startDay }).map((_, i) => (
                  <span key={`offset-${i}`} />
                ))}

                {Array.from({ length: totalDays }).map((_, i) => {
                  const day = i + 1;
                  const date = new Date(currentYear, currentMonth, day);
                  const isSelected = isSameDay(date, selectedDate);
                  const hasTasks = taskCountsByDate[day];
                  const isToday = isSameDay(date, new Date());

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(date)}
                      className={`h-9 relative rounded-xl font-bold text-xs flex flex-col items-center justify-center border transition-all ${
                        isSelected
                          ? "bg-[#00643b] border-[#00643b] text-white shadow-xs"
                          : isToday
                            ? "border-[#00643b] text-[#00643b] dark:border-emerald-600 dark:text-emerald-400 font-black"
                            : "border-transparent bg-slate-50/50 dark:bg-slate-900/50 hover:border-[#00643b] dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span>{day}</span>
                      {hasTasks > 0 && (
                        <span
                          className={`w-1 h-1 rounded-full absolute bottom-1.5 ${
                            isSelected ? "bg-[#a7f3d0]" : "bg-[#00643b] dark:bg-emerald-500"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category Routing Filters Box */}
            <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">
                Categories
              </h4>
              <div className="flex flex-col gap-1.5">
                {[
                  {
                    id: "all",
                    label: "All Tasks",
                    icon: <CalendarIcon size={13} />,
                    style: "hover:border-[#00643b]",
                    activeStyle: "bg-[#00643b] text-white border-[#00643b]",
                  },
                  {
                    id: "insemination",
                    label: "Inseminations",
                    icon: <Syringe size={13} />,
                    style:
                      "border-blue-100 text-blue-700 dark:border-blue-900/40 dark:text-blue-400 hover:bg-blue-50/30",
                    activeStyle: "bg-blue-600 border-blue-600 text-white",
                  },
                  {
                    id: "health",
                    label: "Health Checks",
                    icon: <HeartPulse size={13} />,
                    style:
                      "border-rose-100 text-rose-700 dark:border-rose-900/40 dark:text-rose-400 hover:bg-rose-50/30",
                    activeStyle: "bg-rose-600 border-rose-600 text-white",
                  },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border flex items-center gap-2 transition-all ${
                      selectedCategory === cat.id
                        ? cat.activeStyle
                        : `bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 ${cat.style}`
                    }`}
                  >
                    {cat.icon}
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel Timeline List Wrapper */}
          <div className="space-y-3">
            {/* Context Heading Header Status Summary Bar */}
            <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs flex flex-row items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-black tracking-tight">
                  {selectedDate.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  You have {filteredTasks.length} scheduled task
                  {filteredTasks.length !== 1 ? "s" : ""} for this cycle.
                </p>
              </div>
              <div className="flex gap-2.5 items-center flex-wrap">
                {/* Local Search Input */}
                <div className="relative w-full sm:w-60">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={13}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ear tag or farmer..."
                    className="w-full h-9 pl-10 pr-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <button
                  onClick={handleOpenRouteGuide}
                  className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 text-xs font-bold gap-1.5 rounded-xl px-4 h-9 min-h-0"
                >
                  <Map size={13} /> Map Route Guide
                </button>
              </div>
            </div>

            {/* Tasks Dynamic Loop Output List Container */}
            <div className="space-y-2.5">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse"
                  />
                ))
              ) : filteredTasks.length === 0 ? (
                <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 dark:text-slate-500 font-medium rounded-2xl">
                  No operational field deployments scheduled for this selection.
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const isTaskConfirmed =
                    task.status &&
                    ["done", "resolved", "completed", "approved", "in-progress"].includes(
                      task.status.toLowerCase()
                    );

                  const reqTechId =
                    task.raw?.approvedBy?._id ||
                    task.raw?.approvedBy ||
                    task.raw?.handledBy?._id ||
                    task.raw?.handledBy ||
                    null;

                  const reqTechName =
                    task.raw?.approvedBy?.name ||
                    task.raw?.handledBy?.name ||
                    (reqTechId ? "another technician" : null);

                  const isAssignedToOther =
                    reqTechId &&
                    dbUser?._id &&
                    String(reqTechId) !== String(dbUser._id);

                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        setSelectedTask(task);
                        setIsTaskModalOpen(true);
                      }}
                      className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-row items-center justify-between gap-4 shadow-2xs hover:shadow-md hover:border-[#00643b] transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Left Time Alignment Metric Block */}
                        <div className="border-r border-slate-100 dark:border-slate-800/80 pr-4 text-center min-w-[95px] shrink-0">
                          <span
                            className={`text-[8px] font-black tracking-wider uppercase flex items-center justify-center gap-0.5 ${
                              isAssignedToOther
                                ? "text-amber-500"
                                : isTaskConfirmed
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-amber-500"
                            }`}
                          >
                            {isAssignedToOther ? (
                              <Lock size={8} />
                            ) : isTaskConfirmed ? (
                              <CheckCircle2 size={8} />
                            ) : (
                              <AlertCircle size={8} />
                            )}
                            {isAssignedToOther ? "LOCKED" : isTaskConfirmed ? "ACTIVE" : "PENDING"}
                          </span>
                          <div className="text-xs font-black text-slate-800 dark:text-slate-200 mt-1.5 flex items-center justify-center gap-1">
                            <Clock size={11} className="text-slate-400" />
                            <span>{task.time || "Preferred"}</span>
                          </div>
                        </div>

                        {/* Content Description Block */}
                        <div className="min-w-0">
                          <span
                            className={`inline-block text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide mb-1.5 ${
                              task.type === "ai" || task.type === "insemination"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30"
                            }`}
                          >
                            {task.type === "ai" || task.type === "insemination"
                              ? "Artificial Insemination"
                              : "Clinical Checkup"}
                          </span>
                          {isAssignedToOther && (
                            <span className="inline-block text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide mb-1.5 ml-1.5 bg-amber-500/10 text-amber-600 border border-amber-500/20" title={`Assigned to ${reqTechName}`}>
                              Locked
                            </span>
                          )}
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate mb-1">
                            {task.task}
                          </h4>
                          <div className="flex gap-3 text-[11px] text-slate-400 font-semibold truncate">
                            <span className="flex items-center gap-0.5">
                              <User size={10} /> {task.farmer}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <MapPin size={10} /> {task.location}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Inline Deployment Row Action Trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(task);
                          setIsTaskModalOpen(true);
                        }}
                        className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 hover:border-[#00643b] text-[11px] font-bold rounded-lg px-3 py-1 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 transition-colors shrink-0"
                      >
                        {isAssignedToOther ? "View" : "Manage"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Task management action modal */}
      <TaskActionModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        task={selectedTask}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["technician", "schedule"] });
        }}
      />

      {/* Quick Action Insemination Registration Modal */}
      <WalkInAIModal
        isOpen={isAIModalOpen}
        onClose={() => {
          setIsAIModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["technician", "schedule"] });
        }}
      />

      {/* Quick Action Health Check Log Modal */}
      <WalkInHealthModal
        isOpen={isHealthModalOpen}
        onClose={() => {
          setIsHealthModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["technician", "schedule"] });
        }}
      />
    </div>
  );
}
