import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Search,
  Upload,
  CalendarDays,
  PawPrint,
  User2,
  Loader2,
  Camera,
  BadgeInfo,
  BadgeCheck,
  Zap,
  Info,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import { CATTLE_BREEDS, CATTLE_SPECIES, CATTLE_COLORS } from "../../constants/breeds";

const inputClass = `w-full h-11 bg-base-200/50 border border-base-200 rounded-none px-4 text-xs font-bold text-base-content placeholder:text-base-content/20 focus:border-emerald-500/30 focus:outline-none transition-all`;
const labelClass = `text-[9px] font-black text-base-content/30 uppercase tracking-[0.2em] ml-1`;

const RegisterLivestockModal = ({ isOpen, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [searchFarmer, setSearchFarmer] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  const [formData, setFormData] = useState({
    earTag: "",
    brand: "",
    species: "Beef Cattle",
    breed: "",
    color: "",
    gender: "Female",
    dob: "",
    farmerName: "",
  });

  // FETCH FARMERS
  const { data: farmers = [] } = useQuery({
    queryKey: ["farmers", "list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=farmer");
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: isOpen,
  });

  // REGISTER
  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.post(
        "/technician/walk-in-livestock",
        data,
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success("Livestock profile registered successfully!");
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(
        "Failed to register livestock: " +
          (error.response?.data?.message || error.message),
      );
    },
  });

  if (!isOpen) return null;

  // IMAGE
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // SUBMIT
  const handleRegister = () => {
    if (!formData.farmerName)
      return toast.error("Please select a livestock owner.");
    if (!formData.breed) return toast.error("Breed is required.");
    if (!formData.species) return toast.error("Species is required.");

    mutation.mutate({
      ...formData,
      imageUrl: imagePreview,
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-120 flex items-center justify-center p-4">
        {/* BACKDROP */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        />

        {/* MODAL */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-6xl overflow-hidden rounded-none border border-base-300 bg-base-100 shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-base-200 bg-base-200/30 px-8 py-5">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-emerald-500/5 border border-emerald-500/10 rounded-none flex items-center justify-center text-emerald-600 shadow-sm">
                <PawPrint size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter text-base-content">
                  Livestock Registry
                </h3>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.3em] text-base-content/25">
                  Municipal Asset Identification Protocol
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-none bg-base-200 text-base-content/40 transition-all hover:bg-base-300 hover:text-base-content"
            >
              <X size={18} />
            </button>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div className="overflow-y-auto flex-1 custom-scrollbar px-8 py-8">
            <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-8">
              {/* LEFT PANEL: PROFILE ASSETS */}
              <div className="bg-base-200/20 border border-base-200 rounded-none p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Camera size={14} className="text-emerald-500" />
                    <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">
                      Identification asset
                    </h4>
                  </div>

                  <div
                    onClick={() =>
                      document.getElementById("animal-photo").click()
                    }
                    className="relative aspect-square rounded-none overflow-hidden border-2 border-dashed border-base-200 hover:border-emerald-500 transition-all bg-base-200/50 cursor-pointer group"
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover grayscale-[0.2]"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 rounded-none bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center group-hover:scale-105 transition-all">
                          <Upload size={24} className="text-emerald-600" />
                        </div>
                        <div className="text-center px-4">
                          <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest">
                            Upload Field Capture
                          </p>
                          <p className="text-[8px] font-bold text-base-content/20 uppercase mt-1">
                            PNG / JPG / WEBP
                          </p>
                        </div>
                      </div>
                    )}
                    <input
                      id="animal-photo"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT PANEL: TECHNICAL SPECS */}
              <div className="bg-base-200/20 border border-base-200 rounded-none p-8 space-y-8">
                {/* OWNER SELECTION */}
                <div className="space-y-3 relative">
                  <div className="flex items-center gap-2">
                    <User2 size={14} className="text-emerald-500" />
                    <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">
                      Municipal Ownership
                    </h4>
                  </div>
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                    />
                    <input
                      value={searchFarmer}
                      onChange={(e) => {
                        setSearchFarmer(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      placeholder="Search field records for owner..."
                      className={`${inputClass} pl-11`}
                    />
                  </div>

                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full left-0 w-full mt-1 bg-base-100 border border-base-300 rounded-none overflow-hidden shadow-2xl z-50 max-h-72 overflow-y-auto"
                      >
                        {farmers.filter((f) =>
                          f.name
                            .toLowerCase()
                            .includes(searchFarmer.toLowerCase()),
                        ).length > 0 ? (
                          farmers
                            .filter((f) =>
                              f.name
                                .toLowerCase()
                                .includes(searchFarmer.toLowerCase()),
                            )
                            .map((farmer) => (
                              <button
                                key={farmer._id}
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    farmerName: farmer._id,
                                  });
                                  setSearchFarmer(farmer.name);
                                  setIsDropdownOpen(false);
                                }}
                                className="w-full px-6 py-4 flex items-center gap-4 hover:bg-base-200 transition-all text-left border-b border-base-200 last:border-none"
                              >
                                <div className="w-10 h-10 rounded-none bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center text-[10px] font-black text-emerald-600">
                                  {farmer.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-[11px] font-black text-base-content uppercase tracking-tight">
                                    {farmer.name}
                                  </p>
                                  <p className="text-[8px] font-bold text-base-content/30 uppercase tracking-widest">
                                    {farmer.role || "FARMER"}
                                  </p>
                                </div>
                              </button>
                            ))
                        ) : (
                          <div className="py-10 text-center text-[10px] font-black text-base-content/20 uppercase tracking-widest">
                            No field records found
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* TECHNICAL PROFILE */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-base-200/50">
                  <div className="space-y-2">
                    <label className={labelClass}>EarTag</label>
                    <div className="relative">
                      <BadgeInfo
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                      />
                      <input
                        value={formData.earTag}
                        maxLength={3}
                        onChange={(e) =>
                          setFormData({ ...formData, earTag: e.target.value })
                        }
                        placeholder="e.g. 123"
                        className={`${inputClass} pl-11`}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Species</label>
                    <select
                      value={formData.species}
                      onChange={(e) =>
                        setFormData({ ...formData, species: e.target.value })
                      }
                      className={`${inputClass} appearance-none`}
                    >
                      {CATTLE_SPECIES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Genetic Breed</label>
                    <select
                      value={formData.breed}
                      onChange={(e) =>
                        setFormData({ ...formData, breed: e.target.value })
                      }
                      className={`${inputClass} appearance-none`}
                    >
                      <option value="" disabled>
                        Select Breed
                      </option>
                      {CATTLE_BREEDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Color</label>
                    <select
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className={`${inputClass} appearance-none`}
                    >
                      <option value="" disabled>Select Color</option>
                      {CATTLE_COLORS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Brand (Optional)</label>
                    <input
                      value={formData.brand}
                      maxLength={15}
                      onChange={(e) =>
                        setFormData({ ...formData, brand: e.target.value })
                      }
                      placeholder="e.g. CIRCLE-X"
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Birth Date</label>
                    <div className="relative">
                      <CalendarDays
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                      />
                      <input
                        type="date"
                        value={formData.dob}
                        onChange={(e) =>
                          setFormData({ ...formData, dob: e.target.value })
                        }
                        className={`${inputClass} pl-11`}
                      />
                    </div>
                  </div>
                </div>

                {/* SYSTEM ADVISORY */}
                <div className="rounded-none p-5 border border-emerald-500/10 bg-emerald-500/5 flex items-start gap-4">
                  <Info size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-[10px] font-black text-base-content uppercase tracking-widest">
                      Registry Synchronization
                    </h4>
                    <p className="text-[9px] font-bold text-base-content/40 uppercase mt-1 leading-relaxed tracking-wider">
                      This biological asset will be synchronized with the
                      municipal field operations registry and linked to the
                      selected ownership profile for future auditing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="px-8 py-5 border-t border-base-200 bg-base-200/20 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="h-11 px-8 rounded-none bg-base-200 hover:bg-base-300 text-[9px] font-black uppercase tracking-widest transition-all text-base-content/40"
            >
              Cancel
            </button>

            <button
              onClick={handleRegister}
              disabled={mutation.isPending}
              className="h-11 px-10 rounded-none bg-[#074033] hover:bg-[#0a5242] text-white text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-950/20 flex items-center gap-3 disabled:opacity-50"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Synchronizing...
                </>
              ) : (
                <>
                  <BadgeCheck size={14} />
                  Register Municipal Asset
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RegisterLivestockModal;
