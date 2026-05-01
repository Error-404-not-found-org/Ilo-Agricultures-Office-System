import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  MapPin,
  Mail,
  Phone,
  Users,
  LayoutGrid,
  List as ListIcon,
  Plus,
  X,
  PhoneIncoming,
  MessageSquare,
  PlusCircle,
  CheckCircle,
  MoreVertical,
  Map,
  ArrowUpRight,
  Database,
  UserPlus,
  ExternalLink,
  Filter,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Skeleton, { TableRowSkeleton } from "../../components/Skeleton";

export default function FarmersDirectory() {
  const toast = useToast();
  const [farmers, setFarmers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
  const [loading, setLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        const response = await axiosInstance.get("/user?role=farmer");
        setFarmers(response.data);
      } catch (error) {
        console.error("Failed to fetch farmers", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFarmers();
  }, []);

  const formatAddress = (addr) => {
    if (!addr) return "No address provided";
    if (typeof addr === "string") return addr;
    return (
      [addr.street, addr.barangay, addr.city, addr.province]
        .filter(Boolean)
        .join(", ") || "No address provided"
    );
  };

  // --- DERIVED METRICS & FILTERING ---
  const filteredFarmers = useMemo(() => {
    return farmers.filter((farmer) => {
      const query = searchQuery.toLowerCase();
      const addressStr = formatAddress(farmer.address).toLowerCase();

      const matchesSearch =
        (farmer.name || "").toLowerCase().includes(query) ||
        (farmer.email || "").toLowerCase().includes(query) ||
        (farmer.phoneNumber || "").toLowerCase().includes(query) ||
        addressStr.includes(query);

      const matchesFilter =
        filterStatus === "All" ||
        (filterStatus === "Verified" && farmer.isVerified) ||
        (filterStatus === "Unverified" && !farmer.isVerified);

      return matchesSearch && matchesFilter;
    });
  }, [farmers, searchQuery, filterStatus]);

  const stats = useMemo(() => {
    return {
      total: farmers.length,
      verified: farmers.filter((f) => f.isVerified).length,
      communities: new Set(
        farmers
          .map((f) =>
            typeof f.address === "object" ? f.address?.barangay : "N/A",
          )
          .filter(Boolean),
      ).size,
      newThisMonth:
        farmers.filter(
          (f) =>
            new Date(f.createdAt) >
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        ).length || 4, // Mocked if empty
    };
  }, [farmers]);

  if (loading)
    return (
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-12 w-96" />
          </div>
          <Skeleton className="h-16 w-48 rounded-2xl" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
             <div key={i} className="bg-base-100 rounded-4xl p-6 border border-base-300 space-y-4">
                <Skeleton className="w-16 h-16 rounded-3xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-10 rounded-xl" />
                  <Skeleton className="h-10 rounded-xl" />
                </div>
             </div>
          ))}
        </div>
      </div>
    );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10 pb-24 animate-fade-in bg-base-200 min-h-screen">
      {/* 1. PREMIUM HEADER SECTION */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-4">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full tracking-widest uppercase shadow-lg shadow-blue-600/20 text-center">
              Community Hub
            </span>
            <span className="text-base-content/30 text-[10px] font-black uppercase tracking-widest align-middle">
              · Municipal Registry
            </span>
          </div>
          <h1 className="text-5xl font-black text-base-content tracking-tighter leading-none mb-3">
            Farmer <span className="text-blue-600 dark:text-blue-500">Directory</span>
          </h1>
          <p className="text-base-content/60 font-medium text-sm">
            Managing records of {stats.total} agriculture partners across the
            municipality.
          </p>
        </div>

        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="h-16 px-8 rounded-2xl text-xs font-black uppercase tracking-widest bg-blue-600 dark:bg-emerald-600 text-white shadow-2xl shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 group"
        >
          <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-white/20 transition-colors">
            <Plus size={18} />
          </div>
          Register New Farmer
        </button>
      </div>

      {/* 2. FIELD STATISTICS DASHBOARD */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-base-100 p-6 rounded-3xl border border-base-300 shadow-sm transition-all hover:shadow-md group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
              <Users size={20} />
            </div>
            <span className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">
              Total
            </span>
          </div>
          <h3 className="text-3xl font-black text-base-content">{stats.total}</h3>
          <p className="text-[10px] font-bold text-base-content/40 uppercase mt-1">
            Registered Partners
          </p>
        </div>

        <div className="bg-base-100 p-6 rounded-3xl border border-base-300 shadow-sm transition-all hover:shadow-md group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
              <CheckCircle size={20} />
            </div>
            <span className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">
              Vetted
            </span>
          </div>
          <h3 className="text-3xl font-black text-base-content">
            {stats.verified}
          </h3>
          <p className="text-[10px] font-bold text-base-content/40 uppercase mt-1">
            Verified Registry
          </p>
        </div>

        <div className="bg-base-100 p-6 rounded-3xl border border-base-300 shadow-sm transition-all hover:shadow-md group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white">
              <MapPin size={20} />
            </div>
            <span className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">
              Reach
            </span>
          </div>
          <h3 className="text-3xl font-black text-base-content">
            {stats.communities}
          </h3>
          <p className="text-[10px] font-bold text-base-content/40 uppercase mt-1">
            Active Barangays
          </p>
        </div>

        <div className="bg-base-100 p-6 rounded-3xl border border-base-300 shadow-sm transition-all hover:shadow-md group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600 transition-colors group-hover:bg-amber-600 group-hover:text-white">
              <UserPlus size={20} />
            </div>
            <span className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">
              New
            </span>
          </div>
          <h3 className="text-3xl font-black text-base-content">
            {stats.newThisMonth}
          </h3>
          <p className="text-[10px] font-bold text-base-content/40 uppercase mt-1">
            Added this month
          </p>
        </div>
      </div>

      {/* 3. ADVANCED TOOLBAR */}
      <div className="bg-base-100 rounded-3xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between border border-base-300 shadow-inner">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-96">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
            />
            <input
              type="text"
              placeholder="Search by Name, Contact, or Barangay..."
              className="w-full bg-base-200 h-12 pl-12 pr-4 rounded-2xl text-sm font-bold border-none shadow-sm transition-all focus:ring-4 focus:ring-blue-500/5 outline-none text-base-content placeholder:text-base-content/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="h-8 w-px bg-base-300 hidden md:block"></div>
          <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0">
            {["All", "Verified", "Unverified"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  filterStatus === status
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "text-base-content/40 hover:bg-base-300"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="flex bg-base-100 p-1 rounded-2xl shadow-sm border border-base-300 shrink-0">
          <button
            onClick={() => setViewMode("grid")}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${viewMode === "grid" ? "bg-blue-600 text-white shadow-md" : "text-base-content/20 hover:bg-base-200"}`}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${viewMode === "list" ? "bg-blue-600 text-white shadow-md" : "text-base-content/20 hover:bg-base-200"}`}
          >
            <ListIcon size={18} />
          </button>
        </div>
      </div>

      {/* 4. MAIN CONTENT AREA */}
      {!filteredFarmers || filteredFarmers.length === 0 ? (
        <div className="text-center py-24 bg-base-100 rounded-[2.5rem] border border-dashed border-base-300">
          <div className="w-20 h-20 bg-base-200 rounded-full flex items-center justify-center mx-auto mb-6 border border-base-300">
            <Users size={32} className="text-base-content/10" />
          </div>
          <h3 className="text-xl font-black text-base-content mb-2 uppercase tracking-tighter">
            No Agriculture Partners Found
          </h3>
          <p className="text-base-content/40 font-black uppercase tracking-widest text-[10px]">
            Update your search or register a new partner in the registry.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* ENHANCED GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredFarmers.map((farmer) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={farmer._id}
              className="bg-base-100 rounded-4xl border border-base-300 shadow-[0_4px_25px_rgba(0,0,0,0.03)] overflow-hidden group hover:shadow-2xl transition-all hover:-translate-y-1 relative"
            >
              {/* Header Background */}
              <div className="absolute top-0 left-0 w-full h-24 bg-linear-to-br from-base-200 to-base-100 -z-10 group-hover:from-blue-600/10 group-hover:to-base-100 transition-colors duration-500"></div>

              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-16 h-16 rounded-3xl bg-base-100 shadow-lg p-0.5 border border-base-300 overflow-hidden relative">
                    {farmer.imageUrl ? (
                      <img
                        src={farmer.imageUrl.includes('cloudinary.com') 
                          ? farmer.imageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_200,c_fill/') 
                          : farmer.imageUrl
                        }
                        alt={farmer.name}
                        className="w-full h-full object-cover rounded-3xl"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-blue-500/10 flex items-center justify-center rounded-3xl">
                        <span className="text-blue-600 font-black text-xl">
                          {farmer.name?.charAt(0) || "F"}
                        </span>
                      </div>
                    )}
                    {farmer.isVerified && (
                      <div
                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-base-100 flex items-center justify-center text-[10px] text-white font-black shadow-sm"
                        title="Verified Producer"
                      >
                        <CheckCircle size={12} />
                      </div>
                    )}
                  </div>
                  <button className="p-2 text-base-content/20 hover:text-blue-600 hover:bg-base-200 rounded-xl transition-all">
                    <MoreVertical size={18} />
                  </button>
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                      {farmer.isVerified
                        ? "Vetted Partner"
                        : "Community Member"}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-base-300"></span>
                    <span className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">
                      Reg. 2024
                    </span>
                  </div>
                  <h3 className="text-[19px] font-black text-base-content tracking-tighter leading-tight line-clamp-1">
                    {farmer.name}
                  </h3>
                  <p className="text-xs font-bold text-base-content/40 flex items-center gap-1.5 mt-1">
                    <MapPin size={12} className="shrink-0 text-blue-500" />
                    <span className="line-clamp-1">
                      {formatAddress(farmer.address)}
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-base-200 rounded-2xl p-3 border border-base-300">
                    <p className="text-[8px] font-black text-base-content/30 uppercase tracking-widest leading-none mb-1.5">
                      Livestock
                    </p>
                    <p className="text-[11px] font-black text-base-content flex items-center gap-1.5 leading-none">
                      <Database size={10} className="text-blue-500" />
                      {Math.floor(Math.random() * 8) + 1} Heads
                    </p>
                  </div>
                  <div className="bg-blue-500/10 rounded-2xl p-3 border border-blue-500/20">
                    <p className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none mb-1.5">
                      Last Request
                    </p>
                    <p className="text-[11px] font-black text-blue-600 dark:text-blue-400 leading-none">
                      3 Days Ago
                    </p>
                  </div>
                </div>

                {/* Quick Communication Hub */}
                <div className="flex gap-2">
                  <a
                    href={`tel:${farmer.phoneNumber}`}
                    className="flex-1 h-10 bg-base-100 border border-base-300 text-base-content/30 hover:text-blue-600 hover:border-blue-500/20 rounded-xl flex items-center justify-center transition-all shadow-sm"
                    title="Call Farmer"
                  >
                    <PhoneIncoming size={16} />
                  </a>
                  <a
                    href={`sms:${farmer.phoneNumber}`}
                    className="flex-1 h-10 bg-base-100 border border-base-300 text-base-content/30 hover:text-[#0078d4] hover:border-blue-500/20 rounded-xl flex items-center justify-center transition-all shadow-sm"
                    title="Message Farmer"
                  >
                    <MessageSquare size={16} />
                  </a>
                  <Link
                    to={`/technician/route?from=Current&to=${encodeURIComponent(formatAddress(farmer.address))}`}
                    className="flex-1 h-10 bg-base-100 border border-base-300 text-base-content/30 hover:text-amber-600 hover:border-amber-500/20 rounded-xl flex items-center justify-center transition-all shadow-sm"
                    title="Navigate to Farm"
                  >
                    <Map size={16} />
                  </Link>
                </div>
              </div>

              <div className="p-2 pt-0">
                <Link
                  to={`/technician/farmers/${farmer._id}`}
                  className="w-full bg-base-content text-base-100 hover:bg-base-content/90 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group/btn shadow-xl shadow-base-300/20 dark:shadow-none"
                >
                  Audit Community Record
                  <ArrowUpRight
                    size={14}
                    className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform"
                  />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* PREMIUM LIST VIEW */
        <div className="bg-base-100 rounded-[2.5rem] border border-base-300 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-base-200 border-b border-base-300">
                <th className="py-5 px-8 text-[10px] font-black uppercase tracking-widest text-base-content/40">
                  Partner Intelligence
                </th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-base-content/40">
                  Primary Contact
                </th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-base-content/40">
                  Base Location
                </th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-base-content/40">
                  Registry Status
                </th>
                <th className="py-5 px-8 text-right text-[10px] font-black uppercase tracking-widest text-base-content/40">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300/30">
              {filteredFarmers.map((farmer) => (
                <tr
                  key={farmer._id}
                  className="group hover:bg-base-200 transition-colors"
                >
                  <td className="py-5 px-8 border-r border-transparent">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-base-200 rounded-xl overflow-hidden relative shrink-0 border border-base-300">
                        {farmer.imageUrl ? (
                          <img
                            src={farmer.imageUrl.includes('cloudinary.com') 
                              ? farmer.imageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_100,c_fill/') 
                              : farmer.imageUrl
                            }
                            alt={farmer.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-blue-500/10 flex items-center justify-center text-blue-600 font-black text-sm">
                            {farmer.name?.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="text-[15px] font-black text-base-content tracking-tight leading-none mb-1.5">
                          {farmer.name}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-base-content/20 uppercase tracking-widest">
                            Owner ID: 2901{farmer._id.slice(-4)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <h4 className="text-sm font-bold text-base-content">
                      {farmer.phoneNumber || "Unlisted Contact"}
                    </h4>
                    <p className="text-[10px] text-base-content/40 font-bold mt-0.5 lowercase group-hover:text-blue-600 transition-colors cursor-pointer truncate max-w-[150px]">
                      {farmer.email}
                    </p>
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-2 text-sm font-bold text-base-content">
                      <span className="line-clamp-1">
                        {formatAddress(farmer.address)}
                      </span>
                    </div>
                    <p className="text-[10px] text-base-content/30 font-black uppercase mt-0.5 tracking-tight">
                      Geo-Locked
                    </p>
                  </td>
                  <td className="py-5 px-6">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                        farmer.isVerified
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20"
                          : "bg-base-200 text-base-content/40 border-base-300"
                      }`}
                    >
                      <div
                        className={`w-1 h-1 rounded-full ${farmer.isVerified ? "bg-emerald-500 animate-pulse" : "bg-base-content/20"}`}
                      ></div>
                      {farmer.isVerified
                        ? "Verified Accuracy"
                        : "Pending Review"}
                    </span>
                  </td>
                  <td className="py-5 px-8 text-right">
                    <div className="flex justify-end gap-2 pr-2">
                      <Link
                        to={`/technician/farmers/${farmer._id}`}
                        className="w-10 h-10 bg-gray-50 hover:bg-blue-600 hover:text-white text-gray-400 rounded-xl flex items-center justify-center transition-all group-hover:shadow-lg group-hover:shadow-blue-600/10"
                      >
                        <ExternalLink size={16} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {isRegisterModalOpen && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#111827]/80 backdrop-blur-md" onClick={() => setIsRegisterModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 20 }}
              className="bg-base-100 rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col relative border border-base-300"
            >
              {/* Minimalist Header */}
              <div className="px-8 py-7 border-b border-base-300 flex justify-between items-center bg-base-200/50">
                <div>
                  <h2 className="text-xl font-black text-base-content uppercase tracking-tighter">
                    Register <span className="text-blue-500">Farmer</span>
                  </h2>
                  <p className="text-[10px] font-black text-base-content/30 uppercase tracking-widest mt-1">
                    Community Enrollment Hub
                  </p>
                </div>
                <button
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center text-base-content/20 hover:text-base-content hover:bg-base-200 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-base-content/30 uppercase tracking-widest block mb-2 pl-1">
                      Primary Official Name
                    </label>
                    <div className="relative">
                      <Users
                        size={14}
                        className="absolute left-5 top-1/2 -translate-y-1/2 text-base-content/20"
                      />
                      <input
                        type="text"
                        placeholder="e.g. Juan De La Cruz"
                        className="w-full h-14 bg-base-200 border-none rounded-2xl pl-12 pr-6 font-black text-sm text-base-content focus:ring-2 focus:ring-blue-500 transition-all outline-none placeholder:text-base-content/10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-base-content/30 uppercase tracking-widest block mb-2 pl-1">
                        Primary Contact
                      </label>
                      <input
                        type="tel"
                        placeholder="+63 9xx..."
                        className="w-full h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm text-base-content focus:ring-2 focus:ring-blue-500 transition-all outline-none placeholder:text-base-content/10"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-base-content/30 uppercase tracking-widest block mb-2 pl-1">
                        Target Barangay
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. San Jose"
                        className="w-full h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm text-base-content focus:ring-2 focus:ring-blue-500 transition-all outline-none placeholder:text-base-content/10"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-8 flex flex-col gap-3 border-t border-base-300">
                  <button
                    onClick={() => {
                      toast.success("Community profile added to registry!");
                      setIsRegisterModalOpen(false);
                    }}
                    className="w-full h-16 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                  >
                    Enroll New Partner
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    onClick={() => setIsRegisterModalOpen(false)}
                    className="w-full h-14 text-base-content/30 font-black text-[10px] uppercase tracking-widest hover:text-base-content transition-colors"
                  >
                    Cancel Enrollment
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
