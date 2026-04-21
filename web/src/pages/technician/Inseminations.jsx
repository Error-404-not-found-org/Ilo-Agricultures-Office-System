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
} from "lucide-react";
import axiosInstance from "../../lib/axios";

export default function Inseminations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [eta, setEta] = useState("");
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
        rawType: "insemination",
        label: item.attemptNumber > 1 ? "Re-Insemination" : "AI Procedure",
        date: new Date(item.inseminationDate || item.createdAt),
        status: item.status,
        farmer: item.farmerId,
        animal: item.animalId,
        urgency: item.attemptNumber > 1 ? "high" : "routine",
        icon: Syringe,
        originalData: item,
      }));

      const combined = [...formattedInsems].sort((a, b) => b.date - a.date);
      setTasks(combined);
    } catch (error) {
      console.error("Failed to fetch all tasks", error);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date();
  const currentMonth = today.toLocaleString("default", { month: "long" });
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, today.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, today.getMonth(), 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const taskCountsByDate = tasks.reduce((acc, t) => {
    const d = new Date(t.date).getDate();
    const m = new Date(t.date).getMonth();
    if (
      m === today.getMonth() &&
      new Date(t.date).getFullYear() === currentYear
    ) {
      acc[d] = (acc[d] || 0) + 1;
    }
    return acc;
  }, {});

  useEffect(() => {
    fetchAllTasks();
  }, []);

  const handleConfirmAccept = async () => {
    if (!eta) return alert("Please specify your ETA.");
    try {
      const url =
        selectedTask.rawType === "health"
          ? `/health-request/${selectedTask.id}/status`
          : `/technician/inseminations/${selectedTask.id}/status`;

      const targetStatus =
        selectedTask.rawType === "health" ? "in-progress" : "approved";

      await axiosInstance.patch(url, {
        status: targetStatus,
        technicianNote: `Scheduled to arrive at: ${eta}`,
      });

      setIsAcceptModalOpen(false);
      setSelectedTask(null);
      setEta("");
      fetchAllTasks();
    } catch (error) {
      console.error("Failed to accept task", error);
      alert("Failed to accept task.");
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return "Location not provided";
    if (typeof addr === "string") return addr;
    return (
      [addr.barangay, addr.city].filter(Boolean).join(", ") || "No location"
    );
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex justify-center items-center flex-col min-h-[50vh] gap-3">
        <span className="loading loading-infinity loading-lg text-[#074033] scale-150"></span>
        <p className="text-[#074033] font-medium tracking-wide animate-pulse">
          Loading Tasks...
        </p>
      </div>
    );
  }

  const filteredTasks = tasks.filter((task) => {
    if (filter === "Pending") return task.status === "pending";
    if (filter === "Accepted")
      return task.status === "in-progress" || task.status === "approved";
    if (filter === "Completed")
      return task.status === "done" || task.status === "resolved";
    return true;
  });

  const getStatusBadge = (status) => {
    const s = status?.toLowerCase() || "";
    const isPending = s === "pending";
    const isDone = s === "done" || s === "resolved";
    const isProgress = s === "in-progress" || s === "approved";

    if (isPending)
      return (
        <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black rounded-full border border-amber-100 uppercase tracking-tighter shadow-sm">
          Pending
        </span>
      );
    if (isProgress)
      return (
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-100 uppercase tracking-tighter shadow-sm">
          In Progress
        </span>
      );
    if (isDone)
      return (
        <span className="px-3 py-1 bg-gray-50 text-gray-500 text-[10px] font-black rounded-full border border-gray-100 uppercase tracking-tighter">
          Completed
        </span>
      );
    return (
      <span className="px-3 py-1 bg-gray-50 text-gray-400 text-[10px] font-black rounded-full border border-gray-100 uppercase tracking-tighter">
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4 sm:px-6 lg:px-8">
      {/* Header & Filter Row */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-10 pt-4">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-[#074033] rounded-3xl flex items-center justify-center shadow-lg shadow-[#074033]/20">
            <Syringe className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-[#111827] tracking-tighter leading-none mb-2 uppercase">
              Inseminations
            </h1>
            <p className="text-gray-500 font-medium text-xs flex items-center gap-2 italic">
              <Info size={14} className="text-emerald-600" />
              Review and manage all artificial insemination requests.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 self-start xl:self-auto">
          <button
            onClick={() => setIsWalkInModalOpen(true)}
            className="py-2.5 px-6 rounded-2xl text-xs font-black uppercase tracking-widest bg-[#074033] text-white shadow-xl shadow-[#074033]/20 hover:scale-[1.02] active:scale-95 transition-all w-full sm:w-auto flex justify-center items-center gap-2"
          >
            <Syringe size={16} /> Register Walk-in AI
          </button>
          <div className="bg-white rounded-2xl p-1.5 inline-flex items-center shadow-sm border border-gray-100">
            {["All Tasks", "Pending", "Accepted", "Completed"].map((lbl) => (
              <button
                key={lbl}
                onClick={() => handleFilterChange(lbl)}
                className={`py-2 px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${filter === lbl ? "bg-[#074033] text-white shadow-md" : "text-gray-400 hover:text-[#074033]"}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Modern Data Table */}
        <div className="xl:col-span-3 bg-white rounded-4xl shadow-2xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table w-full border-separate border-spacing-y-0">
              <thead>
                <tr className="bg-gray-50/50 text-[#111827] border-b border-gray-100">
                  <th className="px-8 py-6 text-left text-xs font-black uppercase tracking-widest leading-none opacity-40">
                    Task Identity
                  </th>
                  <th className="px-6 py-6 text-left text-xs font-black uppercase tracking-widest leading-none opacity-40">
                    Scheduled & Locality
                  </th>
                  <th className="px-6 py-6 text-left text-xs font-black uppercase tracking-widest leading-none opacity-40">
                    Farmer & Contact
                  </th>
                  <th className="px-6 py-6 text-left text-xs font-black uppercase tracking-widest leading-none opacity-40">
                    Livestock Info
                  </th>
                  <th className="px-6 py-6 text-center text-xs font-black uppercase tracking-widest leading-none opacity-40">
                    Status
                  </th>
                  <th className="px-8 py-6 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-24 text-center">
                      <CheckCircle2
                        size={48}
                        className="mx-auto text-gray-200 mb-4"
                      />
                      <h3 className="text-xl font-bold text-gray-400 italic">
                        No missions found in this sector
                      </h3>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const Icon = task.icon;
                    const isUrgent = task.urgency === "high";

                    return (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        key={task.id}
                        className="group hover:bg-gray-50/50 transition-colors cursor-default"
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${isUrgent ? "bg-red-50 text-red-500" : "bg-emerald-50 text-[#074033]"}`}
                            >
                              <Icon size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                              <p className="font-extrabold text-[#111827] tracking-tight text-[15px]">
                                {task.label}
                              </p>
                              <p
                                className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${isUrgent ? "text-red-400" : "text-emerald-500"}`}
                              >
                                {isUrgent
                                  ? "Priority Mission"
                                  : "Standard Procedure"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <p className="text-[#111827] font-bold text-sm tracking-tight">
                            {task.date.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                          <div className="flex items-center gap-1.5 text-gray-400 mt-1">
                            <MapPin size={12} className="shrink-0" />
                            <p className="text-[11px] font-medium truncate max-w-[120px]">
                              {task.farmer?.address?.barangay ||
                                "Unknown Sector"}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-sm">
                          <p className="text-[#111827] font-bold tracking-tight">
                            {task.farmer?.name || "Anonymous User"}
                          </p>
                          <p className="text-gray-400 font-medium text-xs mt-0.5 underline decoration-gray-200">
                            {task.farmer?.phoneNumber || "No Contact"}
                          </p>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-black text-[10px]">
                              TAG
                            </div>
                            <div>
                              <p className="text-[#111827] font-bold text-sm">
                                #{task.animal?.earTag || "N/A"}
                              </p>
                              <p className="text-gray-400 font-bold text-[10px] uppercase tracking-tighter">
                                {task.animal?.species || "General"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          {getStatusBadge(task.status)}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="dropdown dropdown-left dropdown-end">
                            <label
                              tabIndex={0}
                              className="btn btn-ghost btn-xs btn-square hover:bg-gray-200 rounded-lg text-gray-400"
                            >
                              <MoreVertical size={16} />
                            </label>
                            <ul
                              tabIndex={0}
                              className="dropdown-content z-30 menu p-2 shadow-2xl bg-white rounded-2xl w-52 border border-gray-100 mt-2"
                            >
                              <li className="menu-title px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                Mission Actions
                              </li>
                              <li>
                                <button
                                  onClick={() => {
                                    setSelectedTask(task);
                                    setIsDetailModalOpen(true);
                                  }}
                                  className="flex items-center gap-3 text-sm font-bold p-3 rounded-xl hover:bg-gray-50 text-gray-700 transition-colors"
                                >
                                  <FileText
                                    size={16}
                                    className="text-emerald-500"
                                  />{" "}
                                  View Report
                                </button>
                              </li>
                              {task.status === "pending" && (
                                <>
                                  <div className="h-px bg-gray-50 my-1 mx-2"></div>
                                  <li>
                                    <button
                                      onClick={() => {
                                        setSelectedTask(task);
                                        setIsAcceptModalOpen(true);
                                      }}
                                      className="flex items-center gap-3 text-sm font-bold p-3 rounded-xl hover:bg-emerald-50 text-[#074033] transition-colors"
                                    >
                                      <CheckCircle2 size={16} /> Deploy & Accept
                                    </button>
                                  </li>
                                  <li>
                                    <button className="flex items-center gap-3 text-sm font-bold p-3 rounded-xl hover:bg-red-50 text-red-600 transition-colors">
                                      <X size={16} /> Abort Request
                                    </button>
                                  </li>
                                </>
                              )}
                            </ul>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Schedule Calendar Viewer */}
        <div className="xl:col-span-1 bg-white rounded-4xl shadow-2xl shadow-gray-200/50 border border-gray-100 p-6 flex flex-col h-full self-start sticky top-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-extrabold text-[#111827] text-lg">
              {currentMonth} {currentYear}
            </h3>
            <div className="flex gap-2">
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <ChevronRight className="rotate-180" size={18} />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-gray-400 mb-2">
            <div>Su</div>
            <div>Mo</div>
            <div>Tu</div>
            <div>We</div>
            <div>Th</div>
            <div>Fr</div>
            <div>Sa</div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm font-bold">
            {blanks.map((b) => (
              <div key={`blank-${b}`} className="p-2"></div>
            ))}
            {days.map((d) => {
              const hasTask = taskCountsByDate[d];
              const isToday = d === today.getDate();
              return (
                <div
                  key={`day-${d}`}
                  className={`p-2 rounded-xl flex items-center justify-center relative cursor-pointer transition-colors duration-200 ${isToday ? "bg-[#074033] text-white shadow-md" : "text-gray-700 hover:bg-emerald-50"}`}
                >
                  <span className="relative z-10">{d}</span>
                  {hasTask && !isToday && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  )}
                  {hasTask && isToday && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 bg-white rounded-full"></span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
              Upcoming Schedule
            </h4>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {tasks
                .filter(
                  (t) => new Date(t.date) >= new Date().setHours(0, 0, 0, 0),
                )
                .slice(0, 5)
                .map((t) => (
                  <div
                    key={t.id}
                    className="flex gap-3 items-start p-2 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedTask(t);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#074033] flex items-center justify-center shrink-0 shadow-sm border border-emerald-100">
                      <span className="font-bold text-sm">
                        {new Date(t.date).getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-[#111827] text-sm leading-tight">
                        {t.label}
                      </p>
                      <p className="text-xs text-gray-500 font-medium truncate w-[140px]">
                        {t.farmer?.name || "Unknown Farmer"}
                      </p>
                    </div>
                  </div>
                ))}
              {tasks.filter(
                (t) => new Date(t.date) >= new Date().setHours(0, 0, 0, 0),
              ).length === 0 && (
                <div className="text-center py-4 text-gray-400 italic text-sm font-medium">
                  No upcoming visits
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal System */}
      <AnimatePresence>
        {isWalkInModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl border border-white/20 relative"
            >
              <div className="absolute top-8 right-8">
                <button
                  onClick={() => setIsWalkInModalOpen(false)}
                  className="text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="w-20 h-20 bg-emerald-50 rounded-[1.75rem] flex items-center justify-center mb-8 shadow-inner">
                <Syringe className="text-[#074033]" size={36} />
              </div>

              <h2 className="text-3xl font-black text-[#111827] tracking-tighter leading-none mb-4 uppercase">
                Walk-in AI
              </h2>
              <p className="text-gray-500 text-sm font-medium leading-relaxed mb-8">
                Register an immediate, undocumented AI procedure.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block pl-1">
                      Farmer Name
                    </label>
                    <input
                      type="text"
                      placeholder="Enter name"
                      className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-sm text-[#111827] focus:ring-4 focus:ring-emerald-500/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block pl-1">
                      Animal Tag
                    </label>
                    <input
                      type="text"
                      placeholder="Tag NO."
                      className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-sm text-[#111827] focus:ring-4 focus:ring-emerald-500/10 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block pl-1">
                    Service Details
                  </label>
                  <textarea
                    placeholder="Observation notes..."
                    className="w-full h-24 bg-gray-50 border-none rounded-2xl p-5 font-bold text-sm text-[#111827] focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none"
                  ></textarea>
                </div>
                <button
                  onClick={() => {
                    alert("Walk-in recorded!");
                    setIsWalkInModalOpen(false);
                  }}
                  className="w-full h-16 bg-[#074033] text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-[#074033]/20 hover:scale-[1.02] active:scale-95 transition-all mt-4"
                >
                  Submit Record
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAcceptModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-white/20 relative"
            >
              <div className="absolute top-8 right-8">
                <button
                  onClick={() => {
                    setIsAcceptModalOpen(false);
                    setSelectedTask(null);
                  }}
                  className="text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="w-20 h-20 bg-emerald-50 rounded-[1.75rem] flex items-center justify-center mb-8 shadow-inner">
                <Clock className="text-[#074033]" size={36} />
              </div>

              <h2 className="text-3xl font-black text-[#111827] tracking-tighter leading-none mb-4 uppercase">
                Finalize Deployment
              </h2>
              <p className="text-gray-500 text-sm font-medium leading-relaxed mb-8">
                Review the mission parameters with{" "}
                <span className="text-[#074033] font-bold">
                  {selectedTask?.farmer?.name}
                </span>
                . Identify your estimated arrival time to confirm your
                assignment.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3 block pl-1">
                    Estimated Arrival (ETA)
                  </label>
                  <input
                    type="time"
                    className="w-full h-16 bg-gray-50 border-none rounded-2xl px-6 font-bold text-[#111827] focus:ring-4 focus:ring-emerald-500/10 transition-all text-xl"
                    value={eta}
                    onChange={(e) => setEta(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <AlertCircle className="text-amber-500 shrink-0" size={18} />
                  <p className="text-[10px] font-bold text-amber-700 leading-tight uppercase tracking-tighter">
                    Once accepted, this mission will be logged under your active
                    operational cycle.
                  </p>
                </div>

                <button
                  onClick={handleConfirmAccept}
                  className="w-full h-16 bg-[#074033] text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-[#074033]/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Confirm Mission Launch
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isDetailModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl border border-white/20 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/50 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 opacity-60"></div>

              <div className="flex justify-between items-start relative z-10 mb-10">
                <div className="flex items-center gap-4 text-left">
                  <div className="w-14 h-14 bg-[#111827] rounded-xl flex items-center justify-center text-white shadow-lg">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-[#111827] tracking-tighter uppercase">
                      Mission Brief
                    </h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mt-0.5">
                      Reference ID: {selectedTask?.id?.substring(0, 12)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setSelectedTask(null);
                  }}
                  className="text-gray-400 hover:text-gray-900 transition-colors p-2 hover:bg-gray-50 rounded-lg"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 relative z-10 pr-4 max-h-[60vh] overflow-y-auto text-left">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block pl-1">
                    Target Individual
                  </label>
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                    <p className="text-[#111827] font-bold text-[15px]">
                      {selectedTask?.farmer?.name}
                    </p>
                    <p className="text-xs text-gray-500 font-medium mt-1">
                      {formatAddress(selectedTask?.farmer?.address)}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block pl-1">
                    Livestock Specimen
                  </label>
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                    <p className="text-[#111827] font-bold text-[15px]">
                      ID #{selectedTask?.animal?.earTag}
                    </p>
                    <p className="text-xs mt-1 uppercase tracking-tighter font-black text-emerald-600">
                      {selectedTask?.animal?.species} /{" "}
                      {selectedTask?.animal?.breed || "General"}
                    </p>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block pl-1">
                    Observation Notes
                  </label>
                  <div className="bg-[#111827] rounded-3xl p-6 text-emerald-100/90 italic font-medium leading-relaxed shadow-lg border border-white/10">
                    {selectedTask?.rawType === "health"
                      ? `"${selectedTask?.originalData?.symptoms || "No specific symptoms reported by the owner."}"`
                      : `Priority Procedure: AI Cycle #${selectedTask?.originalData?.attemptNumber || 1}. Currently marked as ${selectedTask?.status?.toUpperCase()}. Requested on ${selectedTask?.date?.toLocaleDateString()}.`}
                  </div>
                </div>

                {selectedTask?.originalData?.technicianNote && (
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block pl-1">
                      Your Tactical Notes
                    </label>
                    <div className="bg-emerald-50 rounded-2xl p-5 text-[#074033] font-bold text-sm border border-emerald-100 flex items-center gap-3">
                      <Clock size={16} />{" "}
                      {selectedTask?.originalData?.technicianNote}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-12 pt-8 border-t border-gray-50 flex justify-end">
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setSelectedTask(null);
                  }}
                  className="px-10 py-5 bg-[#074033] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-[#074033]/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Acknowledge Report
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
