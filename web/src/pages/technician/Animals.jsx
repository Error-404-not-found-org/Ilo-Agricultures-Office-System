import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
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
  History,
  MoreVertical,
  ArrowUpRight,
  AlertCircle,
  FileText,
  Database,
  Activity,
  User,
  Trash2,
  Loader2,
  Users,
  ChevronLeft,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Skeleton, {
  CardSkeleton,
  TableRowSkeleton,
} from "../../components/Skeleton";
import AnimalHistoryModal from "../../components/modals/AnimalHistoryModal";
import RegisterLivestockModal from "../../components/modals/RegisterLivestockModal";

const TechnicianAnimals = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState([]);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // grid | list
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSpecies, setFilterSpecies] = useState("All");
  const queryClient = useQueryClient();

  // Modal States
  const [selectedAnimalId, setSelectedAnimalId] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [animalToDelete, setAnimalToDelete] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

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

  // DELETE
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axiosInstance.delete(`/technician/animals/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Animal record deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["animals"] });
    },
    onError: (error) => {
      toast.error(
        "Failed to delete record: " +
          (error.response?.data?.message || error.message),
      );
    },
  });

  const handleDelete = () => {
    if (animalToDelete) {
      deleteMutation.mutate(animalToDelete._id);
      setAnimalToDelete(null);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSelectAll = (currentAnimals) => {
    if (selectedIds.length === currentAnimals.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentAnimals.map((a) => a._id));
    }
  };

  const handleDeleteSelected = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedIds.length} records?`,
      )
    )
      return;

    try {
      await Promise.all(
        selectedIds.map((id) =>
          axiosInstance.delete(`/technician/animals/${id}`),
        ),
      );
      toast.success("Assets removed from registry");
      queryClient.invalidateQueries({ queryKey: ["animals"] });
      setSelectedIds([]);
    } catch (error) {
      toast.error("Failed to remove some records");
    }
  };

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
        filterSpecies === "All" ||
        (filterSpecies === "Beef" && animal.species === "Beef Cattle") ||
        (filterSpecies === "Dairy" && animal.species === "Dairy Cattle") ||
        animal.species === filterSpecies;

      return matchesSearch && matchesSpecies;
    });
  }, [animals, searchQuery, filterSpecies]);

  // Calculate Pagination
  const totalPages = Math.ceil(filteredAnimals.length / itemsPerPage);
  const paginatedAnimals = filteredAnimals.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const stats = useMemo(() => {
    return {
      total: animals.length,
      beef: animals.filter((a) => a.species === "Beef Cattle").length,
      dairy: animals.filter((a) => a.species === "Dairy Cattle").length,
      carabao: animals.filter((a) => a.species === "Carabao").length,
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
          {[...Array(8)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
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
    <div className="animate-fade-in space-y-6 pb-24">
      {/* PAGE HEADER */}
      <div className="card bg-base-100 border border-base-300 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-linear-to-r from-[#074033] to-emerald-800 px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                <Database size={14} className="text-emerald-300" />
              </div>
              <span className="text-emerald-300 text-[10px] font-black uppercase tracking-[0.3em]">
                Livestock Registry
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">
              Municipal Livestock Assets
            </h1>
            <p className="text-emerald-200/70 text-xs mt-0.5 font-medium">
              Real-time synchronization of municipal herd inventory
            </p>
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-black/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/5 flex gap-8">
              <div>
                <p className="text-[9px] font-black text-emerald-300/40 uppercase tracking-widest mb-0.5">
                  Beef Assets
                </p>
                <p className="text-xl font-black text-white leading-none">
                  {stats.beef}
                </p>
              </div>
              <div className="w-px h-8 bg-white/10 hidden md:block" />
              <div>
                <p className="text-[9px] font-black text-emerald-300/40 uppercase tracking-widest mb-0.5">
                  Dairy Assets
                </p>
                <p className="text-xl font-black text-white leading-none">
                  {stats.dairy}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="btn btn-neutral bg-emerald-500 hover:bg-emerald-600 border-none h-14 px-6 rounded-2xl text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-900/20"
            >
              <Plus size={18} className="mr-2" /> Register Asset
            </button>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="join border border-base-300 rounded-xl overflow-hidden shrink-0">
          {["All", "Beef", "Dairy", "Carabao"].map((species) => (
            <button
              key={species}
              onClick={() => setFilterSpecies(species)}
              className={`join-item btn btn-sm px-6 ${filterSpecies === species ? "btn-neutral" : "bg-base-100 border-none text-base-content/60"}`}
            >
              {species.toUpperCase()}
            </button>
          ))}
        </div>

        <label className="input input-sm bg-base-100 border-base-300 flex items-center gap-2 grow rounded-xl h-9 shadow-sm">
          <Search size={14} className="text-base-content/40" />
          <input
            type="text"
            placeholder="Search by Ear Tag or Owner..."
            className="grow text-xs font-bold"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-base-content/40 hover:text-error transition-colors"
            >
              ✕
            </button>
          )}
        </label>

        <div className="join border border-base-300 rounded-xl overflow-hidden shadow-sm shrink-0">
          <button
            onClick={() => setViewMode("list")}
            className={`join-item btn btn-sm px-4 ${viewMode === "list" ? "btn-neutral" : "bg-base-100 border-none"}`}
          >
            <ListIcon size={14} />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`join-item btn btn-sm px-4 ${viewMode === "grid" ? "btn-neutral" : "bg-base-100 border-none"}`}
          >
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {!filteredAnimals || filteredAnimals.length === 0 ? (
        <div className="text-center py-20 bg-base-100 rounded-3xl border border-dashed border-base-300">
          <Database
            size={40}
            strokeWidth={1}
            className="mx-auto mb-3 text-base-content/20"
          />
          <p className="text-xs font-black uppercase tracking-widest text-base-content/30">
            Inventory Empty
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {paginatedAnimals.map((animal) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              key={animal._id}
              className={`card bg-base-100 border transition-all duration-500 cursor-pointer group relative overflow-hidden ${selectedIds.includes(animal._id) ? "border-emerald-500 shadow-xl shadow-emerald-500/10" : "border-base-300 shadow-sm hover:shadow-xl hover:border-emerald-500/30"}`}
              onClick={() => navigate(`/technician/animals/${animal._id}`)}
            >
              {selectedIds.includes(animal._id) && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full animate-in fade-in zoom-in duration-500" />
              )}
              <div
                className="absolute top-4 left-4 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs rounded-md border-white/40 checked:bg-white checked:text-[#074033] opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity"
                  checked={selectedIds.includes(animal._id)}
                  onChange={() => handleToggleSelect(animal._id)}
                />
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-base-200 border border-base-300 flex items-center justify-center font-black text-lg text-base-content/20 overflow-hidden shrink-0">
                    {animal.imageUrl ? (
                      <img
                        src={animal.imageUrl.replace(
                          "/upload/",
                          "/upload/f_auto,q_auto,w_200,c_fill/",
                        )}
                        alt={animal.earTag}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      animal.earTag?.charAt(0)
                    )}
                  </div>
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/10">
                    {animal.species}
                  </span>
                </div>
                <h3 className="font-black text-sm text-base-content truncate">
                  #{animal.earTag}
                </h3>
                <div className="flex items-center justify-between mb-4 mt-1">
                  <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider flex items-center gap-1">
                    <User size={10} /> {animal.farmerId?.name || "Unknown"}
                  </p>
                  <span className="text-[9px] font-bold text-base-content/40">
                    {animal.breed || "Standard"}
                  </span>
                </div>
                <div
                  className="flex justify-end gap-1 pt-2 border-t border-base-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setSelectedAnimalId(animal._id);
                      setIsHistoryOpen(true);
                    }}
                    className="btn btn-ghost btn-xs btn-square text-emerald-600 hover:bg-emerald-600/10"
                  >
                    <History size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setAnimalToDelete(animal);
                    }}
                    className="btn btn-ghost btn-xs btn-square text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 size={14} />
                  </button>
                  <Link
                    to={`/technician/animals/${animal._id}`}
                    className="btn btn-ghost btn-xs btn-square text-neutral hover:bg-neutral/10"
                  >
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm rounded-2xl overflow-visible">
          <div className="overflow-x-auto min-h-[450px]">
            <table className="table table-zebra table-sm w-full">
              <thead>
                <tr className="bg-base-200/80 text-base-content/60">
                  <th className="w-12 pl-8">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs rounded-md border-base-400 checked:bg-[#074033] checked:text-white"
                      checked={
                        selectedIds.length === paginatedAnimals.length &&
                        paginatedAnimals.length > 0
                      }
                      onChange={() => handleSelectAll(paginatedAnimals)}
                    />
                  </th>
                  <th className="font-bold uppercase text-[10px] tracking-wider py-4">
                    Asset Identity
                  </th>
                  <th className="font-bold uppercase text-[10px] tracking-wider">
                    Ownership
                  </th>
                  <th className="font-bold uppercase text-[10px] tracking-wider">
                    Genetics
                  </th>
                  <th className="font-bold uppercase text-[10px] tracking-wider text-center">
                    Status
                  </th>
                  <th className="font-bold uppercase text-[10px] tracking-wider text-right pr-6">
                    Audit
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[...Array(6)].map((_, j) => (
                        <td key={j}>
                          <div className="h-4 bg-base-300 rounded w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginatedAnimals.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-20 text-center text-base-content/30"
                    >
                      <Database
                        size={40}
                        strokeWidth={1}
                        className="mx-auto mb-3"
                      />
                      <p className="text-xs font-black uppercase tracking-widest">
                        Registry Empty
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedAnimals.map((animal) => (
                    <tr
                      key={animal._id}
                      className={`hover group transition-all duration-300 cursor-pointer relative ${selectedIds.includes(animal._id) ? "bg-emerald-500/3 border-l-4 border-emerald-500" : "border-l-4 border-transparent"}`}
                      onClick={() =>
                        navigate(`/technician/animals/${animal._id}`)
                      }
                    >
                      <td className="pl-8" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs rounded-md border-base-400 checked:bg-[#074033] checked:text-white"
                          checked={selectedIds.includes(animal._id)}
                          onChange={() => handleToggleSelect(animal._id)}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar">
                            <div className="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center font-black text-xs text-base-content/30 border border-base-300">
                              {animal.imageUrl ? (
                                <img
                                  src={animal.imageUrl.replace(
                                    "/upload/",
                                    "/upload/f_auto,q_auto,w_100,c_fill/",
                                  )}
                                  alt={animal.earTag}
                                />
                              ) : (
                                animal.earTag?.charAt(0)
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="font-black text-xs leading-tight">
                              #{animal.earTag}
                            </p>
                            <p className="text-[9px] text-base-content/40 font-bold uppercase tracking-wider mt-0.5">
                              {animal.species}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="text-xs font-bold leading-tight">
                          {animal.farmerId?.name || "Unknown"}
                        </p>
                        <p className="text-[10px] text-base-content/40 font-medium">
                          {animal.farmerId?.phoneNumber || "No contact"}
                        </p>
                      </td>
                      <td>
                        <p className="text-xs font-bold leading-tight">
                          {animal.breed || "Standard"}
                        </p>
                        <p className="text-[10px] text-base-content/40 font-medium">
                          {animal.color || "Default"}
                        </p>
                      </td>
                      <td className="text-center">
                        <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                          <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                          {animal.reproductiveStatus || "Healthy"}
                        </span>
                      </td>
                      <td
                        className="text-right pr-6"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedAnimalId(animal._id);
                              setIsHistoryOpen(true);
                            }}
                            className="btn btn-ghost btn-xs btn-square text-emerald-600 hover:bg-emerald-600/10"
                          >
                            <History size={15} />
                          </button>
                          <button
                            onClick={() => setAnimalToDelete(animal)}
                            className="btn btn-ghost btn-xs btn-square text-rose-500 hover:bg-rose-500/10"
                          >
                            <Trash2 size={15} />
                          </button>
                          <Link
                            to={`/technician/animals/${animal._id}`}
                            className="btn btn-ghost btn-xs btn-square text-neutral hover:bg-neutral/10"
                          >
                            <ArrowUpRight size={15} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-6 py-4 bg-base-200/40 border border-base-300 rounded-2xl">
          <span className="text-xs text-base-content/50">
            Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong>—
            <strong>
              {Math.min(currentPage * itemsPerPage, filteredAnimals.length)}
            </strong>{" "}
            of <strong>{filteredAnimals.length}</strong>
          </span>
          <div className="join">
            <button
              className="join-item btn btn-sm btn-ghost"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            {[...Array(Math.min(5, totalPages))].map((_, i) => (
              <button
                key={i}
                className={`join-item btn btn-sm ${currentPage === i + 1 ? "btn-neutral" : "btn-ghost"}`}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <button
              className="join-item btn btn-sm btn-ghost"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      <RegisterLivestockModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["animals"] })
        }
      />

      <AnimalHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        animalId={selectedAnimalId}
      />

      {/* DELETE CONFIRMATION DIALOG */}
      <AnimatePresence>
        {animalToDelete && (
          <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAnimalToDelete(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-base-100 rounded-[32px] overflow-hidden shadow-2xl border border-base-300 p-8 text-center"
            >
              <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center text-rose-500 mx-auto mb-6">
                <AlertCircle size={40} />
              </div>
              <h2 className="text-2xl font-black text-base-content uppercase tracking-tight mb-2">
                Delete Record?
              </h2>
              <p className="text-sm text-base-content/60 font-medium mb-8 leading-relaxed">
                Are you sure you want to permanently delete animal{" "}
                <span className="text-base-content font-bold">
                  #{animalToDelete.earTag}
                </span>
                ? This action will also erase all associated insemination and
                health history.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="w-full h-14 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Confirm Deletion"
                  )}
                </button>
                <button
                  onClick={() => setAnimalToDelete(null)}
                  className="w-full h-12 text-base-content/30 font-black text-[9px] uppercase tracking-widest hover:text-base-content transition-colors"
                >
                  Keep Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING BULK ACTIONS */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 100, opacity: 0, x: "-50%" }}
            className="fixed bottom-8 left-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/5 flex items-center gap-6 min-w-[340px] backdrop-blur-xl ring-1 ring-white/10"
          >
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-emerald-500">
                Asset Protocol
              </span>
              <span className="text-xs font-black uppercase tracking-tight flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                {selectedIds.length} Assets Selected
              </span>
            </div>

            <div className="h-6 w-px bg-white/10" />

            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedIds([])}
                className="cursor-pointer text-white/40 hover:text-white text-[9px] font-black uppercase tracking-widest transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleDeleteSelected}
                className="bg-rose-500 cursor-pointer hover:bg-rose-600 text-white h-9 px-5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 transition-all active:scale-95 flex items-center"
              >
                <Trash2 size={12} className="mr-1.5" /> Delete All
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TechnicianAnimals;
