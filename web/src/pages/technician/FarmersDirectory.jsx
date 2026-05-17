import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  MapPin,
  Users,
  LayoutGrid,
  List as ListIcon,
  Plus,
  X,
  PhoneIncoming,
  CheckCircle,
  Database,
  ArrowUpRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Info,
  Settings,
  Edit2,
  Trash2,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Skeleton from "../../components/Skeleton";
import RegisterFarmerModal from "../../components/modals/RegisterFarmerModal";

export default function FarmersDirectory() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [viewMode, setViewMode] = useState("list");
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editData, setEditData] = useState({
    id: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    barangay: "",
    email: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Fetch Farmers
  const { data: farmers = [], isLoading: isFarmersLoading } = useQuery({
    queryKey: ["technician", "farmers"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=farmer");
      return res.data;
    },
  });

  // Fetch Animals to get real counts
  const { data: animals = [], isLoading: isAnimalsLoading } = useQuery({
    queryKey: ["animals"],
    queryFn: async () => {
      const res = await axiosInstance.get("/animals/all");
      return res.data;
    },
  });

  const loading = isFarmersLoading || isAnimalsLoading;

  // Map animal counts to farmers
  const farmerAnimalCounts = useMemo(() => {
    const counts = {};
    animals.forEach((animal) => {
      const fId =
        typeof animal.farmerId === "object"
          ? animal.farmerId?._id
          : animal.farmerId;
      if (fId) counts[fId] = (counts[fId] || 0) + 1;
    });
    return counts;
  }, [animals]);

  const formatAddress = (addr) => {
    if (!addr) return "N/A";
    if (typeof addr === "string") return addr;
    return addr.barangay || "N/A";
  };

  const handleToggleVerification = async (id) => {
    try {
      await axiosInstance.patch(`/technician/farmers/${id}/verify`);
      queryClient.invalidateQueries({ queryKey: ["technician", "farmers"] });
      toast.success("Verification status updated");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const openEditModal = (farmer) => {
    const nameParts = farmer.name?.split(" ") || ["", ""];
    setEditData({
      id: farmer._id,
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(1).join(" ") || "",
      phoneNumber: farmer.phoneNumber || "",
      barangay: farmer.address?.barangay || "",
      email: farmer.email || "",
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await axiosInstance.put(`/technician/farmers/${editData.id}`, {
        name: `${editData.firstName} ${editData.lastName}`,
        phoneNumber: editData.phoneNumber,
        address: {
          barangay: editData.barangay,
          city: "Iloilo",
          province: "Iloilo",
        },
        email: editData.email,
      });
      toast.success("Profile updated successfully");
      queryClient.invalidateQueries({ queryKey: ["technician", "farmers"] });
      setIsEditModalOpen(false);
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSelectAll = (currentFarmers) => {
    if (selectedIds.length === currentFarmers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentFarmers.map((f) => f._id));
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
        selectedIds.map((id) => axiosInstance.delete(`/user/${id}`)),
      );
      toast.success("Partners removed successfully");
      queryClient.invalidateQueries({ queryKey: ["technician", "farmers"] });
      setSelectedIds([]);
    } catch (error) {
      toast.error("Failed to remove some records");
    }
  };

  const filteredFarmers = useMemo(() => {
    return farmers.filter((farmer) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        (farmer.name || "").toLowerCase().includes(query) ||
        (farmer.phoneNumber || "").toLowerCase().includes(query) ||
        formatAddress(farmer.address).toLowerCase().includes(query);

      const matchesFilter =
        filterStatus === "All" ||
        (filterStatus === "Verified" && farmer.isVerified) ||
        (filterStatus === "Unverified" && !farmer.isVerified);

      return matchesSearch && matchesFilter;
    });
  }, [farmers, searchQuery, filterStatus]);

  const stats = useMemo(
    () => ({
      total: farmers.length,
      verified: farmers.filter((f) => f.isVerified).length,
      barangays: new Set(farmers.map((f) => formatAddress(f.address))).size,
    }),
    [farmers],
  );

  const totalPages = Math.ceil(filteredFarmers.length / itemsPerPage);
  const paginatedFarmers = filteredFarmers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div className="animate-fade-in space-y-6 pb-16">
      {/* PAGE HEADER */}
      <div className="card bg-base-100 border border-base-300 rounded-none shadow-sm overflow-hidden">
        <div className="bg-linear-to-r from-[#074033] to-emerald-800 px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                <Users size={14} className="text-emerald-300" />
              </div>
              <span className="text-emerald-300 text-[10px] font-black uppercase tracking-[0.3em]">
                Farmer Registry
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Farmer Registry Dashboard
            </h1>
            <p className="text-emerald-200/70 text-xs mt-0.5">
              Manage livestock owners and service delivery history
            </p>
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-black/10 backdrop-blur-md px-6 py-3 rounded-none border border-white/5 flex gap-8">
              <div>
                <p className="text-[9px] font-black text-emerald-300/40 uppercase tracking-widest mb-0.5">
                  Total Partners
                </p>
                <p className="text-xl font-black text-white leading-none">
                  {stats.total}
                </p>
              </div>
              <div className="w-px h-8 bg-white/10 hidden md:block" />
              <div>
                <p className="text-[9px] font-black text-emerald-300/40 uppercase tracking-widest mb-0.5">
                  Digital Partners
                </p>
                <p className="text-xl font-black text-white leading-none">
                  {stats.verified}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="btn btn-neutral bg-emerald-500 hover:bg-emerald-600 border-none h-14 px-6 rounded-none text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-950/20"
            >
              <Plus size={18} className="mr-2" /> Register Partner
            </button>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="join border border-base-300 rounded-none overflow-hidden shrink-0">
          {["All", "Verified", "Unverified"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`join-item btn btn-sm px-6 ${filterStatus === status ? "btn-neutral" : "bg-base-100 border-none text-base-content/60"}`}
            >
              {status.toUpperCase()}
            </button>
          ))}
        </div>

        <label className="input input-sm bg-base-100 border-base-300 flex items-center gap-2 grow rounded-none h-9 shadow-sm">
          <Search size={14} className="text-base-content/40" />
          <input
            type="text"
            placeholder="Search by name, contact or location..."
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

        <div className="join border border-base-300 rounded-none overflow-hidden shadow-sm shrink-0">
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

      {/* MAIN CONTENT */}
      {viewMode === "list" ? (
        /* HIGH-DENSITY LIST VIEW */
        <div className="card bg-base-100 border border-base-300 shadow-sm rounded-none overflow-visible">
          <div className="overflow-x-auto min-h-[450px]">
            <table className="table table-zebra table-sm w-full">
              <thead>
                <tr className="bg-base-200/80 text-base-content/60">
                  <th className="w-12 pl-8">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs rounded-md border-base-400 checked:bg-[#074033] checked:text-white"
                      checked={
                        selectedIds.length === paginatedFarmers.length &&
                        paginatedFarmers.length > 0
                      }
                      onChange={() => handleSelectAll(paginatedFarmers)}
                    />
                  </th>
                  <th className="font-bold uppercase text-[10px] tracking-wider py-4">
                    Partner Intelligence
                  </th>
                  <th className="font-bold uppercase text-[10px] tracking-wider">
                    Contact Detail
                  </th>
                  <th className="font-bold uppercase text-[10px] tracking-wider text-center">
                    Herd Size
                  </th>
                  <th className="font-bold uppercase text-[10px] tracking-wider">
                    Location
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
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[...Array(7)].map((_, j) => (
                        <td key={j}>
                          <div className="h-4 bg-base-300 rounded w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginatedFarmers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-20 text-center text-base-content/30"
                    >
                      <Users
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
                  paginatedFarmers.map((farmer) => (
                    <tr
                      key={farmer._id}
                      className={`hover group transition-all duration-300 cursor-pointer relative ${selectedIds.includes(farmer._id) ? "bg-emerald-500/3 border-l-4 border-emerald-500" : "border-l-4 border-transparent"}`}
                      onClick={() =>
                        navigate(`/technician/farmers/${farmer._id}`)
                      }
                    >
                      <td className="pl-8" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs rounded-md border-base-400 checked:bg-[#074033] checked:text-white"
                          checked={selectedIds.includes(farmer._id)}
                          onChange={() => handleToggleSelect(farmer._id)}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar">
                            <div className="w-10 h-10 rounded-none bg-base-200 flex items-center justify-center font-black text-xs text-base-content/30 border border-base-300">
                              {farmer.imageUrl ? (
                                <img
                                  src={farmer.imageUrl.replace(
                                    "/upload/",
                                    "/upload/f_auto,q_auto,w_100,c_fill/",
                                  )}
                                  alt={farmer.name}
                                />
                              ) : (
                                farmer.name?.charAt(0)
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="font-black text-xs leading-tight">
                              {farmer.name}
                            </p>
                            <p className="text-[9px] text-base-content/40 font-bold uppercase tracking-wider mt-0.5">
                              ID: {farmer._id.slice(-6).toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="text-xs font-bold leading-tight">
                          {farmer.phoneNumber || "--- --- ----"}
                        </p>
                        <p className="text-[10px] text-base-content/40 font-medium truncate max-w-[150px]">
                          {farmer.email || "No digital address"}
                        </p>
                      </td>
                      <td className="text-center">
                        <div className="badge badge-sm bg-base-200 border-base-300 text-base-content/60 font-black text-[9px] gap-1.5 h-6">
                          <Database size={10} className="text-emerald-500" />
                          {farmerAnimalCounts[farmer._id] || 0} Heads
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <MapPin size={12} className="text-emerald-600/50" />
                          <span className="text-[11px] font-bold text-base-content/60">
                            {formatAddress(farmer.address)}
                          </span>
                        </div>
                      </td>
                      <td className="text-center">
                        <div
                          className="tooltip"
                          data-tip={
                            farmer.isVerified
                              ? "Digital Account Active"
                              : "Click to verify account"
                          }
                        >
                          <button
                            onClick={() => handleToggleVerification(farmer._id)}
                            className={`badge badge-sm border font-black text-[9px] uppercase tracking-widest cursor-pointer ${
                              farmer.isVerified
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : "bg-base-200 text-base-content/30 border-base-300"
                            }`}
                          >
                            {farmer.isVerified
                              ? "Digital Partner"
                              : "Manual Record"}
                          </button>
                        </div>
                      </td>
                      <td
                        className="text-right pr-6"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1">
                          <div className="tooltip tooltip-left" data-tip="Call">
                            <a
                              href={`tel:${farmer.phoneNumber}`}
                              className="btn btn-ghost btn-xs btn-square text-info hover:bg-info/10"
                            >
                              <PhoneIncoming size={15} />
                            </a>
                          </div>
                          <div
                            className="tooltip tooltip-left"
                            data-tip="Update Profile"
                          >
                            <button
                              onClick={() => openEditModal(farmer)}
                              className="btn btn-ghost btn-xs btn-square text-warning hover:bg-warning/10"
                            >
                              <Settings size={15} />
                            </button>
                          </div>
                          <div
                            className="tooltip tooltip-left"
                            data-tip="View Data"
                          >
                            <Link
                              to={`/technician/farmers/${farmer._id}`}
                              className="btn btn-ghost btn-xs btn-square text-neutral hover:bg-neutral/10"
                            >
                              <ArrowUpRight size={15} />
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* COMPACT GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {paginatedFarmers.map((farmer) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              key={farmer._id}
              className={`card bg-base-100 border transition-all duration-500 cursor-pointer group relative overflow-hidden ${selectedIds.includes(farmer._id) ? "border-emerald-500 shadow-xl shadow-emerald-500/10" : "border-base-300 shadow-sm hover:shadow-xl hover:border-emerald-500/30"}`}
              onClick={() => navigate(`/technician/farmers/${farmer._id}`)}
            >
              {selectedIds.includes(farmer._id) && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full animate-in fade-in zoom-in duration-500" />
              )}
              <div
                className="absolute top-4 left-4 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs rounded-md border-white/40 checked:bg-white checked:text-[#074033] opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity"
                  checked={selectedIds.includes(farmer._id)}
                  onChange={() => handleToggleSelect(farmer._id)}
                />
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-none bg-base-200 border border-base-300 flex items-center justify-center font-black text-lg text-base-content/20 overflow-hidden shrink-0">
                    {farmer.imageUrl ? (
                      <img
                        src={farmer.imageUrl.replace(
                          "/upload/",
                          "/upload/f_auto,q_auto,w_200,c_fill/",
                        )}
                        alt={farmer.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      farmer.name?.charAt(0)
                    )}
                  </div>
                  {farmer.isVerified && (
                    <UserCheck size={16} className="text-emerald-500" />
                  )}
                </div>
                <h3 className="font-black text-sm text-base-content truncate">
                  {farmer.name}
                </h3>
                <div className="flex items-center justify-between mb-4 mt-1">
                  <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider flex items-center gap-1">
                    <MapPin size={10} /> {formatAddress(farmer.address)}
                  </p>
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter bg-emerald-500/10 px-2 py-0.5 rounded-none border border-emerald-500/10">
                    {farmerAnimalCounts[farmer._id] || 0} Assets
                  </span>
                </div>
                <div
                  className="flex justify-end gap-1 pt-2 border-t border-base-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="tooltip tooltip-top" data-tip="Call">
                    <a
                      href={`tel:${farmer.phoneNumber}`}
                      className="btn btn-ghost btn-xs btn-square text-info hover:bg-info/10"
                    >
                      <PhoneIncoming size={14} />
                    </a>
                  </div>
                  <div
                    className="tooltip tooltip-top"
                    data-tip="Update Profile"
                  >
                    <button
                      onClick={() => openEditModal(farmer)}
                      className="btn btn-ghost btn-xs btn-square text-warning hover:bg-warning/10"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                  <div className="tooltip tooltip-top" data-tip="View Data">
                    <Link
                      to={`/technician/farmers/${farmer._id}`}
                      className="btn btn-ghost btn-xs btn-square text-neutral hover:bg-neutral/10"
                    >
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-6 py-4 bg-base-200/40 border border-base-300 rounded-none">
          <span className="text-xs text-base-content/50">
            Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong>—
            <strong>
              {Math.min(currentPage * itemsPerPage, filteredFarmers.length)}
            </strong>{" "}
            of <strong>{filteredFarmers.length}</strong>
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

      {/* REGISTRATION MODAL */}
      <RegisterFarmerModal 
        isOpen={isRegisterModalOpen} 
        onClose={() => setIsRegisterModalOpen(false)} 
      />
      {/* EDIT PARTNER MODAL */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-base-100 rounded-3xl overflow-hidden shadow-2xl border border-base-300"
            >
              <div className="bg-linear-to-r from-warning/20 to-base-100 px-6 py-5 border-b border-base-200 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tighter text-base-content">
                    Update Partner Profile
                  </h3>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.3em] text-warning/60">
                    Modifying Official Registry Data
                  </p>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-ghost btn-sm btn-square"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6">
                <form
                  id="edit-farmer-form"
                  onSubmit={handleEditSubmit}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <fieldset className="fieldset">
                      <legend className="fieldset-legend text-[9px] font-black uppercase tracking-widest text-base-content/40">
                        First Name
                      </legend>
                      <input
                        type="text"
                        required
                        value={editData.firstName}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            firstName: e.target.value,
                          })
                        }
                        className="input input-bordered w-full rounded-none h-10 text-xs font-bold bg-base-200"
                      />
                    </fieldset>
                    <fieldset className="fieldset">
                      <legend className="fieldset-legend text-[9px] font-black uppercase tracking-widest text-base-content/40">
                        Last Name
                      </legend>
                      <input
                        type="text"
                        required
                        value={editData.lastName}
                        onChange={(e) =>
                          setEditData({ ...editData, lastName: e.target.value })
                        }
                        className="input input-bordered w-full rounded-none h-10 text-xs font-bold bg-base-200"
                      />
                    </fieldset>
                  </div>

                  <fieldset className="fieldset">
                    <legend className="fieldset-legend text-[9px] font-black uppercase tracking-widest text-base-content/40">
                      Contact Number
                    </legend>
                    <input
                      type="tel"
                      required
                      value={editData.phoneNumber}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          phoneNumber: e.target.value,
                        })
                      }
                      className="input input-bordered w-full rounded-none h-10 text-xs font-bold bg-base-200"
                    />
                  </fieldset>

                  <fieldset className="fieldset">
                    <legend className="fieldset-legend text-[9px] font-black uppercase tracking-widest text-base-content/40">
                      Barangay Location
                    </legend>
                    <input
                      type="text"
                      required
                      value={editData.barangay}
                      onChange={(e) =>
                        setEditData({ ...editData, barangay: e.target.value })
                      }
                      className="input input-bordered w-full rounded-none h-10 text-xs font-bold bg-base-200"
                    />
                  </fieldset>

                  <fieldset className="fieldset">
                    <legend className="fieldset-legend text-[9px] font-black uppercase tracking-widest text-base-content/40">
                      Email Address
                    </legend>
                    <input
                      type="email"
                      value={editData.email}
                      onChange={(e) =>
                        setEditData({ ...editData, email: e.target.value })
                      }
                      className="input input-bordered w-full rounded-none h-10 text-xs font-bold bg-base-200"
                    />
                  </fieldset>
                </form>
              </div>

              <div className="border-t border-base-200 bg-base-200/20 px-5 py-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-ghost btn-sm text-[10px] font-black uppercase tracking-widest"
                >
                  Discard Changes
                </button>
                <button
                  form="edit-farmer-form"
                  type="submit"
                  disabled={isUpdating}
                  className="btn btn-warning text-[10px] font-black uppercase tracking-widest shadow-lg"
                >
                  {isUpdating ? "Updating..." : "Update Profile"}
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
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-base-100 text-base-content px-6 py-3 rounded-none shadow-2xl border border-base-300 flex items-center gap-6 min-w-[340px] backdrop-blur-xl ring-1 ring-emerald-500/20"
          >
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-emerald-600">
                Registry Protocol
              </span>
              <span className="text-xs font-black uppercase tracking-tight flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                {selectedIds.length} Selected
              </span>
            </div>

            <div className="h-6 w-px bg-base-content/10" />

            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedIds([])}
                className=" cursor-pointer text-base-content/40 hover:text-base-content text-[9px] font-black uppercase tracking-widest transition-colors"
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
}
