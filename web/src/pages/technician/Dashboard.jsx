import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Users,
  MoreVertical,
  ChevronRight,
  Database,
  Search,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import Skeleton, { TableRowSkeleton } from "../../components/Skeleton";
import TaskActionModal from "../../components/modals/TaskActionModal";
import WalkInAIModal from "../../components/modals/WalkInAIModal";
import WalkInHealthModal from "../../components/modals/WalkInHealthModal";
import RegisterLivestockModal from "../../components/modals/RegisterLivestockModal";
import AnimalHistoryModal from "../../components/modals/AnimalHistoryModal";
import RegisterFarmerModal from "../../components/modals/RegisterFarmerModal";
import { useToast } from "../../contexts/ToastContext";

export default function TechnicianDashboard() {
  const toast = useToast();
  const {
    data: stats,
    isLoading: statsLoading,
  } = useQuery({
    queryKey: ["technician", "stats"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/dashboard-stats");
      return res.data;
    },
    staleTime: 1000 * 60 * 2, // 2 mins
  });

  const {
    data: feed,
    isLoading: feedLoading,
    refetch: refreshFeed,
  } = useQuery({
    queryKey: ["technician", "feed"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/dashboard-feed");
      return res.data;
    },
    refetchInterval: 10000, // 10 seconds is plenty for the feed
  });

  const {
    data: animalRegistry = [],
    isLoading: registryLoading,
  } = useQuery({
    queryKey: ["technician", "registry"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/dashboard-registry");
      return res.data;
    },
    staleTime: 1000 * 60 * 5, // 5 mins for the registry
  });

  const loading = statsLoading || feedLoading || registryLoading;
  const pendingRequests = feed?.pendingRequests || [];
  const agendaItems = feed?.agendaItems || [];

  const { data: config, refetch: refetchConfig } = useQuery({
    queryKey: ["system", "config"],
    queryFn: async () => {
      const response = await axiosInstance.get("/config");
      return response.data;
    },
  });

  const toggleHolidayMutation = useMutation({
    mutationFn: async (isHoliday) => {
      await axiosInstance.post("/config/holiday", { isHoliday });
    },
    onSuccess: () => {
      refetchConfig();
    },
    onError: (err) => {
      toast.error(
        "Failed to update holiday mode: " +
          (err.response?.data?.message || err.message),
      );
    },
  });

  const [isWalkInAIModalOpen, setIsWalkInAIModalOpen] = useState(false);
  const [isWalkInHealthModalOpen, setIsWalkInHealthModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isRegisterFarmerModalOpen, setIsRegisterFarmerModalOpen] =
    useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [healthPrefill, setHealthPrefill] = useState(null);

  const itemsPerPage = 12;
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("All");

  const filteredRegistry = React.useMemo(() => {
    return animalRegistry.filter((animal) => {
      if (filterStatus === "All") return true;
      if (filterStatus === "Inseminated")
        return ["Inseminated", "Pending AI", "Pregnant"].includes(animal.status);
      if (filterStatus === "Pending")
        return ["Pending", "Pending AI"].includes(animal.status);
      return animal.status === filterStatus;
    });
  }, [animalRegistry, filterStatus]);

  const [decliningItem, setDecliningItem] = useState(null);


  // Removing old data extractions as they are now handled by separate queries

  const handleRejectRequest = async (item) => {
    if (decliningItem !== item.id) {
      setDecliningItem(item.id);
      setTimeout(() => setDecliningItem(null), 3000);
      return;
    }

    try {
      const endpoint =
        item.type === "health"
          ? `/health-request/${item.id}/status`
          : `/technician/inseminations/${item.id}/status`;
          
      await axiosInstance.patch(endpoint, {
        status: item.type === "health" ? "cancelled" : "rejected",
        technicianNote: "Declined by technician",
      });
      
      toast.success("Request Declined Successfully");
      setDecliningItem(null);
      refreshFeed(); // Sync with server immediately
    } catch (err) {
      console.error("Failed to reject request", err);
      toast.error(err.response?.data?.message || "Failed to update status");
    } finally {
      setDecliningItem(null);
    }
  };

  const handleOptimizeRoute = (e) => {
    e.preventDefault();
    if (agendaItems.length === 0) return;
    const destination = encodeURIComponent(
      agendaItems[agendaItems.length - 1].location,
    );
    const waypoints = agendaItems
      .slice(0, -1)
      .map((item) => encodeURIComponent(item.location))
      .join("|");
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${destination}&waypoints=${waypoints}`;
    window.open(mapsUrl, "_blank");
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-8 pb-12 px-2 sm:px-6 bg-base-200 min-h-screen pt-4">
      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-[#126b2e] rounded-xl p-6 text-white relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[140px]">
          <div className="relative z-10 space-y-1">
            <h3 className="text-sm font-bold tracking-widest text-[#86bf9a] uppercase">
              Today's Activity
            </h3>
            <div className="text-5xl font-black">
              {loading ? <Skeleton className="h-12 w-16" /> : (stats?.totalToday ?? 0)}
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-2 text-xs font-medium text-[#c0e0cc] mt-4">
            <Syringe size={14} /> Total Services Logged
          </div>
          <Syringe
            className="absolute -bottom-8 -right-4 text-white/10 rotate-12"
            size={140}
          />
        </div>

        <div className="bg-[#0a5eb0] rounded-xl p-6 text-white relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[140px]">
          <div className="relative z-10 space-y-1">
            <h3 className="text-sm font-bold tracking-widest text-[#93c5fd] uppercase">
              Pending Actions
            </h3>
            <div className="text-5xl font-black">
              {loading ? <Skeleton className="h-12 w-16" /> : (stats?.pendingHealth ?? 0)}
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-2 text-xs font-medium text-[#bfdbfe] mt-4">
            <Clock size={14} className="stroke-[2.5px]" />{" "}
            {pendingRequests.length} Waiting in Queue
          </div>
          <HeartPulse
            className="absolute -bottom-6 -right-4 text-white/10"
            size={140}
          />
        </div>

        <div className="bg-[#DEEBEF] rounded-xl p-6 relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[140px]">
          <div className="relative z-10 space-y-1">
            <h3 className="text-sm font-bold tracking-widest text-[#4b5563] uppercase">
              Success Rate
            </h3>
            <div className="text-5xl font-black text-[#126b2e]">
              {loading ? <Skeleton className="h-12 w-20" /> : (stats?.successRate || "0%")}
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-2 text-xs font-medium text-[#126b2e] mt-4">
            <CheckCircle2 size={14} className="stroke-[2.5px]" /> Insemination
            Reliability
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* MAIN CONTENT AREA */}
        <div className="lg:col-span-8 space-y-8">
          {/* NEW REQUEST FEED */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 overflow-hidden">
            <div className="border-b border-base-300 p-6 flex justify-between items-center bg-base-200/50">
              <div>
                <h2 className="text-base-content text-lg font-black flex items-center gap-2">
                  <FileText size={20} className="text-blue-500" /> New Mobile
                  Requests
                </h2>
                <p className="text-xs text-base-content/40 font-bold mt-1 uppercase tracking-tight">
                  Review and schedule incoming services
                </p>
              </div>
              <span className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full text-[10px] font-black">
                {pendingRequests.length} PENDING
              </span>
            </div>

            <div className="p-6 space-y-4">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-base-200/50 rounded-2xl border border-base-300 p-4 space-y-3">
                      <div className="skeleton h-4 w-24 bg-base-300/50"></div>
                      <div className="skeleton h-6 w-3/4 bg-base-300/50"></div>
                      <div className="skeleton h-4 w-1/2 bg-base-300/50"></div>
                    </div>
                  ))}
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="py-12 text-center text-base-content/20 font-black uppercase tracking-widest text-[10px]">
                  No new requests in the feed.
                </div>
              ) : (
                pendingRequests.map((item) => (
                  <div
                    key={item.id}
                    className="bg-base-100 rounded-3xl border border-base-300 p-6 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span
                            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              item.type === "health"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/20"
                            }`}
                          >
                            {item.type === "health"
                              ? "Health Check"
                              : "AI Request"}
                          </span>
                          <span className="text-[10px] font-black text-base-content/20 uppercase tracking-widest">
                            {item.sentTime}
                          </span>
                        </div>
                        <h4 className="text-lg font-black text-base-content tracking-tighter">
                          {item.task}
                        </h4>
                        <p className="text-sm font-bold text-base-content/40 flex items-center gap-2 mt-1">
                          <MapPin size={14} className="text-blue-500" />{" "}
                          {item.farmer} · {item.location}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-6">
                      <button
                        onClick={() => handleRejectRequest(item)}
                        className={`px-6 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          decliningItem === item.id
                            ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                            : "bg-base-200 text-base-content/40 hover:bg-rose-500/10 hover:text-rose-600"
                        }`}
                      >
                        {decliningItem === item.id ? "Confirm?" : "Cancel"}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTask(item);
                          setIsTaskModalOpen(true);
                        }}
                        className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/10"
                      >
                        Accept & Schedule
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ANIMAL REGISTRY TABLE */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 overflow-hidden">
            <div className="p-6 border-b border-base-300 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-base-200/50">
              <h2 className="text-base-content text-lg font-black flex items-center gap-2">
                <Database size={20} className="text-[#074033] dark:text-emerald-500" /> Animal
                Registry
              </h2>
                <div className="flex flex-wrap gap-2 text-[11px] font-bold bg-base-200 p-1 rounded-xl shadow-inner border border-base-300">
                  {["All", "Inseminated", "Pregnant", "Pending"].map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setFilterStatus(status);
                        setCurrentPage(1);
                      }}
                      className={`px-4 py-1.5 rounded-lg transition-all ${filterStatus === status ? "bg-[#074033] dark:bg-emerald-600 text-white shadow-md" : "text-base-content/40 hover:text-base-content"}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] text-base-content/70">
                <thead className="bg-base-200 text-base-content font-bold border-b border-base-300">
                  <tr>
                    <th className="py-3 px-6">ID</th>
                    <th className="py-3 px-4">Breed</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Event</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <>
                      {[...Array(5)].map((_, i) => (
                        <TableRowSkeleton key={i} />
                      ))}
                    </>
                  ) : (() => {
                    const totalPages = Math.ceil(
                      filteredRegistry.length / itemsPerPage,
                    );
                    const paginated = filteredRegistry.slice(
                      (currentPage - 1) * itemsPerPage,
                      currentPage * itemsPerPage,
                    );

                    if (filteredRegistry.length === 0) {
                      return (
                        <tr>
                          <td
                            colSpan="5"
                            className="text-center py-10 text-base-content/20 font-black uppercase tracking-widest text-[10px]"
                          >
                            No results found
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <>
                        {paginated.map((animal, idx) => {
                          const diffDays = animal.lastActionDate
                            ? Math.floor(
                                (Date.now() -
                                  new Date(animal.lastActionDate).getTime()) /
                                  (1000 * 60 * 60 * 24),
                              )
                            : 0;
                          return (
                            <tr
                              key={animal.rawId || idx}
                              className="border-b border-base-300 hover:bg-base-200/50 transition-colors"
                            >
                              <td className="py-4 px-6 font-black text-base-content relative group cursor-default">
                                {animal.id}
                                <div className="absolute left-16 top-1/2 -translate-y-1/2 ml-2 w-64 bg-base-100 backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] rounded-2xl p-4 border border-base-300 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-50 transform scale-95 group-hover:scale-100 origin-left">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-base-200 overflow-hidden shrink-0 shadow-inner">
                                      {animal.imageUrl ? (
                                        <img
                                          src={animal.imageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_100,c_fill/')}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div 
                                          className="w-full h-full flex items-center justify-center text-white font-black text-xs uppercase"
                                          style={{ backgroundColor: animal.status === "Pregnant" ? "#7c3aed" : "#074033" }}
                                        >
                                          {animal.id.substring(1, 3)}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-[9px] font-black uppercase text-blue-500 tracking-widest leading-none mb-1">
                                        Registered Owner
                                      </p>
                                      <p className="text-sm font-black text-base-content leading-tight block truncate w-36">
                                        {animal.farmerName}
                                      </p>
                                      <p className="text-[10px] font-bold text-base-content/40 mt-1">
                                        {animal.farmerPhone ||
                                          "No contact info"}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4 font-medium align-top">
                                {animal.breed}
                              </td>
                              <td className="py-4 px-4 align-top w-48">
                                <span
                                  className={`inline-flex items-center gap-1.5 font-bold ${animal.sClass}`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${animal.dotClass}`}
                                  ></span>
                                  {animal.status}
                                </span>

                                {animal.status === "Pregnant" &&
                                  animal.lastActionDate && (
                                    <div className="mt-2.5 w-full">
                                      <div className="flex justify-between mb-1.5 items-end">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-base-content/30">
                                          Gestation
                                        </span>
                                        <span
                                          className={`text-[10px] font-black ${diffDays > 270 ? "text-emerald-500" : "text-purple-500"}`}
                                        >
                                          {Math.min(
                                            100,
                                            Math.floor((diffDays / 283) * 100),
                                          )}
                                          %
                                        </span>
                                      </div>
                                      <div className="w-full bg-base-300 h-1.5 rounded-full overflow-hidden shadow-inner">
                                        <div
                                          className={`h-full transition-all duration-1000 ${diffDays > 270 ? "bg-emerald-500" : "bg-purple-500"}`}
                                          style={{
                                            width: `${Math.min(100, Math.floor((diffDays / 283) * 100))}%`,
                                          }}
                                        ></div>
                                      </div>
                                      {diffDays > 270 && (
                                        <p className="text-emerald-500 mt-1 uppercase tracking-widest text-[9px] font-black animate-pulse flex items-center gap-1">
                                          <AlertCircle size={10} /> Calving
                                          Imminent
                                        </p>
                                      )}
                                    </div>
                                  )}

                                {/* Smart Check Due Alert */}
                                {animal.status === "Inseminated" &&
                                  animal.lastActionDate &&
                                  diffDays > 21 && (
                                    <div className="mt-2 inline-flex items-center gap-1 text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm border border-amber-100">
                                      <AlertCircle size={10} /> Check Due
                                    </div>
                                  )}
                              </td>
                              <td className="py-4 px-4 font-black text-base-content/30 align-top pt-5">
                                {animal.last}
                              </td>
                              <td className="py-4 px-6 align-top text-right">
                                <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => {
                                        setHealthPrefill({
                                          farmerName: animal.farmerName,
                                          earTag: animal.id.replace("#", ""),
                                        });
                                        setIsWalkInHealthModalOpen(true);
                                      }}
                                      className="p-2 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-xl transition-all tooltip tooltip-top flex items-center justify-center shrink-0"
                                      data-tip="Action: Health Check"
                                    >
                                      <HeartPulse
                                        size={14}
                                        className="stroke-[2.5]"
                                      />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedHistoryId(animal.rawId);
                                        setIsHistoryModalOpen(true);
                                      }}
                                      className="p-2 text-blue-500 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500 hover:text-white rounded-xl transition-all tooltip tooltip-left flex items-center justify-center shrink-0"
                                      data-tip="View History"
                                    >
                                      <FileText
                                        size={14}
                                        className="stroke-[2.5]"
                                      />
                                    </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {/* PAGINATION CONTROLS */}
                        {totalPages > 1 && (
                          <tr>
                            <td
                              colSpan="5"
                              className="p-4 border-t border-base-300 bg-base-200/30"
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-[10px] font-black text-base-content/20 uppercase tracking-widest ml-2">
                                  Page {currentPage} of {totalPages}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      setCurrentPage((prev) =>
                                        Math.max(1, prev - 1),
                                      )
                                    }
                                    disabled={currentPage === 1}
                                    className="w-10 h-10 flex items-center justify-center border border-base-300 rounded-xl text-base-content/20 hover:border-blue-600 hover:text-blue-600 transition-all disabled:opacity-20 disabled:pointer-events-none bg-base-100 shadow-sm"
                                  >
                                    <ChevronRight
                                      className="rotate-180"
                                      size={16}
                                    />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setCurrentPage((prev) =>
                                        Math.min(totalPages, prev + 1),
                                      )
                                    }
                                    disabled={currentPage === totalPages}
                                    className="w-10 h-10 flex items-center justify-center border border-base-300 rounded-xl text-base-content/20 hover:border-blue-600 hover:text-blue-600 transition-all disabled:opacity-20 disabled:pointer-events-none bg-base-100 shadow-sm"
                                  >
                                    <ChevronRight size={16} />
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SIDEBAR AREA (Right Corner) */}
        <div className="lg:col-span-4 space-y-6">
          {/* TODAY'S AGENDA */}
          <div className="bg-base-100 rounded-xl shadow-xl overflow-hidden border border-base-300">
            <div className="p-6 border-b border-base-300 flex justify-between items-center bg-base-200/50">
              <div>
                <h2 className="text-base-content text-lg font-black flex items-center gap-2">
                  <Clock size={20} className="text-blue-500" /> Today's Schedule
                </h2>
                <p className="text-[10px] text-base-content/40 font-black uppercase mt-1">
                  Confirmed appointments
                </p>
              </div>
              <button
                onClick={handleOptimizeRoute}
                className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95"
              >
                MAP ROUTE
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-base-200/50 border border-base-300 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between">
                        <div className="skeleton h-4 w-16 bg-base-300/50"></div>
                        <div className="skeleton h-2 w-2 rounded-full bg-base-300/50"></div>
                      </div>
                      <div className="skeleton h-5 w-2/3 bg-base-300/50"></div>
                      <div className="skeleton h-3 w-1/2 bg-base-300/50"></div>
                    </div>
                  ))}
                </div>
              ) : agendaItems.length === 0 ? (
                <div className="py-12 text-center text-base-content/20 text-[10px] font-black uppercase tracking-widest">
                  No tasks scheduled for today.
                </div>
              ) : (
                agendaItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-base-200/50 border border-base-300 rounded-xl p-4 group hover:bg-base-200 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-blue-500 text-xs font-black">
                        {item.time}
                      </span>
                      <div
                        className={`w-2 h-2 rounded-full ${item.urgent ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" : "bg-emerald-500"}`}
                      ></div>
                    </div>
                    <h4 className="text-[14px] font-black text-base-content leading-tight">
                      {item.task}
                    </h4>
                    <p className="text-[11px] text-base-content/40 font-bold mt-1 line-clamp-1 uppercase tracking-tighter">
                      {item.farmer} · {item.location}
                    </p>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(item);
                          setIsTaskModalOpen(true);
                        }}
                        className="flex-1 bg-base-300/50 hover:bg-base-300 text-base-content text-[11px] font-black uppercase tracking-widest py-2 rounded-lg transition-all"
                      >
                        Details
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(item);
                          setIsTaskModalOpen(true);
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest py-2 rounded-lg transition-all shadow-lg shadow-blue-600/10"
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
          <div className="bg-[#074033] rounded-4xl shadow-2xl p-8 relative overflow-hidden group">
            {/* Background Accent */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-700" />

            <div className="flex justify-between items-center mb-8 relative z-10">
              <div>
                <h2 className="text-white text-xl font-black tracking-tight">
                  Quick Actions
                </h2>
                <p className="text-[10px] text-white/50 font-black uppercase tracking-widest mt-1">
                  Field Command Hub
                </p>
              </div>
              <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/5">
                <span
                  className={`text-[9px] font-black uppercase tracking-tighter ${config?.isHoliday ? "text-rose-400" : "text-emerald-400"}`}
                >
                  {config?.isHoliday ? "Holiday" : "Office Open"}
                </span>
                <button
                  onClick={() =>
                    toggleHolidayMutation.mutate(!config?.isHoliday)
                  }
                  disabled={toggleHolidayMutation.isPending}
                  className={`w-7 h-4 rounded-full relative transition-colors duration-200 ${config?.isHoliday ? "bg-rose-500" : "bg-white/20"}`}
                >
                  <div
                    className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-200 ${config?.isHoliday ? "left-3.5" : "left-0.5"}`}
                  />
                </button>
              </div>
            </div>

            <div className="space-y-3 relative z-10">
              {[
                {
                  label: "Register Farmer",
                  sub: "New client profile",
                  icon: <Users size={20} />,
                  color:
                    "text-purple-400 bg-purple-400/10 border-purple-400/20",
                  action: () => setIsRegisterFarmerModalOpen(true),
                },
                {
                  label: "Walk-In AI",
                  sub: "New breeding record",
                  icon: <Syringe size={20} />,
                  color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
                  action: () => setIsWalkInAIModalOpen(true),
                },
                {
                  label: "Walk-In Health",
                  sub: "Medical treatment",
                  icon: <HeartPulse size={20} />,
                  color:
                    "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
                  action: () => setIsWalkInHealthModalOpen(true),
                },
                {
                  label: "Register Animal",
                  sub: "Add tag to system",
                  icon: <Plus size={20} />,
                  color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
                  action: () => setIsRegisterModalOpen(true),
                },
              ].map((act, i) => (
                <button
                  key={i}
                  onClick={act.action}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl flex items-center gap-4 transition-all active:scale-[0.98] group/btn"
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center border ${act.color} group-hover/btn:scale-110 transition-transform`}
                  >
                    {act.icon}
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-black text-white">
                      {act.label}
                    </h4>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">
                      {act.sub}
                    </p>
                  </div>
                  <ChevronRight
                    size={14}
                    className="ml-auto text-white/20 group-hover/btn:text-white transition-colors"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* MISSION ACTIVITY FEED */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base-content text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <FileText size={16} className="text-blue-500" /> Recent Activity
              </h2>
              <Link
                to="/technician/inseminations"
                className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-widest"
              >
                View All
              </Link>
            </div>

            <div className="space-y-6">
              {[
                {
                  title: "New Farmer Registered",
                  sub: "Farmer: Benedicto Jaro",
                  time: "12m ago",
                  icon: <Users size={14} />,
                  color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
                },
                {
                  title: "Insemination Complete",
                  sub: "Asset: #28/1042 · Brahman",
                  time: "1h ago",
                  icon: <Syringe size={14} />,
                  color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
                },
                {
                  title: "Health Record Logged",
                  sub: "Asset: #28/1090 · Swine",
                  time: "3h ago",
                  icon: <HeartPulse size={14} />,
                  color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
                },
                {
                  title: "New Asset Enrolled",
                  sub: "Tag: #28/1105 · Cattle",
                  time: "Yesterday",
                  icon: <Plus size={14} />,
                  color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
                },
              ].map((log, i) => (
                <div key={i} className="flex gap-4 group cursor-default">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-base-300 ${log.color} group-hover:scale-110 transition-transform`}
                  >
                    {log.icon}
                  </div>
                  <div className="flex-1 border-b border-base-300 pb-4 last:border-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <h4 className="text-[13px] font-black text-base-content leading-tight group-hover:text-blue-600 transition-colors">
                        {log.title}
                      </h4>
                      <span className="text-[10px] font-black text-base-content/20 whitespace-nowrap uppercase tracking-widest">
                        {log.time}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-base-content/40 uppercase tracking-tighter">
                      {log.sub}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full mt-6 bg-base-200 hover:bg-base-300 text-base-content/60 border border-base-300 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm">
              Download Daily Report
            </button>
          </div>
        </div>
      </div>

      <TaskActionModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        taskData={selectedTask}
        onSuccess={refreshFeed}
      />
      <WalkInAIModal
        isOpen={isWalkInAIModalOpen}
        onClose={() => setIsWalkInAIModalOpen(false)}
        onSuccess={refreshFeed}
      />
      <WalkInHealthModal
        isOpen={isWalkInHealthModalOpen}
        onClose={() => {
          setIsWalkInHealthModalOpen(false);
          setHealthPrefill(null);
        }}
        prefillData={healthPrefill}
      />
      <RegisterLivestockModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
      />
      <AnimalHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        animalId={selectedHistoryId}
      />
      <RegisterFarmerModal
        isOpen={isRegisterFarmerModalOpen}
        onClose={() => setIsRegisterFarmerModalOpen(false)}
      />
    </div>
  );
}
