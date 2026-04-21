import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartPulse,
  Syringe,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  MapPin,
  ArrowRight,
  ShieldAlert,
  Plus,
  FileText,
  MoreVertical,
  ChevronRight,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import TaskActionModal from "../../components/modals/TaskActionModal";
import WalkInAIModal from "../../components/modals/WalkInAIModal";
import WalkInHealthModal from "../../components/modals/WalkInHealthModal";
import RegisterLivestockModal from "../../components/modals/RegisterLivestockModal";
import AnimalHistoryModal from "../../components/modals/AnimalHistoryModal";

export default function TechnicianDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isWalkInAIModalOpen, setIsWalkInAIModalOpen] = useState(false);
  const [isWalkInHealthModalOpen, setIsWalkInHealthModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  
  // Task Action Modal state
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await axiosInstance.get("/technician/dashboard-data");
        setData(response.data);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();

    // Real-time synchronization: Poll every 30 seconds
    const intervalId = setInterval(refreshDashboard, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const refreshDashboard = async () => {
    try {
      const response = await axiosInstance.get("/technician/dashboard-data");
      setData(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center flex-col min-h-[60vh] gap-4">
        <span className="loading loading-infinity loading-lg text-[#074033] scale-150"></span>
        <p className="text-[#074033] font-medium tracking-wide animate-pulse">
          Synchronizing Hub Data...
        </p>
      </div>
    );
  }


  const stats = data?.stats || {};
  const pendingRequests = data?.pendingRequests || [];
  const agendaItems = data?.agendaItems || [];
  const animalRegistry = data?.animalRegistry || [];
  const timeline = data?.timeline;

  const handleRejectRequest = async (item) => {
    if (!window.confirm("Are you sure you want to decline this request?")) return;
    
    // --- OPTIMISTIC UI: Remove from local state immediately ---
    setData(prev => ({
        ...prev,
        pendingRequests: prev.pendingRequests.filter(r => r.id !== item.id)
    }));

    try {
        const endpoint = item.type === 'health' ? `/health-request/${item.id}/status` : `/ai-request/${item.id}/status`;
        await axiosInstance.patch(endpoint, { 
            status: item.type === 'health' ? 'cancelled' : 'rejected', 
            technicianNote: 'Declined by technician' 
        });
        refreshDashboard(); // Sync with server
    } catch (err) {
        console.error("Failed to reject request", err);
        alert("Action failed. Reverting changes...");
        refreshDashboard(); // Revert on failure
    }
  };

  const handleOptimizeRoute = (e) => {
    e.preventDefault();
    if (agendaItems.length === 0) return;
    const destination = encodeURIComponent(agendaItems[agendaItems.length - 1].location);
    const waypoints = agendaItems.slice(0, -1).map(item => encodeURIComponent(item.location)).join('|');
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${destination}&waypoints=${waypoints}`;
    window.open(mapsUrl, '_blank');
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-8 pb-12 px-2 sm:px-6">
      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
         <div className="bg-[#126b2e] rounded-xl p-6 text-white relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[140px]">
            <div className="relative z-10 space-y-1">
               <h3 className="text-sm font-bold tracking-widest text-[#86bf9a] uppercase">Today's Activity</h3>
               <p className="text-5xl font-black">{stats?.totalInseminations ?? 0}</p>
            </div>
            <div className="relative z-10 flex items-center gap-2 text-xs font-medium text-[#c0e0cc] mt-4">
               <Syringe size={14} /> Total Services Logged
            </div>
            <Syringe className="absolute -bottom-8 -right-4 text-white/10 rotate-12" size={140} />
         </div>

         <div className="bg-[#0a5eb0] rounded-xl p-6 text-white relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[140px]">
            <div className="relative z-10 space-y-1">
               <h3 className="text-sm font-bold tracking-widest text-[#93c5fd] uppercase">Pending Actions</h3>
               <p className="text-5xl font-black">{stats?.healthAlerts ?? 0}</p>
            </div>
            <div className="relative z-10 flex items-center gap-2 text-xs font-medium text-[#bfdbfe] mt-4">
               <Clock size={14} className="stroke-[2.5px]" /> {pendingRequests.length} Waiting in Queue
            </div>
            <HeartPulse className="absolute -bottom-6 -right-4 text-white/10" size={140} />
         </div>

         <div className="bg-[#DEEBEF] rounded-xl p-6 relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[140px]">
            <div className="relative z-10 space-y-1">
               <h3 className="text-sm font-bold tracking-widest text-[#4b5563] uppercase">Success Rate</h3>
               <p className="text-5xl font-black text-[#126b2e]">{stats?.successRate || '0%'}</p>
            </div>
            <div className="relative z-10 flex items-center gap-2 text-xs font-medium text-[#126b2e] mt-4">
               <CheckCircle2 size={14} className="stroke-[2.5px]" /> Insemination Reliability
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* MAIN CONTENT AREA */}
        <div className="lg:col-span-8 space-y-8">
          {/* NEW REQUEST FEED */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-100 p-6 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-[#1e293b] text-lg font-black flex items-center gap-2">
                  <FileText size={20} className="text-blue-500" /> New Mobile Requests
                </h2>
                <p className="text-xs text-gray-500 font-bold mt-1 uppercase tracking-tight">Review and schedule incoming services</p>
              </div>
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black">{pendingRequests.length} PENDING</span>
            </div>
            
            <div className="p-6 space-y-4">
              {pendingRequests.length === 0 ? (
                <div className="py-12 text-center text-gray-400 font-medium">No new requests in the feed.</div>
              ) : (
                pendingRequests.map((item) => (
                  <div key={item.id} className="bg-white rounded-xl border border-gray-100 flex items-stretch overflow-hidden group hover:border-blue-400 transition-all hover:shadow-md">
                     <div className={`w-[4px] shrink-0 ${item.type === 'health' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                     <div className="flex-1 p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                             <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${item.type === 'health' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                               {item.type === 'health' ? 'Health Check' : 'AI Request'}
                             </span>
                             <span className="text-[10px] font-bold text-gray-400">Sent: {item.time}</span>
                          </div>
                          <h4 className="text-[15px] font-bold text-[#1e293b]">{item.task}</h4>
                          <p className="text-[13px] font-medium text-gray-500 flex items-center gap-1.5 mt-1">
                            <MapPin size={12} /> {item.farmer} · {item.location}
                          </p>
                        </div>
                        <div className="flex gap-2">
                           <button 
                             onClick={() => handleRejectRequest(item)}
                             className="px-4 py-2 rounded-lg text-xs font-bold text-gray-500 hover:text-rose-600 transition-colors"
                           >
                             Cancel
                           </button>
                           <button 
                             onClick={() => { setSelectedTask(item); setIsTaskModalOpen(true); }}
                             className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                           >
                             Accept & Schedule
                           </button>
                        </div>
                     </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* ANIMAL REGISTRY TABLE */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                 <h2 className="text-[#1e293b] text-lg font-bold">Animal Registry</h2>
                 <div className="flex flex-wrap gap-2 text-[11px] font-bold mt-4 sm:mt-0">
                    {["All", "Inseminated", "Pregnant", "Pending"].map(status => (
                      <button 
                        key={status}
                        onClick={() => setFilterStatus(status)} 
                        className={`px-4 py-1.5 rounded-full transition-colors ${filterStatus === status ? "bg-[#e6f7ec] text-[#074033]" : "text-gray-500 hover:text-gray-900"}`}
                      >{status}</button>
                    ))}
                 </div>
              </div>
              
              <div className="overflow-x-auto">
                 <table className="w-full text-left text-[13px] text-gray-600">
                    <thead className="bg-gray-50 text-[#1e293b] font-bold">
                       <tr>
                          <th className="py-3 px-6">ID</th>
                          <th className="py-3 px-4">Breed</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Last Event</th>
                          <th className="py-3 px-6 text-right">Actions</th>
                       </tr>
                    </thead>
                    <tbody>
                       {animalRegistry.length === 0 ? (
                         <tr><td colSpan="5" className="text-center py-10 text-gray-400 font-medium">No results found</td></tr>
                       ) : (
                         animalRegistry.filter(animal => {
                            if (filterStatus === "All") return true;
                            if (filterStatus === "Inseminated") return ["Inseminated", "Pending AI", "Pregnant"].includes(animal.status);
                            if (filterStatus === "Pending") return ["Pending", "Pending AI"].includes(animal.status);
                            return animal.status === filterStatus;
                         }).map((animal, idx) => (
                           <tr key={animal.rawId || idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                             <td className="py-4 px-6 font-bold text-gray-900">{animal.id}</td>
                             <td className="py-4 px-4 font-medium">{animal.breed}</td>
                             <td className="py-4 px-4">
                               <span className={`inline-flex items-center gap-1.5 font-bold ${animal.sClass}`}>
                                 <span className={`w-1.5 h-1.5 rounded-full ${animal.dotClass}`}></span>
                                 {animal.status}
                               </span>
                             </td>
                             <td className="py-4 px-4 font-medium text-gray-500">{animal.last}</td>
                             <td className="py-4 px-6 text-right">
                               <button 
                                 onClick={() => { setSelectedHistoryId(animal.rawId); setIsHistoryModalOpen(true); }} 
                                 className="text-[#0078d4] font-bold hover:underline"
                               >View History</button>
                             </td>
                           </tr>
                         ))
                       )}
                    </tbody>
                 </table>
              </div>
          </div>
        </div>

        {/* SIDEBAR AREA (Right Corner) */}
        <div className="lg:col-span-4 space-y-6">
          {/* TODAY'S AGENDA */}
          <div className="bg-[#1e293b] rounded-xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1e293b]">
              <div>
                <h2 className="text-white text-lg font-black flex items-center gap-2">
                  <Clock size={20} className="text-blue-400" /> Today's Schedule
                </h2>
                <p className="text-[10px] text-gray-400 font-black uppercase mt-1">Confirmed appointments</p>
              </div>
              <button onClick={handleOptimizeRoute} className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-black px-3 py-1.5 rounded-lg transition-colors">
                 MAP ROUTE
              </button>
            </div>
            
            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
              {agendaItems.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm font-bold">No tasks scheduled for today.</div>
              ) : (
                agendaItems.map((item, idx) => (
                   <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 group hover:bg-white/10 transition-colors">
                     <div className="flex justify-between items-start mb-2">
                        <span className="text-blue-400 text-xs font-black">{item.time}</span>
                        <div className={`w-2 h-2 rounded-full ${item.urgent ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-emerald-500'}`}></div>
                     </div>
                     <h4 className="text-[14px] font-bold text-white leading-tight">{item.task}</h4>
                     <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">{item.farmer} · {item.location}</p>
                     
                     <div className="mt-4 flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedTask(item); setIsTaskModalOpen(true); }}
                          className="flex-1 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold py-2 rounded-lg transition-colors"
                        >
                           Details
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedTask(item); setIsTaskModalOpen(true); }}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold py-2 rounded-lg transition-colors"
                        >
                           Complete
                        </button>
                     </div>
                   </div>
                ))
              )}
            </div>
          </div>

          {/* QUICK ACTIONS HUB */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-[#1e293b] text-lg font-bold border-b border-gray-200 pb-3 mb-5">Quick Actions</h2>
            <div className="space-y-3">
              {[
                { label: 'Walk-In AI', sub: 'Record impromptu service', icon: <Syringe size={18}/>, color: 'bg-blue-50 text-blue-600', action: () => setIsWalkInAIModalOpen(true) },
                { label: 'Walk-In Health', sub: 'Record treatment', icon: <HeartPulse size={18}/>, color: 'bg-emerald-50 text-emerald-600', action: () => setIsWalkInHealthModalOpen(true) },
                { label: 'Register Animal', sub: 'Link tag to farmer', icon: <Plus size={18}/>, color: 'bg-orange-50 text-orange-600', action: () => setIsRegisterModalOpen(true) }
              ].map((act, i) => (
                <button key={i} onClick={act.action} className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-100 p-3 rounded-xl flex items-center gap-3 transition-all group group-hover:scale-[1.02]">
                  <div className={`${act.color} p-2 rounded-lg group-hover:scale-110 transition-transform`}>{act.icon}</div>
                  <div className="text-left">
                    <h4 className="text-sm font-bold text-gray-800">{act.label}</h4>
                    <p className="text-[10px] text-gray-400 font-medium">{act.sub}</p>
                  </div>
                  <ChevronRight size={14} className="ml-auto text-gray-300" />
                </button>
              ))}
            </div>
          </div>

          {/* BREEDING TIMELINE */}
          <div className="bg-[#f8fafc] rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-[#1e293b] text-sm font-extrabold mb-6 uppercase tracking-wider">Breeding Timeline</h2>
            {timeline ? (
            <div className="relative border-l-2 border-blue-100 ml-2 space-y-8">
               {[
                 { title: 'Heat Detected', date: new Date(timeline.heatDate).toLocaleDateString(), color: 'bg-emerald-500', active: true },
                 { title: 'Optimal Window', date: 'Calculated Active', color: 'bg-blue-500', active: true, progress: 60 },
                 { title: 'Pregnancy Scan', date: 'Projected: +30 Days', color: 'bg-gray-300', active: false }
               ].map((step, i) => (
                 <div key={i} className={`relative pl-6 ${!step.active ? 'opacity-40' : ''}`}>
                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 border-white ${step.color} shadow-sm`}></div>
                    <h4 className="text-[11px] font-black text-gray-900 leading-none mb-1">{step.title}</h4>
                    <p className="text-[12px] font-bold text-gray-500">{step.date}</p>
                    {step.progress && (
                      <div className="w-full bg-blue-100 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${step.progress}%` }}></div>
                      </div>
                    )}
                 </div>
               ))}
            </div>
            ) : (
                <p className="text-gray-400 text-xs text-center py-4">No active timelines.</p>
            )}
            <button className="w-full mt-6 bg-[#074033] hover:bg-[#06352a] text-white py-3 rounded-xl shadow-md font-bold text-sm transition-transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
                <Plus size={18} /> New Event
            </button>
          </div>
        </div>
      </div>

      <TaskActionModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} taskData={selectedTask} onSuccess={refreshDashboard} />
      <WalkInAIModal isOpen={isWalkInAIModalOpen} onClose={() => setIsWalkInAIModalOpen(false)} onSuccess={refreshDashboard} />
      <WalkInHealthModal isOpen={isWalkInHealthModalOpen} onClose={() => setIsWalkInHealthModalOpen(false)} onSuccess={refreshDashboard} />
      <RegisterLivestockModal isOpen={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)} onSuccess={refreshDashboard} />
      <AnimalHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} animalId={selectedHistoryId} />
    </div>
  );
}
