import React, { useState, useEffect } from "react";
import { X, Syringe, HeartPulse, CheckCircle2, FileText, Loader2, Calendar, User, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axiosInstance from "../../lib/axios";

export default function AnimalHistoryModal({ isOpen, onClose, animalId }) {
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState(null);

  useEffect(() => {
    if (isOpen && animalId) {
      setLoading(true);
      const fetchHistory = async () => {
        try {
          const response = await axiosInstance.get(`/technician/animal-history/${animalId}`);
          setHistoryData(response.data);
        } catch (error) {
          console.error("Error fetching animal history", error);
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [isOpen, animalId]);

  if (!isOpen) return null;

  const renderIcon = (type) => {
    switch (type) {
      case "Syringe": return <Syringe size={16} />;
      case "HeartPulse": return <HeartPulse size={16} />;
      case "CheckCircle2": return <CheckCircle2 size={16} />;
      case "FileText": default: return <FileText size={16} />;
    }
  };

  const getStatusColor = (status) => {
    if (!status) return "bg-gray-100 text-gray-600";
    const s = status.toLowerCase();
    if (s === "done" || s === "resolved" || s === "approved") return "bg-emerald-100 text-emerald-700";
    if (s === "pending" || s === "in-progress") return "bg-amber-100 text-amber-700";
    if (s === "rejected" || s === "cancelled") return "bg-rose-100 text-rose-700";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-100 p-4 font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-[#f8fafc]">
            <div>
              <h2 className="text-xl font-bold text-[#1e293b]">Animal History</h2>
              <p className="text-sm font-medium text-gray-500 mt-1">
                {historyData?.animal?.earTag ? (
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-[#074033]">#{historyData.animal.earTag}</span>
                    <span className="text-gray-300">|</span>
                    <User size={14} className="text-blue-500" />
                    <span>Owner: {historyData.animal.farmerId?.name || "Unknown"}</span>
                  </span>
                ) : 'Retrieving timeline...'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500 hover:text-gray-900"
            >
              <X size={20} className="stroke-[2.5]" />
            </button>
          </div>

          {/* Scrolling Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar relative">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="animate-spin text-[#074033]" size={32} />
                <p className="text-sm font-bold text-gray-400">Loading comprehensive timeline...</p>
              </div>
            ) : historyData?.timeline && historyData.timeline.length > 0 ? (
              <div className="relative border-l-2 border-gray-100 ml-4 space-y-8 pb-4">
                {historyData.timeline.map((event, idx) => (
                  <div key={event._id || idx} className="relative pl-6">
                    {/* Timeline Node */}
                    <div className="absolute -left-[17px] top-1 w-8 h-8 rounded-full bg-white border-2 border-gray-100 shadow-sm flex items-center justify-center text-[#074033]">
                      {renderIcon(event.iconType)}
                    </div>
                    
                    <div className="bg-[#f8fafc] border border-gray-100 rounded-xl p-4 shadow-sm hover:border-gray-200 hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-[15px] font-bold text-[#1e293b]">{event.title}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getStatusColor(event.status)}`}>
                          {event.status}
                        </span>
                      </div>
                      
                      <p className="text-[13px] text-gray-600 font-medium leading-relaxed mb-3">
                        {event.description}
                      </p>
                      
                      <div className="flex items-center gap-4 text-[11px] font-bold text-gray-400 mt-2 border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} />
                          {new Date(event.date).toLocaleDateString()} @ {new Date(event.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        <div className="flex flex-col gap-1 ml-auto text-gray-500 text-right justify-end">
                          <div className="flex items-center justify-end gap-1.5 font-bold">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                            {event.technicianName || event.by}
                          </div>
                          {event.technicianLocation && (
                            <div className="flex items-center justify-end gap-1 text-[9px] uppercase tracking-widest text-gray-400">
                              <MapPin size={10} />
                              {event.technicianLocation}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="mx-auto text-gray-300 mb-3" size={48} />
                <p className="text-gray-500 text-sm font-medium">No historical records found for this animal.</p>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-gray-100 bg-[#f8fafc] flex justify-end">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
