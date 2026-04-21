import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  HeartPulse, Syringe, MapPin, ChevronRight, FileText, 
  CheckCircle2, Clock, MoreVertical, X, AlertCircle, Info, Bell, Plus, ShieldAlert
} from "lucide-react";
import axiosInstance from "../../lib/axios";

export default function HealthVaccination() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isFullCalendarOpen, setIsFullCalendarOpen] = useState(false);
  const [localReminders, setLocalReminders] = useState([]);
  const [reminderData, setReminderData] = useState({ title: "", date: "", notes: "" });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eta, setEta] = useState("");
  const [filter, setFilter] = useState(searchParams.get("filter") || "All Tasks");

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
      const healthRes = await axiosInstance.get("/health-request");
      const healthData = healthRes.data || [];

      const formattedHealth = healthData.map(item => ({
        id: item._id,
        rawType: "health",
        label: item.type === "vaccination" ? "Vaccination" : "Animal Health Check",
        date: new Date(item.createdAt),
        status: item.status,
        farmer: item.farmerId,
        animal: item.animalId,
        urgency: item.urgency || "medium",
        icon: HeartPulse,
        originalData: item
      }));

      const combined = [...formattedHealth].sort((a, b) => b.date - a.date);
      setTasks(combined);
    } catch (error) {
      console.error("Failed to fetch all tasks", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const today = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const currentYear = currentDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentDate.getMonth(), 1).getDay();

  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
  const blanks = Array.from({length: adjustedFirstDay}, (_, i) => i);

  // Combine Tasks and Local Reminders for Calendar and Upcoming views
  const combinedEvents = [
     ...tasks,
     ...localReminders.map(r => ({ ...r, date: new Date(r.date), isLocalReminder: true }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  const taskCountsByDate = combinedEvents.reduce((acc, t) => {
      const d = new Date(t.date).getDate();
      const m = new Date(t.date).getMonth();
      const y = new Date(t.date).getFullYear();
      if (m === currentDate.getMonth() && y === currentYear) {
           acc[d] = acc[d] || { tasks: 0, reminders: 0 };
           if (t.isLocalReminder) acc[d].reminders++;
           else acc[d].tasks++;
      }
      return acc;
  }, {});

  useEffect(() => {
    fetchAllTasks();
  }, []);

  const handleConfirmAccept = async () => {
    if (!eta) return alert("Please specify your ETA.");
    try {
      const url = selectedTask.rawType === "health" 
        ? `/health-request/${selectedTask.id}/status` 
        : `/technician/inseminations/${selectedTask.id}/status`;
      
      const targetStatus = selectedTask.rawType === "health" ? "in-progress" : "approved";

      await axiosInstance.patch(url, {
        status: targetStatus,
        technicianNote: `Scheduled to arrive at: ${eta}`
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
    return [addr.barangay, addr.city].filter(Boolean).join(", ") || "No location";
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex justify-center items-center flex-col min-h-[50vh] gap-3">
        <span className="loading loading-infinity loading-lg text-[#074033] scale-150"></span>
        <p className="text-[#074033] font-medium tracking-wide animate-pulse">Loading Tasks...</p>
      </div>
    );
  }

  const filteredTasks = tasks.filter(task => {
    if (filter === "Pending") return task.status === "pending";
    if (filter === "Accepted") return task.status === "in-progress" || task.status === "approved";
    if (filter === "Completed") return task.status === "done" || task.status === "resolved";
    return true;
  });

  const getStatusBadge = (status) => {
    const s = status?.toLowerCase() || "";
    const isPending = s === 'pending';
    const isDone = s === 'done' || s === 'resolved';
    const isProgress = s === 'in-progress' || s === 'approved';

    if (isPending) return <span className="bg-gray-100 text-gray-500 font-bold px-3 py-1.5 rounded-full text-xs">Pending</span>;
    if (isProgress) return <span className="bg-[#b2f2d9] text-[#074033] font-bold px-3 py-1.5 rounded-full text-xs">Progress</span>;
    if (isDone) return <span className="bg-gray-100 text-gray-500 font-bold px-3 py-1.5 rounded-full text-xs">Completed</span>;
    return <span className="bg-gray-100 text-gray-400 font-bold px-3 py-1.5 rounded-full text-xs capitalize">{status}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4 sm:px-6 lg:px-8">
      {/* Action Row */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-6 pt-2">
         <p className="text-gray-500 font-medium text-[15px]">
            Manage veterinary tasks and vaccination schedules across all sectors.
         </p>
        
        <button onClick={() => setIsWalkInModalOpen(true)} className="py-2.5 px-5 rounded-lg text-sm font-semibold bg-[#074033] hover:bg-[#06352a] text-white transition-colors w-full xl:w-auto flex justify-center items-center gap-2">
           <span className="bg-white/20 p-0.5 rounded-full"><Plus size={16} /></span> Register Walk-in Health
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex mb-10">
         <div className="bg-gray-50 rounded-lg p-1 inline-flex items-center gap-1">
         {["All Tasks", "Pending", "Accepted", "Completed"].map(lbl => (
            <button 
              key={lbl}
              onClick={() => handleFilterChange(lbl)}
              className={`py-1.5 px-5 rounded-md text-[13px] font-semibold transition-all duration-200 ${filter === lbl ? 'bg-white text-[#074033] shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            >
              {lbl}
            </button>
         ))}
         </div>
      </div>

      {/* Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Modern Data Table */}
        <div className="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
           <div className="overflow-x-auto">
             <table className="table w-full border-separate border-spacing-y-0">
                <thead>
                  <tr className="bg-gray-50/50 text-[#111827] border-b border-gray-100">
                    <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Task Identity</th>
                    <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Scheduled & Locality</th>
                    <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Farmer & Contact</th>
                    <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Livestock Info</th>
                    <th className="px-6 py-5 text-center text-xs font-bold uppercase tracking-widest text-gray-400">Status</th>
                    <th className="px-8 py-5 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y-0">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-24 text-center">
                         <CheckCircle2 size={48} className="mx-auto text-gray-200 mb-4" />
                         <h3 className="text-xl font-bold text-gray-400 italic">No missions found in this sector</h3>
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
                          className="group hover:bg-gray-50/30 transition-colors cursor-default"
                        >
                          <td className="px-8 py-6">
                             <div className="flex items-center gap-4">
                                <div className={`w-12 h-14 rounded-xl flex items-center justify-center shrink-0 ${isUrgent ? 'bg-red-50 text-red-500' : 'bg-[#e6f7ec] text-[#074033]'}`}>
                                   <Icon size={24} strokeWidth={2} />
                                </div>
                                <div>
                                   <p className="font-bold text-gray-900 tracking-tight text-[15px]">{task.label}</p>
                                   <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 px-2 py-0.5 rounded-full inline-block ${isUrgent ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                      {isUrgent ? "Priority Mission" : "Standard"}
                                   </p>
                                </div>
                             </div>
                          </td>
                          <td className="px-6 py-6">
                             <p className="text-gray-900 font-bold text-sm tracking-tight">{task.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                             <div className="flex items-center gap-1.5 text-gray-500 mt-1">
                                <MapPin size={12} className="shrink-0" />
                                <p className="text-xs font-medium truncate max-w-[120px]">{task.farmer?.address?.barangay || "Unknown Sector"}</p>
                             </div>
                          </td>
                          <td className="px-6 py-6 text-sm">
                             <p className="text-gray-900 font-bold tracking-tight">{task.farmer?.name || "Anonymous User"}</p>
                             <p className="text-gray-500 font-medium text-xs mt-0.5">{task.farmer?.phoneNumber || "No Contact"}</p>
                          </td>
                          <td className="px-6 py-6">
                             <div>
                                <p className="text-gray-900 font-bold text-sm">#{task.animal?.earTag || "N/A"}</p>
                                <p className="text-gray-500 font-medium text-xs mt-0.5">{task.animal?.species || "General herd"}</p>
                             </div>
                          </td>
                          <td className="px-6 py-6 text-center">
                             {getStatusBadge(task.status)}
                          </td>
                          <td className="px-8 py-6 text-right">
                              <div className="dropdown dropdown-left dropdown-end">
                                <label tabIndex={0} className="btn btn-ghost btn-xs btn-square hover:bg-gray-100 rounded-lg text-gray-500">
                                   <MoreVertical size={16} />
                                </label>
                                <ul tabIndex={0} className="dropdown-content z-30 menu p-2 shadow-lg bg-white rounded-2xl w-52 border border-gray-100 mt-2">
                                   <li className="menu-title px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">Mission Actions</li>
                                   <li>
                                      <button onClick={() => { setSelectedTask(task); setIsDetailModalOpen(true); }} className="flex items-center gap-3 text-sm font-medium p-3 rounded-xl hover:bg-gray-50 text-gray-700 transition-colors">
                                         <FileText size={16} className="text-emerald-500" /> View Report
                                      </button>
                                   </li>
                                   {task.status === 'pending' && (
                                     <>
                                       <div className="h-px bg-gray-50 my-1 mx-2"></div>
                                       <li>
                                          <button onClick={() => { setSelectedTask(task); setIsAcceptModalOpen(true); }} className="flex items-center gap-3 text-sm font-bold p-3 rounded-xl hover:bg-emerald-50 text-[#074033] transition-colors">
                                            <CheckCircle2 size={16} /> Deploy & Accept
                                          </button>
                                       </li>
                                       <li>
                                          <button className="flex items-center gap-3 text-sm font-bold p-3 rounded-xl hover:bg-red-50 text-red-600 transition-colors">
-                                            <X size={16} /> Abort Request
+                                            <X size={16} /> Abort Request
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
           
           <div className="bg-gray-50/50 px-8 py-5 flex justify-between items-center text-xs font-medium text-gray-500">
               <p>Showing {Math.min(filteredTasks.length, 3)} of {filteredTasks.length} tasks</p>
               <div className="flex gap-4 text-gray-600">
                   <button className="hover:text-[#074033]"><ChevronRight size={14} className="rotate-180" /></button>
                   <button className="hover:text-[#074033]"><ChevronRight size={14} /></button>
               </div>
           </div>
        </div>

        {/* Right Sidebar Columns */}
        <div className="xl:col-span-1 space-y-6">
            
            {/* Calendar Box */}
            <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-7">
               <div className="flex justify-between items-center mb-6">
                   <h3 className="font-bold text-gray-900 text-[17px]">{currentMonth} {currentYear}</h3>
                   <div className="flex gap-1.5">
                       <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors"><ChevronRight className="rotate-180" size={16}/></button>
                       <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors"><ChevronRight size={16}/></button>
                   </div>
               </div>
               <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-gray-400 mb-3 tracking-widest">
                  <div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div><div>Su</div>
               </div>
               <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center text-[13px] font-bold text-gray-900">
                  {blanks.map(b => <div key={`blank-${b}`} className="p-2"></div>)}
                  {days.map(d => {
                     const hasTask = taskCountsByDate[d];
                     const isToday = d === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
                     return (
                       <div key={`day-${d}`} className={`p-2 rounded-full flex items-center justify-center relative cursor-pointer mx-auto w-8 h-8 transition-colors ${isToday ? 'bg-[#074033] text-white' : 'hover:bg-gray-100'}`}>
                          <span className="relative z-10">{d}</span>
                          {hasTask && !isToday && <span className="absolute -bottom-1 w-[3px] h-[3px] bg-[#074033] rounded-full"></span>}
                          {hasTask && isToday && <span className="absolute -bottom-1 w-[3px] h-[3px] bg-emerald-300 rounded-full"></span>}
                       </div>
                     )
                  })}
               </div>
            </div>

            {/* Upcoming Box */}
            <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-7">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-gray-900 text-[17px]">Upcoming</h3>
                  <button onClick={() => setIsReminderModalOpen(true)} className="text-[#074033] hover:underline font-semibold text-sm flex items-center gap-1">
                     <Plus size={14} /> Add Reminder
                  </button>
               </div>
               <div className="space-y-6">
                  {combinedEvents.filter(t => new Date(t.date) >= new Date().setHours(0,0,0,0)).slice(0, 3).map(t => {
                     const tDate = new Date(t.date);
                     const mon = tDate.toLocaleString('default', { month: 'short' }).toUpperCase();
                     const dNum = tDate.getDate();
                     return (
                         <div key={t.id || `rem-${tDate.getTime()}`} className="flex gap-4 items-start cursor-pointer group" onClick={() => { 
                             if(t.isLocalReminder) { alert(`Reminder: ${t.title}\n\nNotes: ${t.notes || "None"}`); } 
                             else { setSelectedTask(t); setIsDetailModalOpen(true); } 
                          }}>
                             <div className={`w-[50px] h-[55px] ${t.isLocalReminder ? 'bg-amber-50 text-amber-700' : 'bg-[#e6f7ec]/60 text-[#074033]'} rounded-lg flex flex-col items-center justify-center shrink-0`}>
                                <span className={`text-[10px] font-bold uppercase leading-none mb-1 ${t.isLocalReminder ? 'text-amber-600' : 'text-[#074033]'}`}>{mon}</span>
                                <span className={`text-[19px] font-bold leading-none tracking-tight ${t.isLocalReminder ? 'text-amber-700' : 'text-[#074033]'}`}>{dNum}</span>
                             </div>
                             <div className="pt-1">
                                <p className={`font-bold text-[15px] leading-tight transition-colors ${t.isLocalReminder ? 'text-amber-900 group-hover:text-amber-700' : 'text-gray-900 group-hover:text-[#074033]'}`}>{t.title || t.label}</p>
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mt-1.5">
                                   <Clock size={12} className="text-gray-400" />
                                   <span>{tDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                             </div>
                         </div>
                     );
                  })}
                  {combinedEvents.filter(t => new Date(t.date) >= new Date().setHours(0,0,0,0)).length === 0 && (
                      <div className="text-center py-4 text-gray-400 italic text-sm font-medium">No upcoming visits</div>
                  )}
               </div>
            </div>

            {/* View Full Calendar */}
            <button onClick={() => setIsFullCalendarOpen(true)} className="w-full border-2 border-dashed border-gray-200 text-gray-500 font-bold text-sm py-4 rounded-[14px] hover:border-gray-300 hover:text-gray-700 transition-colors">
                View Full Calendar
            </button>
        </div>

      </div>

      {/* Modal System */}
      <AnimatePresence>
        {isReminderModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 10 }}
               className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl relative"
             >
                <div className="absolute top-4 right-4">
                  <button onClick={() => setIsReminderModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6 mt-2">
                   <div>
                      <h3 className="text-gray-900 font-semibold text-lg border-b border-gray-200 pb-3 mb-5 flex items-center gap-2">
                         <Bell size={18} className="text-emerald-600"/> Add Calendar Reminder
                      </h3>
                      <div className="grid grid-cols-1 gap-5">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reminder Title</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Call Vet about vaccines" 
                              className="w-full h-11 bg-white border border-gray-300 rounded-xl px-4 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                              value={reminderData.title}
                              onChange={(e) => setReminderData({...reminderData, title: e.target.value})}
                            />
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date & Time</label>
                            <input 
                              type="datetime-local" 
                              className="w-full h-11 bg-white border border-gray-300 rounded-xl px-4 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                              value={reminderData.date}
                              onChange={(e) => setReminderData({...reminderData, date: e.target.value})}
                            />
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional Notes (Optional)</label>
                            <textarea 
                              className="w-full h-24 bg-white border border-gray-300 rounded-xl p-4 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors resize-none"
                              value={reminderData.notes}
                              onChange={(e) => setReminderData({...reminderData, notes: e.target.value})}
                            ></textarea>
                         </div>
                      </div>
                   </div>

                   <div className="flex justify-end pt-2 gap-3">
                       <button 
                         onClick={() => setIsReminderModalOpen(false)}
                         className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
                       >
                          Cancel
                       </button>
                       <button 
                         onClick={() => { 
                           if (!reminderData.title || !reminderData.date) return alert("Please fill out the required fields.");
                           setLocalReminders(prev => [...prev, { id: Date.now(), isLocalReminder: true, ...reminderData }]);
                           setIsReminderModalOpen(false); 
                           setReminderData({title:"", date:"", notes:""});
                         }}
                         className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm"
                       >
                          Save Reminder
                       </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}

        {isWalkInModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 10 }}
               className="bg-white rounded p-8 md:p-10 max-w-3xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
             >
                <div className="absolute top-4 right-4">
                  <button onClick={() => setIsWalkInModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-8 mt-2">
                   {/* Farmer Details Section */}
                   <div>
                      <h3 className="text-[#1e293b] font-bold text-[17px] border-b border-gray-800 pb-2 mb-5">Farmer Details</h3>
                      <div className="grid grid-cols-1 gap-5">
                         <div>
                            <label className="block text-sm text-gray-500 mb-1.5">Farmer Name / ID</label>
                            <input type="text" placeholder="John Doe" className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none focus:border-blue-500 transition-colors" />
                         </div>
                      </div>
                   </div>

                   {/* Animal Details Section */}
                   <div>
                      <h3 className="text-[#1e293b] font-bold text-[17px] border-b border-gray-800 pb-2 mb-5">Animal Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                         <div>
                            <label className="block text-sm text-gray-500 mb-1.5">Ear Tag No.</label>
                            <input type="text" placeholder="TAG-1234" className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none focus:border-blue-500 transition-colors" />
                         </div>
                      </div>
                   </div>

                   {/* Service Record */}
                   <div>
                      <h3 className="text-[#1e293b] font-bold text-[17px] border-b border-gray-800 pb-2 mb-5">Health & Vaccination Record</h3>
                      <div className="grid grid-cols-1 gap-5">
                         <div>
                            <label className="block text-sm text-gray-500 mb-1.5">Diagnosis / Vaccine Given</label>
                            <textarea placeholder="Record symptoms or vaccine details..." className="w-full h-[80px] bg-white border border-gray-300 rounded p-3 text-sm text-gray-700 outline-none focus:border-blue-500 transition-colors resize-none"></textarea>
                         </div>
                      </div>
                   </div>

                   <div className="flex justify-end pt-4">
                       <button 
                         onClick={() => { alert("Health record submitted!"); setIsWalkInModalOpen(false); }}
                         className="bg-[#0078d4] hover:bg-[#006cbd] text-white px-6 py-2.5 rounded font-bold text-sm transition-colors"
                       >
                          Submit Walk-in Transaction
                       </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}

        {isAcceptModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 10 }}
               className="bg-white rounded p-8 max-w-xl w-full shadow-2xl relative"
             >
                <div className="absolute top-4 right-4">
                  <button onClick={() => { setIsAcceptModalOpen(false); setSelectedTask(null); }} className="text-gray-400 hover:text-gray-700 transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6 mt-2">
                   <div>
                      <h3 className="text-[#1e293b] font-bold text-[17px] border-b border-gray-800 pb-2 mb-5">Finalize Deployment</h3>
                      <p className="text-sm text-gray-600 mb-4">
                         Confirm mission parameters with <strong>{selectedTask?.farmer?.name}</strong> and identify your estimated arrival time.
                      </p>
                      <div className="grid grid-cols-1 gap-5">
                         <div>
                            <label className="block text-sm text-gray-500 mb-1.5">Estimated Arrival (ETA)</label>
                            <input 
                              type="time" 
                              className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none focus:border-blue-500 transition-colors"
                              value={eta}
                              onChange={(e) => setEta(e.target.value)}
                            />
                         </div>
                      </div>
                   </div>

                   <div className="flex justify-end pt-4 gap-3">
                       <button 
                         onClick={() => { setIsAcceptModalOpen(false); setSelectedTask(null); }}
                         className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 px-6 py-2.5 rounded font-bold text-sm transition-colors"
                       >
                          Cancel
                       </button>
                       <button 
                         onClick={handleConfirmAccept}
                         className="bg-[#0078d4] hover:bg-[#006cbd] text-white px-6 py-2.5 rounded font-bold text-sm transition-colors"
                       >
                          Confirm Mission
                       </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}

        {isDetailModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 10 }}
               className="bg-white rounded p-8 md:p-10 max-w-3xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
             >
                <div className="absolute top-4 right-4">
                  <button onClick={() => { setIsDetailModalOpen(false); setSelectedTask(null); }} className="text-gray-400 hover:text-gray-700 transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-8 mt-2">
                   {/* Abstract Header */}
                   <div className="flex items-center gap-3 border-b border-gray-800 pb-3 mb-6">
                      <FileText size={20} className="text-[#1e293b]" />
                      <h3 className="text-[#1e293b] font-bold text-[17px]">Mission Brief (Ref: {selectedTask?.id?.substring(0, 8)})</h3>
                   </div>

                   {/* Content Sections */}
                   <div>
                      <h3 className="text-[#1e293b] font-bold text-[15px] border-b border-gray-300 pb-1 mb-3">Farmer Details</h3>
                      <p className="text-gray-700 text-sm mb-1">{selectedTask?.farmer?.name}</p>
                      <p className="text-gray-500 text-sm mb-1">{formatAddress(selectedTask?.farmer?.address)}</p>
                   </div>

                   <div>
                      <h3 className="text-[#1e293b] font-bold text-[15px] border-b border-gray-300 pb-1 mb-3">Animal Details</h3>
                      <p className="text-gray-700 text-sm mb-1">Tag: #{selectedTask?.animal?.earTag}</p>
                      <p className="text-gray-500 text-sm mb-1">{selectedTask?.animal?.species} / {selectedTask?.animal?.breed || 'General'}</p>
                   </div>

                   <div>
                      <h3 className="text-[#1e293b] font-bold text-[15px] border-b border-gray-300 pb-1 mb-3">Observation Notes</h3>
                      <div className="bg-gray-50 p-4 rounded text-gray-700 text-sm">
                         {selectedTask?.rawType === "health" ? (
                           selectedTask?.originalData?.symptoms || 'No specific symptoms reported by the owner.'
                         ) : (
                           `Priority Procedure: AI Cycle #${selectedTask?.originalData?.attemptNumber || 1}. Currently marked as ${selectedTask?.status?.toUpperCase()}. Requested on ${selectedTask?.date?.toLocaleDateString()}.`
                         )}
                         {selectedTask?.originalData?.technicianNote && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                               <strong>Tech Note:</strong> {selectedTask?.originalData?.technicianNote}
                            </div>
                         )}
                      </div>
                   </div>

                   <div className="flex justify-end pt-4">
                       <button 
                         onClick={() => { setIsDetailModalOpen(false); setSelectedTask(null); }}
                         className="bg-[#0078d4] hover:bg-[#006cbd] text-white px-6 py-2.5 rounded font-bold text-sm transition-colors"
                       >
                          Acknowledge Report
                       </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFullCalendarOpen && (
          <div className="fixed inset-0 z-100 bg-[#F4F5F7] flex flex-col h-screen overflow-hidden">
             {/* Header */}
             <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-4">
                   <button onClick={() => setIsFullCalendarOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                      <X size={24} className="text-gray-600" />
                   </button>
                   <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Full Calendar</h2>
                </div>
                <div className="flex items-center gap-6">
                   <h3 className="text-xl font-bold text-[#074033] w-48 text-right">{currentMonth} {currentYear}</h3>
                   <div className="flex gap-2">
                       <button onClick={handlePrevMonth} className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors font-medium text-sm flex items-center gap-1"><ChevronRight className="rotate-180" size={16}/> Prev</button>
                       <button onClick={() => setCurrentDate(new Date())} className="px-4 py-1.5 border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-900 font-bold text-sm transition-colors">Today</button>
                       <button onClick={handleNextMonth} className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors font-medium text-sm flex items-center gap-1">Next <ChevronRight size={16}/></button>
                   </div>
                </div>
             </div>

             {/* Grid Frame */}
             <div className="flex-1 flex flex-col overflow-hidden bg-white mt-4 mx-6 mb-6 rounded-2xl shadow-sm border border-gray-200 relative">
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/80 shrink-0">
                   {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                      <div key={day} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-widest text-center border-r last:border-r-0 border-gray-200">
                         {day}
                      </div>
                   ))}
                </div>
                <div className="flex-1 overflow-y-auto bg-gray-50/30">
                   <div className="grid grid-cols-7 auto-rows-[minmax(140px,1fr)] min-h-full">
                      {blanks.map(b => <div key={`blank-${b}`} className="border-r border-b border-gray-100 bg-gray-50/50"></div>)}
                      {days.map(d => {
                         const isToday = d === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
                         
                         // Events for this specific day
                         const dayEvents = combinedEvents.filter(t => {
                            const td = new Date(t.date);
                            return td.getDate() === d && td.getMonth() === currentDate.getMonth() && td.getFullYear() === currentDate.getFullYear();
                         });

                         return (
                           <div key={`cal-day-${d}`} className={`relative p-2 border-r border-b border-gray-200 transition-colors ${isToday ? 'bg-emerald-50/30' : 'bg-white hover:bg-gray-50/50'}`}>
                              <div className={`mt-1 ml-1 w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-[#074033] text-white shadow-sm' : 'text-gray-700'}`}>
                                 {d}
                              </div>
                              <div className="mt-2 space-y-1.5 px-1 pb-2">
                                 {dayEvents.map((evt, idx) => (
                                    <div 
                                      key={`${evt.id}-${idx}`} 
                                      className={`px-2 py-1.5 text-xs font-bold rounded-lg truncate cursor-pointer shadow-sm transition-transform hover:-translate-y-0.5 ${evt.isLocalReminder ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-[#e6f7ec]/80 text-[#074033] border border-emerald-100'}`}
                                      onClick={() => {
                                         if(evt.isLocalReminder) { alert(`Reminder: ${evt.title}\n\nNotes: ${evt.notes || "None"}`); } 
                                         else { setSelectedTask(evt); setIsDetailModalOpen(true); } 
                                      }}
                                    >
                                       {evt.title || evt.label}
                                    </div>
                                 ))}
                              </div>
                           </div>
                         )
                      })}
                   </div>
                </div>
             </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
