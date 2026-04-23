import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  HeartPulse, Syringe, MapPin, ChevronRight, FileText, 
  CheckCircle2, Clock, MoreVertical, X, AlertCircle, Info, Plus, Calendar as CalendarIcon, User
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import TaskActionModal from "../../components/modals/TaskActionModal";
import { useToast } from "../../contexts/ToastContext";

export default function HealthVaccination() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
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
        type: "health",
        label: item.requestType === "vaccination" ? "Vaccination" : "Animal Health Check",
        task: item.requestType === "vaccination" ? "Vaccination" : "Health Check",
        date: new Date(item.scheduledDate || item.preferredDate || item.createdAt),
        displayDate: item.scheduledDate || item.preferredDate || item.createdAt,
        status: item.status,
        farmer: item.farmerId?.name || "Unknown",
        location: item.farmerId?.address?.barangay || "Unknown Sector",
        animal: item.animalId,
        urgency: item.urgency || "medium",
        icon: HeartPulse,
        raw: item
      }));

      const combined = [...formattedHealth].sort((a, b) => b.date - a.date);
      setTasks(combined);
    } catch (error) {
      console.error("Failed to fetch all tasks", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllTasks();
  }, []);

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

  // Adjust for Monday start (0=Sun, 1=Mon... 6=Sat)
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
  const blanks = Array.from({length: adjustedFirstDay}, (_, i) => i);

  const taskCountsByDate = tasks.reduce((acc, t) => {
      const td = new Date(t.date);
      if (td.getMonth() === currentDate.getMonth() && td.getFullYear() === currentYear) {
           const d = td.getDate();
           acc[d] = (acc[d] || 0) + 1;
      }
      return acc;
  }, {});

  const filteredTasks = tasks.filter(task => {
    // Status Filter
    let passStatus = true;
    if (filter === "Pending") passStatus = task.status === "pending";
    else if (filter === "Accepted") passStatus = task.status === "in-progress" || task.status === "approved";
    else if (filter === "Completed") passStatus = task.status === "done" || task.status === "resolved";

    // Date Filter (Calendar)
    let passDate = true;
    if (selectedCalendarDate) {
        const td = new Date(task.date);
        passDate = td.getDate() === selectedCalendarDate.getDate() && 
                   td.getMonth() === selectedCalendarDate.getMonth() &&
                   td.getFullYear() === selectedCalendarDate.getFullYear();
    }

    return passStatus && passDate;
  });

  const getStatusBadge = (status) => {
    const s = status?.toLowerCase() || "";
    if (s === 'pending') return <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full border border-amber-100 uppercase tracking-tighter">Pending</span>;
    if (s === 'in-progress' || s === 'approved') return <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full border border-emerald-100 uppercase tracking-tighter">In Progress</span>;
    if (s === 'resolved' || s === 'done') return <span className="px-3 py-1 bg-gray-50 text-gray-500 text-[10px] font-black rounded-full border border-gray-100 uppercase tracking-tighter">Completed</span>;
    return <span className="px-3 py-1 bg-gray-50 text-gray-400 text-[10px] font-black rounded-full border border-gray-100 uppercase tracking-tighter">{status}</span>;
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex justify-center items-center flex-col min-h-[50vh] gap-3">
        <span className="loading loading-infinity loading-lg text-[#074033] scale-150"></span>
        <p className="text-[#074033] font-medium tracking-wide animate-pulse">Loading Tasks...</p>
      </div>
    );
  }


  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4 sm:px-6 lg:px-8 bg-[#fdfdfd]">
      {/* Header & Filter Row */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-10 pt-6">
        <div>
          <div className="flex items-center gap-4 mb-4">
             <div className="w-14 h-14 bg-[#074033] rounded-2xl flex items-center justify-center shadow-lg shadow-[#074033]/20">
                <HeartPulse className="text-white" size={28} />
             </div>
             <h1 className="text-4xl font-black text-[#111827] tracking-tighter uppercase leading-none">Health & Vaccination</h1>
          </div>
          <p className="text-gray-500 font-medium text-sm flex items-center gap-2">
            <Info size={16} className="text-emerald-600" />
            Manage and schedule veterinary treatments across all sectors.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 self-start xl:self-auto">
          <button onClick={() => setIsWalkInModalOpen(true)} className="py-3 px-8 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] bg-[#074033] text-white shadow-xl shadow-[#074033]/15 hover:translate-y-[-2px] transition-all flex items-center justify-center gap-2">
             <Plus size={16} /> Register Walk-in Health
          </button>
          <div className="bg-white rounded-2xl p-1.5 inline-flex items-center shadow-sm border border-gray-100/50">
            {["All Tasks", "Pending", "Accepted", "Completed"].map(lbl => (
              <button 
                key={lbl}
                onClick={() => handleFilterChange(lbl)}
                className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${filter === lbl ? 'bg-[#074033] text-white shadow-md' : 'text-gray-400 hover:text-[#074033]'}`}
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
        <div className="xl:col-span-3 bg-white rounded-4xl shadow-2xl shadow-gray-200/40 border border-gray-100 overflow-hidden">
           <div className="overflow-x-auto">
             <table className="table w-full border-separate border-spacing-y-0">
                <thead>
                  <tr className="bg-gray-50/50 text-[#111827] border-b border-gray-100/50">
                    <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Mission / Priority</th>
                    <th className="px-6 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Schedule & Sector</th>
                    <th className="px-6 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Farmer Context</th>
                    <th className="px-6 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Specimen ID</th>
                    <th className="px-6 py-6 text-center text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Status</th>
                    <th className="px-8 py-6 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-32 text-center">
                         <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 size={40} className="text-gray-200" />
                         </div>
                         <h3 className="text-xl font-bold text-gray-300 italic tracking-tight">No active deployments in this sector</h3>
                         {selectedCalendarDate && (
                            <button 
                                onClick={() => setSelectedCalendarDate(null)}
                                className="mt-4 text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:underline"
                            >Clear Date Filter</button>
                         )}
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => (
                        <motion.tr 
                          initial={{ opacity: 0 }} 
                          animate={{ opacity: 1 }} 
                          key={task.id} 
                          className="group hover:bg-gray-50/50 transition-colors cursor-default"
                        >
                          <td className="px-8 py-7">
                             <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${task.urgency === 'high' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-[#074033]'}`}>
                                   <HeartPulse size={24} strokeWidth={2.5} />
                                </div>
                                <div>
                                   <p className="font-extrabold text-[#111827] tracking-tight text-[15px]">{task.label}</p>
                                   <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${task.urgency === 'high' ? 'text-rose-400' : 'text-emerald-500'}`}>
                                      {task.urgency === 'high' ? "Priority Mission" : "Standard Procedure"}
                                   </p>
                                </div>
                             </div>
                          </td>
                          <td className="px-6 py-7">
                             <p className="text-[#111827] font-bold text-sm tracking-tight">{task.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                             <p className="text-gray-400 font-bold text-[10px] uppercase tracking-tighter mt-1 flex items-center gap-1">
                                <MapPin size={10} /> {task.location}
                             </p>
                          </td>
                          <td className="px-6 py-7 text-sm">
                             <p className="text-[#111827] font-bold tracking-tight">{task.farmer}</p>
                             <p className="text-gray-400 font-bold text-[10px] mt-1 shrink-0">CONT: {task.raw?.farmerId?.phoneNumber || "N/A"}</p>
                          </td>
                          <td className="px-6 py-7">
                             <div className="flex items-center gap-3">
                                {task.animal?.imageUrl ? (
                                    <img src={task.animal.imageUrl} className="w-9 h-9 rounded-xl object-cover border border-gray-100" alt="Livestock" />
                                ) : (
                                    <div className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center flex text-gray-400">
                                        <Plus size={16} />
                                    </div>
                                )}
                                <div>
                                   <p className="text-[#111827] font-bold text-sm leading-none mb-1">#{task.animal?.earTag || "---"}</p>
                                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{task.animal?.breed || task.animal?.species}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-6 py-7 text-center">
                             {getStatusBadge(task.status)}
                          </td>
                          <td className="px-8 py-7 text-right">
                             <button 
                                onClick={() => { setSelectedTask(task); setIsTaskModalOpen(true); }}
                                className="h-10 px-4 bg-gray-50 hover:bg-[#074033] hover:text-white text-gray-500 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95"
                             >
                                Manage
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
            <div className="bg-white rounded-4xl shadow-2xl shadow-gray-200/40 border border-gray-100 p-8">
               <div className="flex justify-between items-center mb-8">
                   <h3 className="font-extrabold text-[#111827] text-lg tracking-tight uppercase">{currentMonth} {currentYear}</h3>
                   <div className="flex gap-1">
                       <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-50 rounded-xl text-gray-400"><ChevronRight className="rotate-180" size={18}/></button>
                       <button onClick={handleNextMonth} className="p-2 hover:bg-gray-50 rounded-xl text-gray-400"><ChevronRight size={18}/></button>
                   </div>
               </div>
               <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest">
                  <div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div><div>Su</div>
               </div>
               <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center text-[13px] font-black text-gray-900">
                  {blanks.map(b => <div key={`blank-${b}`} className="p-2"></div>)}
                  {days.map(d => {
                     const dateKey = new Date(currentYear, currentDate.getMonth(), d);
                     const hasTask = taskCountsByDate[d];
                     const isToday = d === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
                     const isSelected = selectedCalendarDate && d === selectedCalendarDate.getDate() && currentDate.getMonth() === selectedCalendarDate.getMonth() && currentDate.getFullYear() === selectedCalendarDate.getFullYear();
                     
                     return (
                       <button 
                        key={`day-${d}`} 
                        onClick={() => setSelectedCalendarDate(isSelected ? null : dateKey)}
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center relative transition-all duration-300 shadow-sm
                           ${isSelected ? 'bg-[#074033] text-white shadow-[#074033]/30 scale-110' : isToday ? 'bg-emerald-50 text-emerald-700' : 'text-[#1e293b] hover:bg-gray-50'}`}
                       >
                          <span className="relative z-10">{d}</span>
                          {hasTask && !isSelected && <span className={`absolute bottom-0 w-1 h-1 rounded-full ${isToday ? 'bg-emerald-700' : 'bg-[#074033]'}`}></span>}
                       </button>
                     )
                  })}
               </div>

               {selectedCalendarDate && (
                  <div className="mt-8 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                     <div className="flex justify-between items-center bg-gray-50 rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                           <CalendarIcon size={16} className="text-[#074033]" />
                           <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{selectedCalendarDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}</p>
                        </div>
                        <button onClick={() => setSelectedCalendarDate(null)} className="text-[10px] font-black text-rose-500 hover:scale-110 transition-transform uppercase">Clear</button>
                     </div>
                  </div>
               )}
            </div>

            {/* Stats Overview */}
            <div className="bg-[#074033] rounded-4xl p-8 shadow-2xl shadow-emerald-900/10 text-white flex flex-col gap-8">
                <div>
                   <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-6">Mission Summary</h4>
                   <div className="space-y-6">
                      <div className="flex justify-between items-end">
                         <div>
                            <p className="text-3xl font-black">{tasks.filter(t => t.status === 'pending').length}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Pending Deployments</p>
                         </div>
                         <HeartPulse size={32} className="opacity-20 translate-y-1" />
                      </div>
                      <div className="h-px bg-white/10" />
                      <div className="flex justify-between items-end">
                         <div>
                            <p className="text-3xl font-black">{tasks.filter(t => t.status === 'done' || t.status === 'resolved').length}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Successful Clearances</p>
                         </div>
                         <CheckCircle2 size={32} className="opacity-20 translate-y-1" />
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
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative"
             >
                <div className="absolute top-8 right-8">
                  <button onClick={() => setIsWalkInModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                    <X size={24} className="text-gray-300" />
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-10">
                   <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center text-[#074033]">
                      <Plus size={32} />
                   </div>
                   <div>
                      <h3 className="text-2xl font-black text-[#111827] uppercase tracking-tight">Manual Entry</h3>
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Register Walk-in Health Service</p>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block ml-1">Farmer Contact</label>
                         <input type="text" placeholder="Name or Phone" className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-sm focus:ring-2 focus:ring-[#074033] transition-all" />
                      </div>
                      <div>
                         <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block ml-1">Ear Tag ID</label>
                         <input type="text" placeholder="#0000" className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-sm focus:ring-2 focus:ring-[#074033] transition-all" />
                      </div>
                   </div>
                   <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block ml-1">Technical Findings</label>
                      <textarea placeholder="Describe treatment or symptoms..." className="w-full h-32 bg-gray-50 border-none rounded-2xl p-5 font-bold text-sm focus:ring-2 focus:ring-[#074033] transition-all resize-none"></textarea>
                   </div>
                   <button 
                     onClick={() => { toast.success("Walk-in record logged!"); setIsWalkInModalOpen(false); }}
                     className="w-full h-16 bg-[#074033] hover:scale-[1.02] active:scale-95 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-[#074033]/20 transition-all mt-4"
                   >
                      Finalize Entry
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
