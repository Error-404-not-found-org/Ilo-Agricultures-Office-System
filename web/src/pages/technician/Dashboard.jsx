import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartPulse,
  Syringe,
  Clock,
  CheckCircle2,
  AlertCircle,
  Printer,
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
  History,
  TrendingUp,
  User,
  Activity,
  Calendar,
  CalendarDays,
  ShieldCheck,
  Calendar as CalendarIcon,
  Compass,
  ClipboardList,
  Zap,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import Skeleton, { TableRowSkeleton } from "../../components/Skeleton";
import TaskActionModal from "../../components/modals/TaskActionModal";
import WalkInAIModal from "../../components/modals/WalkInAIModal";
import WalkInHealthModal from "../../components/modals/WalkInHealthModal";
import RegisterLivestockModal from "../../components/modals/RegisterLivestockModal";
import AnimalHistoryModal from "../../components/modals/AnimalHistoryModal";
import RegisterFarmerModal from "../../components/modals/RegisterFarmerModal";
import DailyReportModal from "../../components/modals/DailyReportModal";
import { useToast } from "../../contexts/ToastContext";

const Dashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const {
    data: dashboardData = {},
    isLoading: loading,
    refetch: refreshFeed,
  } = useQuery({
    queryKey: ["technician", "dashboard"],
    queryFn: async () => {
      const response = await axiosInstance.get("/technician/dashboard-data");
      return response.data;
    },
    refetchInterval: 1000 * 30, // 30s
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["user", "activity"],
    queryFn: async () => {
      const response = await axiosInstance.get("/user/activity");
      return response.data;
    },
  });

  const {
    stats = {},
    pendingRequests = [],
    agendaItems = [],
    animalRegistry = [],
  } = dashboardData;

  const { data: config, refetch: refetchConfig } = useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const response = await axiosInstance.get("/config");
      return response.data;
    },
  });

  const { data: analytics = {} } = useQuery({
    queryKey: ["technician", "analytics"],
    queryFn: async () => {
      const response = await axiosInstance.get("/technician/analytics");
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
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isRegisterFarmerModalOpen, setIsRegisterFarmerModalOpen] =
    useState(false);
  const [isDailyReportModalOpen, setIsDailyReportModalOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [healthPrefill, setHealthPrefill] = useState(null);

  const itemsPerPage = 12;
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("All");
  const [agendaSearch, setAgendaSearch] = useState("");

  const filteredAgenda = React.useMemo(() => {
    return agendaItems.filter(
      (item) =>
        item.task?.toLowerCase().includes(agendaSearch.toLowerCase()) ||
        item.farmer?.toLowerCase().includes(agendaSearch.toLowerCase()),
    );
  }, [agendaItems, agendaSearch]);

  const [decliningItem, setDecliningItem] = useState(null);

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
      refreshFeed();
    } catch (err) {
      console.error("Failed to reject request", err);
      toast.error(err.response?.data?.message || "Failed to update status");
    } finally {
      setDecliningItem(null);
    }
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6 pb-12 px-2 sm:px-6 bg-base-200 min-h-screen pt-4">
      {/* HERO SECTION - REFINED MISSION HUB */}
      <div className="bg-[#074033] rounded-none p-10 text-white relative overflow-hidden shadow-2xl shadow-emerald-900/20 group border border-white/5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/10 transition-colors duration-700"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full -ml-20 -mb-20 blur-2xl"></div>

        <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Active Field Session
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-[0.9]">
              Moowie <span className="text-emerald-400">Field Support</span>
            </h1>
            <p className="text-emerald-100/60 font-bold text-sm max-w-md">
              Your intelligent companion for municipal breeding operations and
              veterinary diagnostics.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2 justify-center md:justify-start">
              <button
                onClick={() => setIsDailyReportModalOpen(true)}
                className="bg-white text-[#074033] px-6 py-3 rounded-none font-black text-[11px] uppercase tracking-widest hover:scale-105 transition-transform active:scale-95 shadow-xl shadow-black/20"
              >
                Generate Daily Report
              </button>
              <Link
                to="/technician/analytics"
                className="bg-emerald-500 text-white px-6 py-3 rounded-none font-black text-[11px] uppercase tracking-widest hover:bg-emerald-400 transition-colors active:scale-95 border border-white/10"
              >
                View Analytics
              </Link>
            </div>
          </div>
          <div className="shrink-0 relative">
            <div className="w-32 h-32 md:w-48 md:h-48 bg-linear-to-br from-emerald-400 to-teal-600 rounded-none flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-6 transition-transform duration-500 overflow-hidden border-4 border-white/20">
              <img
                src="https://res.cloudinary.com/donhulins/image/upload/v1778124094/moowie_hi_animals_section_xbocgj.png"
                alt="Moowie"
                className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-700"
              />
            </div>
            <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 backdrop-blur-xl rounded-none border border-white/20 flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform duration-500">
              <Activity size={24} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Today's Visits */}
        <div className="bg-base-100 rounded-none p-7 border border-base-300 shadow-sm relative group overflow-hidden transition-all hover:bg-base-200/50">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="text-4xl font-black text-base-content tracking-tighter">
                {loading ? (
                  <Skeleton className="h-10 w-16" />
                ) : (
                  (stats?.todayActivities ?? 0)
                )}
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30">
                Mission Count Today
              </p>
            </div>
            <div className="w-14 h-14 bg-emerald-500/5 border border-emerald-500/10 rounded-none flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform duration-500">
              <CalendarDays size={26} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/5 px-2.5 py-1.5 border border-emerald-500/10">
              {stats?.completedToday ?? 0} SECURED
            </span>
          </div>
        </div>

        {/* AI This Week */}
        <div className="bg-base-100 rounded-none p-7 border border-base-300 shadow-sm relative group overflow-hidden transition-all hover:bg-base-200/50">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="text-4xl font-black text-base-content tracking-tighter">
                {loading ? (
                  <Skeleton className="h-10 w-16" />
                ) : (
                  (analytics.totalAI_Week ?? 0)
                )}
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30">
                AI Service Cycle
              </p>
            </div>
            <div className="w-14 h-14 bg-amber-500/5 border border-amber-500/10 rounded-none flex items-center justify-center text-amber-600 shadow-sm group-hover:scale-110 transition-transform duration-500">
              <Zap size={26} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/5 px-2.5 py-1.5 border border-amber-500/10">
              Technical Records
            </span>
          </div>
        </div>

        {/* Health Hub (Monthly) */}
        <div className="bg-base-100 rounded-none p-7 border border-base-300 shadow-sm relative group overflow-hidden transition-all hover:bg-base-200/50">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="text-4xl font-black text-base-content tracking-tighter">
                {loading ? (
                  <Skeleton className="h-10 w-16" />
                ) : (
                  (analytics.totalHealth_Month ?? 0)
                )}
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30">
                Clinical Ledger
              </p>
            </div>
            <div className="w-14 h-14 bg-blue-500/5 border border-blue-500/10 rounded-none flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform duration-500">
              <HeartPulse size={26} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-500 bg-blue-500/5 px-2.5 py-1.5 border border-blue-500/10">
              Medical Actions
            </span>
          </div>
        </div>

        {/* Pending Requests */}
        <div className="bg-base-100 rounded-none p-7 border border-base-300 shadow-sm relative group overflow-hidden transition-all hover:bg-base-200/50">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="text-4xl font-black text-base-content tracking-tighter">
                {loading ? (
                  <Skeleton className="h-10 w-16" />
                ) : (
                  pendingRequests.filter(r => r.status === 'pending').length
                )}
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30">
                Pending Missions
              </p>
            </div>
            <div className="w-14 h-14 bg-indigo-500/5 border border-indigo-500/10 rounded-none flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform duration-500">
              <ClipboardList size={26} />
            </div>
          </div>
          {pendingRequests.filter((r) => r.status === 'pending' && r.urgent).length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/5 px-2.5 py-1.5 border border-rose-500/10 animate-pulse">
                {pendingRequests.filter((r) => r.status === 'pending' && r.urgent).length} URGENT ACTION
              </span>
            </div>
          )}
        </div>
      </div>

      {/* QUICK RECORD HUB - Image 2 Style */}
      <div className="bg-base-100 rounded-none p-8 border border-base-300 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
           <Zap size={20} className="text-emerald-500" />
           <h2 className="text-[10px] font-black text-base-content/40 uppercase tracking-[0.3em]">
             Action Console
           </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              label: "Field AI Log",
              sub: "Bull, batch, dose",
              icon: <Syringe size={22} />,
              color: "text-emerald-500 bg-emerald-500/5",
              action: () => setIsWalkInAIModalOpen(true),
            },
            {
              label: "Health Protocol",
              sub: "Symptoms / Rx",
              icon: <HeartPulse size={22} />,
              color: "text-emerald-500 bg-emerald-500/5",
              action: () => setIsWalkInHealthModalOpen(true),
            },
            {
              label: "Asset Registry",
              sub: "Add tag to system",
              icon: <Plus size={22} />,
              color: "text-emerald-500 bg-emerald-500/5",
              action: () => setIsRegisterModalOpen(true),
            },
            {
              label: "Farmer Registry",
              sub: "Municipal records",
              icon: <Users size={22} />,
              color: "text-emerald-500 bg-emerald-500/5",
              action: () => setIsRegisterFarmerModalOpen(true),
            },
          ].map((act, i) => (
            <button
              key={i}
              onClick={act.action}
              className="flex items-center gap-5 p-6 rounded-none border border-base-200 hover:bg-base-200/50 transition-all group text-left relative overflow-hidden"
            >
              <div
                className={`w-14 h-14 rounded-none flex items-center justify-center shrink-0 border border-emerald-500/10 ${act.color} group-hover:scale-110 transition-transform duration-500`}
              >
                {act.icon}
              </div>
              <div className="min-w-0">
                <h4 className="text-[13px] font-black text-base-content leading-tight uppercase tracking-tight">
                  {act.label}
                </h4>
                <p className="text-[9px] text-base-content/30 font-black mt-1 uppercase tracking-widest">
                  {act.sub}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* MAIN CONTENT AREA (8 COLUMNS) */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* FARMER REQUESTS - Image 1 Style */}
          <div
            id="requests"
            className="bg-base-100 rounded-none shadow-sm border border-base-300 overflow-hidden scroll-mt-24"
          >
            <div className="p-8 pb-6 flex justify-between items-center border-b border-base-200 bg-base-200/20">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-black text-base-content tracking-widest uppercase">
                  Operation Requests
                </h2>
                <span className="bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-none text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                  {pendingRequests.filter(r => r.status === 'pending').length} NEW MISSIONS
                </span>
              </div>
            </div>

            <div className="overflow-x-auto p-2">
              <table className="w-full text-left">
                <thead className="text-[10px] font-black text-base-content/20 uppercase tracking-[0.2em] px-8">
                  <tr>
                    <th className="px-8 py-6">Farmer</th>
                    <th className="px-6 py-6">Type</th>
                    <th className="px-6 py-6">Detail</th>
                    <th className="px-6 py-6">Urgency</th>
                    <th className="px-8 py-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-200 dark:divide-white/5">
                  {loading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan="5" className="px-8 py-6">
                          <div className="h-12 bg-base-200/50 rounded-md w-full" />
                        </td>
                      </tr>
                    ))
                  ) : pendingRequests.filter(r => r.status === 'pending').length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        className="py-24 text-center text-base-content/20 font-black uppercase tracking-widest text-xs"
                      >
                        No new requests
                      </td>
                    </tr>
                  ) : (
                    pendingRequests.filter(r => r.status === 'pending').map((item) => (
                      <tr
                        key={item.id}
                        className="group hover:bg-base-200/30 transition-all"
                      >
                        <td className="px-8 py-6">
                          <span className="text-md font-black text-base-content">
                            {item.farmer}
                          </span>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${item.type === "health" ? "bg-emerald-500" : "bg-blue-500"}`}
                            />
                            <span className="text-[11px] font-black text-base-content/60 uppercase tracking-tight">
                              {item.type === "health" ? "Vet" : "AI"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <span className="text-[13px] font-bold text-base-content/40 leading-relaxed max-w-xs block">
                            {item.task}
                          </span>
                        </td>
                        <td className="px-6 py-6">
                           <span
                             className={`px-3 py-1 rounded-none text-[8px] font-black uppercase tracking-widest
                             ${
                               item.urgent
                                 ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                                 : item.priority === "High"
                                   ? "bg-amber-100 text-amber-700 border border-amber-200"
                                   : "bg-emerald-50/50 text-emerald-700 border border-emerald-100"
                             }`}
                           >
                             {item.urgent ? "URGENT ACTION" : item.priority || "NORMAL"}
                           </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          {item.status === 'pending' ? (
                            <div className="flex justify-end gap-3">
                               <button
                                 onClick={() => {
                                   setSelectedTask(item);
                                   setIsTaskModalOpen(true);
                                 }}
                                 className="bg-[#074033] hover:bg-emerald-900 text-white px-5 py-2 rounded-none text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
                               >
                                 ACCEPT
                               </button>
                               <button
                                 onClick={() => {
                                   setSelectedTask(item);
                                   setIsTaskModalOpen(true);
                                 }}
                                 className="bg-transparent hover:bg-base-200 border border-base-300 text-base-content/40 px-5 py-2 rounded-none text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
                               >
                                 SCHEDULE
                               </button>
                            </div>
                          ) : (
                            <div className="flex justify-end items-center gap-2 text-emerald-600">
                              <CheckCircle2 size={14} />
                              <span className="text-[10px] font-black uppercase tracking-widest">Accepted</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MONTHLY PERFORMANCE SECTION */}
          <div id="performance" className="bg-base-100 rounded-none shadow-sm border border-base-300 p-10 flex-1 scroll-mt-24 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-none -mr-32 -mt-32 blur-3xl"></div>
             
             <div className="relative flex justify-between items-center mb-10">
                <div>
                   <h2 className="text-[10px] font-black text-base-content/40 tracking-[0.3em] uppercase">Tactical Performance</h2>
                   <p className="text-xl font-black text-base-content uppercase tracking-tighter mt-1">Efficiency Metrics</p>
                </div>
                <div className="flex items-center gap-2 bg-emerald-500/5 px-4 py-2 rounded-none border border-emerald-500/10">
                   <TrendingUp size={14} className="text-emerald-500" />
                   <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Active Operations</span>
                </div>
             </div>

             <div className="relative grid grid-cols-1 md:grid-cols-3 gap-12">
               {/* Metric 1: AI This Week */}
               <div className="space-y-6">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-base-content/30 uppercase tracking-widest">AI Weekly Yield</p>
                      <h3 className="text-2xl font-black text-base-content tracking-tighter">{analytics.totalAI_Week || 0} Missions</h3>
                    </div>
                    <div className="w-10 h-10 rounded-none bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center text-emerald-500">
                       <Zap size={16} />
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-base-200 rounded-none overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (analytics.totalAI_Week || 0) * 10)}%` }}
                      transition={{ duration: 1.5, ease: "circOut" }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                  <p className="text-[9px] font-bold text-base-content/20 uppercase tracking-tight">Active breeding tasks (7 days)</p>
               </div>

               {/* Metric 2: Health */}
               <div className="space-y-6">
                 <div className="flex justify-between items-end">
                   <div className="space-y-1">
                     <p className="text-[9px] font-black text-base-content/30 uppercase tracking-widest">Health Services</p>
                     <h3 className="text-2xl font-black text-base-content tracking-tighter">{analytics.totalHealth_Month || 0} Records</h3>
                   </div>
                   <div className="w-10 h-10 rounded-none bg-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-500">
                      <HeartPulse size={16} />
                   </div>
                 </div>
                 <div className="h-1.5 w-full bg-base-200 rounded-none overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${Math.min(100, (analytics.totalHealth_Month || 0) * 5)}%` }}
                     transition={{ duration: 1.5, ease: "circOut", delay: 0.2 }}
                     className="h-full bg-blue-500"
                   />
                 </div>
                 <p className="text-[9px] font-bold text-base-content/20 uppercase tracking-tight">Medical engagements this month</p>
               </div>

               {/* Metric 3: Total AI */}
               <div className="space-y-6">
                 <div className="flex justify-between items-end">
                   <div className="space-y-1">
                     <p className="text-[9px] font-black text-base-content/30 uppercase tracking-widest">Lifetime AI</p>
                     <h3 className="text-2xl font-black text-base-content tracking-tighter">{analytics.totalInsem || 0} Sessions</h3>
                   </div>
                   <div className="w-10 h-10 rounded-none bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <Syringe size={16} />
                   </div>
                 </div>
                 <div className="h-1.5 w-full bg-base-200 rounded-none overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${Math.min(100, (analytics.totalInsem || 0) * 2)}%` }}
                     transition={{ duration: 1.5, ease: "circOut", delay: 0.4 }}
                     className="h-full bg-indigo-500"
                   />
                 </div>
                 <p className="text-[9px] font-bold text-base-content/20 uppercase tracking-tight">Total breeding sessions recorded</p>
               </div>
             </div>
          </div>
        </div>

        {/* SIDEBAR AREA (4 COLUMNS) */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          {/* TODAY'S AGENDA */}
          <div
            id="schedule"
            className="bg-base-100 rounded-none shadow-sm border border-base-300 overflow-hidden scroll-mt-24"
          >
            <div className="p-8 pb-4 flex justify-between items-center">
              <h2 className="text-xl font-black text-base-content tracking-tight">
                Schedule
              </h2>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (agendaItems.length === 0) return;
                  const destination = encodeURIComponent(
                    agendaItems[agendaItems.length - 1].location,
                  );
                  const waypoints = agendaItems
                    .slice(0, -1)
                    .map((item) => encodeURIComponent(item.location))
                    .join("|");
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${destination}&waypoints=${waypoints}`,
                    "_blank",
                  );
                }}
                className="text-[10px] text-emerald-600 font-black flex items-center gap-1 uppercase tracking-widest hover:translate-x-1 transition-transform"
              >
                Map <ChevronRight size={14} />
              </button>
            </div>

            <div className="p-8 pt-4 space-y-4">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-20 bg-base-200/50 rounded-none animate-pulse"
                  />
                ))
              ) : filteredAgenda.length === 0 ? (
                <div className="py-12 text-center text-base-content/20 text-[10px] font-black uppercase tracking-widest">
                  No tasks today
                </div>
              ) : (
                filteredAgenda.map((item, idx) => (
                   <div
                    key={idx}
                    className="group flex items-center gap-4 p-4 rounded-none border border-base-200 hover:bg-emerald-500/5 transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedTask(item);
                      setIsTaskModalOpen(true);
                    }}
                  >
                    <div className="flex flex-col items-center min-w-[50px] border-r border-base-200 pr-4">
                      <span className="text-[10px] font-black text-base-content uppercase">
                        {item.time}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[11px] font-black text-base-content truncate uppercase tracking-tight">
                        {item.farmer}
                      </h4>
                      <p className="text-[9px] font-bold text-base-content/40 flex items-center gap-1 mt-0.5 uppercase">
                        <MapPin size={10} className="text-emerald-500" /> {item.location}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RECENT ACTIVITY FEED */}
          <div className="bg-base-100 rounded-none shadow-sm border border-base-300 p-8 flex-1 flex flex-col">
            <h2 className="text-base-content text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 mb-8">
              <Activity size={16} className="text-emerald-500" /> Mission Log
            </h2>
            <div className="space-y-8 flex-1">
              {activity.length > 0 ? (
                activity.slice(0, 5).map((log, i) => (
                  <div key={i} className="flex gap-4">
                    <div
                      className={`w-9 h-9 rounded-none flex items-center justify-center shrink-0 ${
                        log.type === 'ai' ? 'text-emerald-500 bg-emerald-500/10' :
                        log.type === 'health' ? 'text-blue-500 bg-blue-500/10' :
                        'text-purple-500 bg-purple-500/10'
                      } shadow-sm border border-base-200`}
                    >
                      {log.type === 'ai' ? <Syringe size={14} /> : 
                       log.type === 'health' ? <HeartPulse size={14} /> : 
                       <Users size={14} />}
                    </div>
                    <div className="flex-1 border-b border-base-200 pb-4 last:border-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <h4 className="text-[12px] font-black text-base-content leading-tight">
                          {log.title}
                        </h4>
                        <span className="text-[9px] font-black text-base-content/20 uppercase">
                          {new Date(log.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-tighter">
                        {log.description || "Activity logged"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-base-content/20 text-[10px] font-black uppercase tracking-widest">
                  No recent activity
                </div>
              )}
            </div>
            <button 
              onClick={() => navigate("/technician/ledger")}
              className="w-full mt-8 bg-base-200 hover:bg-base-300 text-base-content/40 border border-base-300 py-3.5 rounded-none font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Audit Field Ledger
            </button>
          </div>
        </div>
      </div>

      {/* MODALS */}
      <TaskActionModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        task={selectedTask}
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
        prefill={healthPrefill}
        onSuccess={refreshFeed}
      />
      <RegisterLivestockModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={refreshFeed}
      />
      <AnimalHistoryModal
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        animalId={selectedHistoryId}
      />
      <RegisterFarmerModal
        isOpen={isRegisterFarmerModalOpen}
        onClose={() => setIsRegisterFarmerModalOpen(false)}
        onSuccess={refreshFeed}
      />
      <DailyReportModal
        isOpen={isDailyReportModalOpen}
        onClose={() => setIsDailyReportModalOpen(false)}
        agendaItems={agendaItems}
        stats={stats}
      />
    </div>
  );
};

export default Dashboard;
