import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  User,
  ChevronDown,
  Filter,
  Syringe,
  HeartPulse,
  Baby,
  MoreVertical,
  CheckCircle2,
  Search,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import TaskActionModal from "../../components/modals/TaskActionModal";

const Schedule = () => {
  const [viewDate, setViewDate] = useState(new Date()); // For calendar navigation
  const [selectedDate, setSelectedDate] = useState(new Date()); // For filtering tasks
  const [filterType, setFilterType] = useState("all");
  const [agendaSearch, setAgendaSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch data
  const { data, isLoading } = useQuery({
    queryKey: ["technician", "schedule"],
    queryFn: async () => {
      const res = await axiosInstance.get(
        "/technician/dashboard-data?fullAgenda=true",
      );
      return res.data.agendaItems || [];
    },
  });

  // Calendar Logic
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

  const categories = [
    { id: "all", name: "All Tasks", icon: <CalendarIcon size={16} /> },
    {
      id: "insemination",
      name: "Inseminations",
      icon: <Syringe size={16} />,
      color: "text-blue-500 bg-blue-50",
    },
    {
      id: "health",
      name: "Health Checks",
      icon: <HeartPulse size={16} />,
      color: "text-rose-500 bg-rose-50",
    },
  ];

  const filteredAgenda =
    data?.filter((item) => {
      if (!item.displayDate) return false;

      const itemDate = new Date(item.displayDate);
      const selected = new Date(selectedDate);

      // Normalize both to pure dates (midnight) to ignore time discrepancies
      itemDate.setHours(0, 0, 0, 0);
      selected.setHours(0, 0, 0, 0);

      const matchesDate = itemDate.getTime() === selected.getTime();
      const matchesType = filterType === "all" || item.type === filterType;
      const matchesSearch =
        !agendaSearch ||
        item.task?.toLowerCase().includes(agendaSearch.toLowerCase()) ||
        item.farmer?.toLowerCase().includes(agendaSearch.toLowerCase());
      return matchesDate && matchesType && matchesSearch;
    }) || [];

  // Calculate task counts for calendar dots
  const taskCountsByDate = (data || []).reduce((acc, item) => {
    const itemDate = item.displayDate ? new Date(item.displayDate) : null;
    if (
      itemDate &&
      itemDate.getMonth() === currentMonth &&
      itemDate.getFullYear() === currentYear
    ) {
      const day = itemDate.getDate();
      acc[day] = (acc[day] || 0) + 1;
    }
    return acc;
  }, {});

  return (
    <div className="animate-fade-in pb-20">
      {/* Header Banner */}
      <div className="relative bg-[#074033] rounded-[32px] p-8 md:p-12 overflow-hidden mb-8">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <CalendarIcon size={18} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                Operational Timeline
              </span>
            </div>
            <h1 className="text-white text-4xl md:text-5xl font-black tracking-tight">
              Deployment Schedule
            </h1>
            <p className="text-emerald-100/70 text-sm font-medium mt-3 max-w-md">
              Managing and tracking field deployments for insemination and
              veterinary services.
            </p>
          </div>

          <div className="flex bg-white/10 backdrop-blur-xl p-1 rounded-2xl border border-white/10">
            <button className="px-5 py-2.5 rounded-xl bg-white text-[#074033] font-bold text-xs shadow-lg transition-all">
              List View
            </button>
            <button className="px-5 py-2.5 rounded-xl text-white/60 font-bold text-xs hover:text-white transition-all">
              Calendar
            </button>
          </div>
        </div>
        <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] bg-emerald-500/20 rounded-full blur-[120px]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
        {/* Left Panel: Calendar & Filters */}
        <div className="space-y-6">
          {/* Mini Calendar */}
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                {viewDate.toLocaleString("default", {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={prevMonth}
                  className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-emerald-500 transition-colors border border-slate-100 dark:border-slate-700"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={nextMonth}
                  className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-emerald-500 transition-colors border border-slate-100 dark:border-slate-700"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center mb-4">
              {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
                <span
                  key={day}
                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
                >
                  {day}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {/* Empty slots for the first week */}
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-10" />
              ))}
              {/* Days of the month */}
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
                    className={`
                                            h-10 rounded-xl text-xs font-bold transition-all relative
                                            ${isSelected ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30" : isToday ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"}
                                        `}
                  >
                    <span className="relative z-10">{day}</span>
                    {hasTasks && !isSelected && (
                      <span
                        className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isToday ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-600"}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Filters */}
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 px-2">
              Filter Tasks
            </h3>
            <div className="space-y-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFilterType(cat.id)}
                  className={`
                                        w-full flex items-center justify-between p-4 rounded-2xl transition-all border
                                        ${
                                          filterType === cat.id
                                            ? "bg-slate-950 text-white border-slate-950 dark:bg-emerald-600 dark:border-emerald-500"
                                            : "bg-transparent text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                        }
                                    `}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${filterType === cat.id ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}
                    >
                      {cat.icon}
                    </div>
                    <span className="text-xs font-bold">{cat.name}</span>
                  </div>
                  <ChevronRight
                    size={14}
                    className={
                      filterType === cat.id ? "opacity-100" : "opacity-20"
                    }
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Task Feed */}
        <div className="space-y-6">
          {/* Daily Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                You have {filteredAgenda.length} scheduled tasks for this day.
              </p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  value={agendaSearch}
                  onChange={(e) => setAgendaSearch(e.target.value)}
                  placeholder="Search ear tag or farmer..."
                  className="w-full h-11 pl-11 pr-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Task List */}
          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 bg-white dark:bg-slate-900 rounded-3xl animate-pulse border border-slate-100 dark:border-slate-800"
                />
              ))
            ) : filteredAgenda.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-4xl p-12 border border-dashed border-slate-200 dark:border-slate-800 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="text-slate-300" size={32} />
                </div>
                <h3 className="text-slate-800 dark:text-white font-bold">
                  No tasks found
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">
                  Adjust your filters or select a different date.
                </p>
              </div>
            ) : (
              filteredAgenda.map((task, i) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => {
                    setSelectedTask(task);
                    setIsTaskModalOpen(true);
                  }}
                  className="group relative bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all flex flex-col md:flex-row gap-5 items-start md:items-center cursor-pointer active:scale-[0.98]"
                >
                  {/* Time Indicator */}
                  <div className="flex flex-col items-center justify-center md:w-28 shrink-0 gap-1 border-r border-slate-100 dark:border-slate-800 pr-5">
                    <span
                      className={`text-[8px] font-black uppercase tracking-[0.2em] ${task.raw?.scheduledDate || !task.urgent ? "text-emerald-500" : "text-slate-400"}`}
                    >
                      {task.raw?.scheduledDate || !task.urgent ? "Confirmed" : "Preferred Visit"}
                    </span>
                    <span className="text-sm font-black text-slate-800 dark:text-white tracking-tighter whitespace-nowrap">
                      {task.time}
                    </span>
                  </div>

                  {/* Task Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        className={`
                                                px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider
                                                ${task.type === "insemination" ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"}
                                            `}
                      >
                        {task.type === "insemination"
                          ? "Artificial Insemination"
                          : "Medical Checkup"}
                      </div>
                      {task.status === "in-progress" && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 rounded-full">
                          <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                          <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            On-Site
                          </span>
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 dark:text-white tracking-tight text-base mb-2 group-hover:text-emerald-600 transition-colors">
                      {task.task}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <User size={14} className="text-slate-400" />
                        {task.farmer}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-slate-400" />
                        {task.location}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(task);
                        setIsTaskModalOpen(true);
                      }}
                      className="flex-1 md:flex-none h-11 px-5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-[11px] font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                    >
                      Manage Task
                    </button>
                    <button className="h-11 w-11 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-800">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      <TaskActionModal 
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        task={selectedTask}
        onUpdate={() => queryClient.invalidateQueries(['technician', 'schedule'])}
      />
    </div>
  );
};

export default Schedule;
