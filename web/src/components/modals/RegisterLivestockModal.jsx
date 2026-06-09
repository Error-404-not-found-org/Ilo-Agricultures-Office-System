import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Upload,
  CalendarDays,
  PawPrint,
  User2,
  Loader2,
  Camera,
  BadgeInfo,
  BadgeCheck,
  Info,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import { CATTLE_BREEDS, CATTLE_SPECIES, CATTLE_COLORS, BREED_OPTIONS_BY_SPECIES } from "../../constants/breeds";

const inputClass = `w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content placeholder:text-base-content/25 focus:border-emerald-500 focus:outline-none transition-all`;
const labelClass = `text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] ml-1`;

const RegisterLivestockModal = ({ isOpen, onClose, onSuccess, livestock = null }) => {
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

  const { data: farmers = [] } = useQuery({
    queryKey: ["farmers", "list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=farmer");
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (livestock) {
        const payload = {
          earTag: data.earTag,
          brand: data.brand,
          species: data.species,
          breed: data.breed,
          color: data.color,
          gender: data.gender,
          birthDate: data.dob || null,
          imageUrl: data.imageUrl,
        };
        const res = await axiosInstance.put(
          `/animals/wizard/${livestock._id || livestock.id}`,
          payload
        );
        return res.data;
      } else {
        const res = await axiosInstance.post(
          "/technician/walk-in-livestock",
          data,
        );
        return res.data;
      }
    },
    onSuccess: () => {
      toast.success(
        livestock
          ? "Livestock profile updated successfully!"
          : "Livestock profile registered successfully!"
      );
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["animals"] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(
        (livestock ? "Failed to update livestock: " : "Failed to register livestock: ") +
          (error.response?.data?.message || error.message),
      );
    },
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      if (livestock) {
        const formattedDob = livestock.birthDate 
          ? new Date(livestock.birthDate).toISOString().split("T")[0] 
          : "";
        
        setFormData({
          earTag: livestock.earTag || "",
          brand: livestock.brand || "",
          species: livestock.species || "Beef Cattle",
          breed: livestock.breed || "",
          color: livestock.color || "",
          gender: livestock.gender || "Female",
          dob: formattedDob,
          farmerName: livestock.farmerId?._id || livestock.farmerId || "",
        });
        setSearchFarmer(livestock.farmerId?.name || "Unknown Farmer");
        setImagePreview(livestock.imageUrl || null);
      } else {
        setFormData({
          earTag: "",
          brand: "",
          species: "Beef Cattle",
          breed: "",
          color: "",
          gender: "Female",
          dob: "",
          farmerName: "",
        });
        setSearchFarmer("");
        setImagePreview(null);
      }
    }
  }, [livestock, isOpen]);

  useEffect(() => {
    if (formData.species) {
      const validBreeds = BREED_OPTIONS_BY_SPECIES[formData.species] || [];
      if (formData.breed && !validBreeds.includes(formData.breed)) {
        setFormData((prev) => ({ ...prev, breed: "" }));
      }
    }
  }, [formData.species]);

  if (!isOpen) return null;

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
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
        
        {/* MODAL */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-base-300 bg-base-200/40 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                <PawPrint size={20} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter text-base-content leading-none">
                  {livestock ? "Edit Livestock Profile" : "Livestock Registry"}
                </h3>
                <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-base-content/25 leading-none">
                  {livestock ? "Modify municipal asset identification" : "Municipal Asset Identification Protocol"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-base-200 text-base-content/40 transition-all hover:bg-base-300 hover:text-base-content cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div className="overflow-y-auto flex-1 custom-scrollbar p-6 bg-base-100">
            <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
              {/* LEFT PANEL: PROFILE ASSETS */}
              <div className="bg-base-200/30 border border-base-300 rounded-2xl p-5 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Camera size={14} className="text-emerald-500" />
                    <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                      Identification Asset
                    </h4>
                  </div>

                  <div
                    onClick={() =>
                      document.getElementById("animal-photo").click()
                    }
                    className="relative aspect-square rounded-xl overflow-hidden border border-base-300 hover:border-emerald-500/50 transition-all bg-base-200 cursor-pointer group"
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover grayscale-[0.2]"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-105 transition-all">
                          <Upload size={20} className="text-emerald-600" />
                        </div>
                        <div className="text-center px-4">
                          <p className="text-[9px] font-black text-base-content/40 uppercase tracking-widest leading-none">
                            Upload Field Capture
                          </p>
                          <p className="text-[8px] font-bold text-base-content/20 uppercase mt-1.5 leading-none">
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
              <div className="bg-base-200/30 border border-base-300 rounded-2xl p-6 space-y-6">
                {/* OWNER SELECTION */}
                <div className="space-y-2.5 relative">
                  <div className="flex items-center gap-2">
                    <User2 size={14} className="text-emerald-500" />
                    <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
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
                      disabled={!!livestock}
                      placeholder="Search field records for owner..."
                      className={`${inputClass} pl-11 ${livestock ? "opacity-50 cursor-not-allowed" : ""}`}
                    />
                  </div>

                  <AnimatePresence>
                    {isDropdownOpen && !livestock && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full left-0 w-full mt-1 bg-base-100 border border-base-300 rounded-xl overflow-hidden shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar"
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
                                className="w-full px-5 py-3 flex items-center gap-3.5 hover:bg-base-200 transition-all text-left border-b border-base-200 last:border-none cursor-pointer"
                              >
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] font-black text-emerald-600 uppercase">
                                  {farmer.name.substring(0, 2)}
                                </div>
                                <div>
                                  <p className="text-xs font-black text-base-content uppercase tracking-tight">
                                    {farmer.name}
                                  </p>
                                  <p className="text-[8px] font-bold text-base-content/30 uppercase tracking-widest mt-0.5">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-base-300">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Ear Tag</label>
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

                  <div className="space-y-1.5">
                    <label className={labelClass}>Species</label>
                    <select
                      value={formData.species}
                      onChange={(e) =>
                        setFormData({ ...formData, species: e.target.value })
                      }
                      className={`${inputClass} cursor-pointer`}
                    >
                      {CATTLE_SPECIES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Genetic Breed</label>
                    <select
                      value={formData.breed}
                      onChange={(e) =>
                        setFormData({ ...formData, breed: e.target.value })
                      }
                      className={`${inputClass} cursor-pointer`}
                    >
                      <option value="" disabled>
                        Select Breed
                      </option>
                      {(BREED_OPTIONS_BY_SPECIES[formData.species] || CATTLE_BREEDS).map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Color</label>
                    <select
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className={`${inputClass} cursor-pointer`}
                    >
                      <option value="" disabled>Select Color</option>
                      {CATTLE_COLORS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
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

                  <div className="space-y-1.5">
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
                        className={`${inputClass} pl-11 cursor-pointer`}
                      />
                    </div>
                  </div>
                </div>

                {/* SYSTEM ADVISORY */}
                <div className="rounded-2xl p-5 border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3">
                  <Info size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[10px] font-black text-base-content uppercase tracking-widest leading-none">
                      Registry Synchronization
                    </h4>
                    <p className="text-[9px] font-bold text-base-content/40 uppercase mt-2 leading-relaxed tracking-wider">
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
          <div className="px-6 py-4 border-t border-base-300 bg-base-200/20 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="h-11 px-6 rounded-xl bg-base-200 hover:bg-base-300 text-[10px] font-black uppercase tracking-widest transition-all text-base-content/50 cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleRegister}
              disabled={mutation.isPending}
              className="h-11 px-8 rounded-xl bg-[#074033] hover:bg-[#0d5948] text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2.5 disabled:opacity-50 cursor-pointer"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Synchronizing...
                </>
              ) : (
                <>
                  <BadgeCheck size={14} />
                  {livestock ? "Save Asset Updates" : "Register Municipal Asset"}
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
