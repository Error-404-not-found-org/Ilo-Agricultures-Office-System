import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  Search,
  LayoutGrid,
  List as ListIcon,
  Filter,
  ChevronRight,
  HeartPulse,
  Syringe,
  MoreVertical,
  ArrowUpRight,
  AlertCircle,
  FileText,
  Database,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Skeleton, { CardSkeleton, TableRowSkeleton } from "../../components/Skeleton";

const TechnicianAnimals = () => {
  const toast = useToast();
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // grid | list
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSpecies, setFilterSpecies] = useState("All");

  const {
    data: animals = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["animals"],
    queryFn: async () => {
      const res = await axiosInstance.get("/animals/all");
      return res.data;
    },
  });

  // --- DERIVED STATS & FILTERING ---
  const filteredAnimals = useMemo(() => {
    return animals.filter((animal) => {
      const matchesSearch =
        (animal.earTag || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (animal.farmerId?.name || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesSpecies =
        filterSpecies === "All" || animal.species === filterSpecies;

      return matchesSearch && matchesSpecies;
    });
  }, [animals, searchQuery, filterSpecies]);

  const stats = useMemo(() => {
    return {
      total: animals.length,
      cattle: animals.filter((a) => a.species === "Cattle").length,
      swine: animals.filter((a) => a.species === "Swine").length,
      carabao: animals.filter((a) => a.species === "Carabao").length,
      goat: animals.filter((a) => a.species === "Goat").length,
    };
  }, [animals]);

  if (isLoading)
    return (
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-12 w-96" />
          </div>
          <Skeleton className="h-16 w-48 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-8 text-center">
          <AlertCircle className="mx-auto text-rose-500 mb-4" size={40} />
          <h2 className="text-xl font-black text-rose-900 mb-2">
            Registry Offline
          </h2>
          <p className="text-rose-600 font-medium text-sm">
            Error: {error.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto pb-20 bg-base-200 min-h-screen">
      {/* HEADER SECTION */}
      <div className="mb-10 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 pt-4">
        <div>
           <div className="flex items-center gap-3 mb-4">
            <span className="bg-[#074033] dark:bg-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-full tracking-widest uppercase shadow-lg shadow-[#074033]/20 text-center">
              Official Registry
            </span>
            <span className="text-base-content/30 text-[10px] font-black uppercase tracking-widest align-middle">
              · Updated Live
            </span>
          </div>
          <h1 className="text-5xl font-black text-base-content tracking-tighter uppercase leading-none mb-3">
             Livestock <span className="text-[#074033] dark:text-emerald-500">Assets</span>
          </h1>
          <p className="text-base-content/60 font-medium text-sm">
            Managing {stats.total} registered animals in the municipal database.
          </p>
        </div>

        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="h-16 px-8 rounded-2xl text-xs font-black uppercase tracking-widest bg-[#074033] dark:bg-emerald-600 text-white shadow-2xl shadow-[#074033]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 group"
        >
          <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-white/20 transition-colors">
            <Plus size={18} />
          </div>
          Register New Animal
        </button>
      </div>

      {/* METRIC DASHBOARD BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-base-100 p-6 rounded-3xl border border-base-300 shadow-sm transition-all hover:shadow-md group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
              <Database size={20} />
            </div>
            <span className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">
              Total
            </span>
          </div>
          <h3 className="text-3xl font-black text-base-content">{stats.total}</h3>
          <p className="text-[10px] font-bold text-base-content/40 uppercase mt-1">
            Heads Registered
          </p>
        </div>

        <div className="bg-base-100 p-6 rounded-3xl border border-base-300 shadow-sm transition-all hover:shadow-md group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
              <span className="font-bold text-lg">🐄</span>
            </div>
            <span className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">
              Cattle
            </span>
          </div>
          <h3 className="text-3xl font-black text-base-content">{stats.cattle}</h3>
          <p className="text-[10px] font-bold text-base-content/40 uppercase mt-1">
            Registered Cows
          </p>
        </div>

        <div className="bg-base-100 p-6 rounded-3xl border border-base-300 shadow-sm transition-all hover:shadow-md group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600 transition-colors group-hover:bg-amber-600 group-hover:text-white">
              <span className="font-bold text-lg">🐖</span>
            </div>
            <span className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">
              Swine
            </span>
          </div>
          <h3 className="text-3xl font-black text-base-content">{stats.swine}</h3>
          <p className="text-[10px] font-bold text-base-content/40 uppercase mt-1">
            Piggery Assets
          </p>
        </div>

        <div className="bg-base-100 p-6 rounded-3xl border border-base-300 shadow-sm transition-all hover:shadow-md group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white">
              <span className="font-bold text-lg">🐐</span>
            </div>
            <span className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">
              Others
            </span>
          </div>
          <h3 className="text-3xl font-black text-base-content">
            {stats.carabao + stats.goat}
          </h3>
          <p className="text-[10px] font-bold text-base-content/40 uppercase mt-1">
            Carabao & Goat
          </p>
        </div>
      </div>

      {/* ADVANCED TOOLBAR */}
      <div className="bg-base-100 rounded-3xl p-4 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between border border-base-300 shadow-inner">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
            />
            <input
              type="text"
              placeholder="Search by Ear Tag or Owner..."
              className="w-full bg-base-200 h-12 pl-12 pr-4 rounded-2xl text-sm font-bold border-none shadow-sm transition-all focus:ring-4 focus:ring-[#074033]/5 outline-none text-base-content placeholder:text-base-content/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="h-8 w-px bg-base-300 hidden md:block"></div>
          <div className="flex gap-1">
            {["All", "Cattle", "Swine", "Carabao", "Goat"].map((species) => (
              <button
                key={species}
                onClick={() => setFilterSpecies(species)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterSpecies === species
                    ? "bg-[#074033] dark:bg-emerald-600 text-white shadow-lg shadow-[#074033]/20"
                    : "text-base-content/40 hover:bg-base-200"
                }`}
              >
                {species}
              </button>
            ))}
          </div>
        </div>

        <div className="flex bg-base-100 p-1 rounded-2xl shadow-sm border border-base-300">
          <button
            onClick={() => setViewMode("grid")}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${viewMode === "grid" ? "bg-[#074033] dark:bg-emerald-600 text-white shadow-md" : "text-base-content/40 hover:bg-base-200"}`}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${viewMode === "list" ? "bg-[#074033] dark:bg-emerald-600 text-white shadow-md" : "text-base-content/40 hover:bg-base-200"}`}
          >
            <ListIcon size={18} />
          </button>
        </div>
      </div>

      {!filteredAnimals || filteredAnimals.length === 0 ? (
        <div className="text-center py-20 bg-base-100 rounded-[2.5rem] border border-dashed border-base-300">
          <div className="w-20 h-20 bg-base-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <Database size={32} className="text-base-content/20" />
          </div>
          <h3 className="text-xl font-black text-base-content mb-2 uppercase tracking-tight">
            No Matching Records
          </h3>
          <p className="text-base-content/40 font-medium text-sm">
            Adjust your filters or register a new asset.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAnimals.map((animal) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={animal._id}
              className="bg-base-100 rounded-4xl border border-base-300 shadow-[0_4px_25px_rgba(0,0,0,0.03)] overflow-hidden group hover:shadow-2xl transition-all hover:-translate-y-1 relative"
            >
              {/* Card Header Background */}
              <div className="absolute top-0 left-0 w-full h-24 bg-linear-to-br from-base-200 to-base-100 -z-10 group-hover:from-emerald-500/10 group-hover:to-base-100 transition-colors duration-500"></div>

              <div className="p-6 pb-2">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-16 h-16 rounded-3xl bg-base-100 shadow-lg p-0.5 border border-base-300 overflow-hidden relative">
                    {animal.imageUrl ? (
                      <img
                        src={animal.imageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_200,c_fill/')}
                        alt={animal.earTag}
                        className="w-full h-full object-cover rounded-3xl"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-black text-xl uppercase bg-[#074033]">
                        {animal.earTag?.substring(0, 2) || "AN"}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-base-100 flex items-center justify-center text-[10px] text-white font-black shadow-sm">
                      {animal.species === "Cattle"
                        ? "C"
                        : animal.species === "Swine"
                          ? "S"
                          : "O"}
                    </div>
                  </div>
                  <button className="p-2 text-base-content/20 hover:text-[#074033] dark:hover:text-emerald-500 hover:bg-base-200 rounded-xl transition-all">
                    <MoreVertical size={18} />
                  </button>
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                      {animal.breed || "Standard Breed"}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-base-300"></span>
                    <span className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">
                      {animal.species}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-base-content tracking-tighter mb-1">
                    #{animal.earTag}
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-base-content/40 line-clamp-1">
                      Owned by{" "}
                      <span className="text-base-content">
                        {animal.farmerId?.name || "Unknown"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-base-200 rounded-2xl p-3 border border-base-300">
                    <p className="text-[8px] font-black text-base-content/30 uppercase tracking-widest leading-none mb-1.5">
                      Last Check
                    </p>
                    <p className="text-[11px] font-bold text-base-content/80">
                      {animal.lastVisit || "No records"}
                    </p>
                  </div>
                  <div className="bg-[#074033]/5 dark:bg-emerald-500/10 rounded-2xl p-3 border border-[#074033]/10 dark:border-emerald-500/20">
                    <p className="text-[8px] font-black text-[#074033] dark:text-emerald-500 uppercase tracking-widest leading-none mb-1.5">
                      Status
                    </p>
                    <p className="text-[11px] font-black text-[#074033] dark:text-emerald-500 uppercase">
                      {animal.reproductiveStatus || "Healthy"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-2 bg-base-200 flex gap-1 border-t border-base-300">
                <Link
                  to={`/technician/animals/${animal._id}`}
                  className="flex-1 bg-base-100 hover:bg-[#074033] dark:hover:bg-emerald-600 hover:text-white text-base-content h-10 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm group/btn"
                >
                  View Asset
                  <ChevronRight
                    size={14}
                    className="group-hover/btn:translate-x-1 transition-transform"
                  />
                </Link>
                <button className="w-10 h-10 bg-base-100 hover:bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center transition-all shadow-sm border border-transparent hover:border-emerald-500/20">
                  <HeartPulse size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-base-100 rounded-4xl border border-base-300 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-base-content">
            <thead>
              <tr className="bg-base-200 border-b border-base-300">
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-base-content/30">
                  Livestock Identity
                </th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-base-content/30">
                  Ownership
                </th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-base-content/30">
                  Genetics
                </th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-base-content/30">
                  Current Status
                </th>
                <th className="py-5 px-6 text-right text-[10px] font-black uppercase tracking-widest text-base-content/30">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {filteredAnimals.map((animal) => (
                <tr
                  key={animal._id}
                  className="group hover:bg-base-200 transition-colors"
                >
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-base-200 rounded-xl overflow-hidden relative shrink-0 border border-base-300">
                        {animal.imageUrl ? (
                          <img
                            src={animal.imageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_100,c_fill/')}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-black text-xs uppercase bg-[#074033]">
                            {animal.earTag?.substring(0, 2) || "AN"}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-base-content tracking-tight">
                          #{animal.earTag}
                        </h4>
                        <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-0.5">
                          {animal.species}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <h4 className="text-sm font-bold text-base-content">
                      {animal.farmerId?.name || "Unknown"}
                    </h4>
                    <p className="text-[10px] text-base-content/40 font-bold mt-0.5 capitalize">
                      {animal.farmerId?.phoneNumber || "No contact"}
                    </p>
                  </td>
                  <td className="py-5 px-6">
                    <h4 className="text-sm font-bold text-base-content">
                      {animal.breed || "Crossbreed"}
                    </h4>
                    <p className="text-[10px] text-base-content/40 font-bold mt-0.5">
                      Color: {animal.color || "Standard"}
                    </p>
                  </td>
                  <td className="py-5 px-6">
                    <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                      <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                      Healthy
                    </span>
                  </td>
                  <td className="py-5 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/technician/animals/${animal._id}`}
                        className="w-10 h-10 bg-base-200 hover:bg-[#074033] dark:hover:bg-emerald-600 hover:text-white text-base-content/40 rounded-xl flex items-center justify-center transition-all"
                      >
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* REGISTRATION MODAL */}
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
                    Register <span className="text-emerald-500">Livestock</span>
                  </h2>
                  <p className="text-[10px] font-black text-base-content/30 uppercase tracking-widest mt-1">
                    Asset Enrollment Protocol
                  </p>
                </div>
                <button
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center text-base-content/20 hover:text-base-content hover:bg-base-200 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-base-content/30 uppercase tracking-widest block mb-2 pl-1">
                      Primary Owner
                    </label>
                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-5 top-1/2 -translate-y-1/2 text-base-content/20"
                      />
                      <input
                        type="text"
                        placeholder="Search farmer name..."
                        className="w-full h-14 bg-base-200 border-none rounded-2xl pl-12 pr-6 font-black text-sm text-base-content focus:ring-2 focus:ring-emerald-500 transition-all outline-none placeholder:text-base-content/10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-base-content/30 uppercase tracking-widest block mb-2 pl-1">
                        Ear Tag ID
                      </label>
                      <input
                        type="text"
                        placeholder="TAG-0000"
                        className="w-full h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm text-base-content focus:ring-2 focus:ring-emerald-500 transition-all outline-none placeholder:text-base-content/10"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-base-content/30 uppercase tracking-widest block mb-2 pl-1">
                        Genetic Species
                      </label>
                      <select className="w-full h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm text-base-content focus:ring-2 focus:ring-emerald-500 transition-all outline-none appearance-none">
                        <option>Cattle</option>
                        <option>Swine</option>
                        <option>Carabao</option>
                        <option>Goat</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-base-content/30 uppercase tracking-widest block mb-2 pl-1">
                        Breed Type
                      </label>
                      <input
                        type="text"
                        placeholder="e.g Brahman"
                        className="w-full h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm text-base-content focus:ring-2 focus:ring-emerald-500 transition-all outline-none placeholder:text-base-content/10"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-base-content/30 uppercase tracking-widest block mb-2 pl-1">
                        Coat / Markings
                      </label>
                      <input
                        type="text"
                        placeholder="Color description..."
                        className="w-full h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm text-base-content focus:ring-2 focus:ring-emerald-500 transition-all outline-none placeholder:text-base-content/10"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-8 flex flex-col gap-3 border-t border-base-300">
                  <button
                    onClick={() => {
                      toast.success(
                        "Livestock successfully added to registry!",
                      );
                      setIsRegisterModalOpen(false);
                    }}
                    className="w-full h-16 bg-[#074033] dark:bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-emerald-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                  >
                    Complete Registration
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    onClick={() => setIsRegisterModalOpen(false)}
                    className="w-full h-14 text-base-content/30 font-black text-[10px] uppercase tracking-widest hover:text-base-content transition-colors"
                  >
                    Cancel Transaction
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TechnicianAnimals;
