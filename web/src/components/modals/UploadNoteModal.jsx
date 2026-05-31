import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Upload,
  CalendarDays,
  FileText,
  User2,
  Loader2,
  Camera,
  MapPin,
  ClipboardList,
  Navigation,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";

const inputClass = `w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content placeholder:text-base-content/25 focus:border-emerald-500 focus:outline-none transition-all`;
const labelClass = `text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] ml-1`;

export default function UploadNoteModal({ isOpen, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [searchFarmer, setSearchFarmer] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    farmerName: "",
    latitude: "",
    longitude: "",
  });

  // Query farmers list for searchable select
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
      const res = await axiosInstance.post("/technician/photo-notes", data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Field note uploaded and saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["technician", "field-notes"] });
      if (onSuccess) onSuccess();
      onClose();
      // Reset form states
      setFormData({
        title: "",
        description: "",
        farmerName: "",
        latitude: "",
        longitude: "",
      });
      setImagePreview(null);
    },
    onError: (error) => {
      toast.error(
        "Failed to upload note: " +
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

  const handleAutoLocation = () => {
    if (!navigator.geolocation) {
      return toast.error("Geolocation is not supported by your browser.");
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setIsLocating(false);
        toast.success("Successfully synchronized field vectors.");
      },
      (error) => {
        setIsLocating(false);
        toast.error("Failed to acquire GPS fix. Please input manually.");
        console.error("Geolocation error:", error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleUpload = () => {
    if (!formData.title) return toast.error("Note title is required.");
    if (!formData.description) return toast.error("Description is required.");
    if (!imagePreview) return toast.error("Please attach a photo note image.");

    mutation.mutate({
      ...formData,
      imageUrl: imagePreview,
    });
  };

  // Filter farmers dropdown list
  const filteredFarmers = farmers.filter((f) =>
    f.name?.toLowerCase().includes(searchFarmer.toLowerCase())
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        
        {/* MODAL */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-base-300 bg-base-200/40 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter text-base-content leading-none">
                  Upload Field Note
                </h3>
                <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-base-content/25 leading-none">
                  Publish Photo Diagnoses & Specialized Annotations
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
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
              
              {/* LEFT PANEL: PHOTO ATTACHMENT */}
              <div className="bg-base-200/30 border border-base-300 rounded-2xl p-5 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Camera size={14} className="text-emerald-500" />
                    <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                      Photo Attachment
                    </h4>
                  </div>

                  <div
                    onClick={() => document.getElementById("field-photo-upload").click()}
                    className="relative aspect-square rounded-xl overflow-hidden border border-base-300 hover:border-emerald-500/50 transition-all bg-base-200 cursor-pointer group"
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Field preview"
                        className="w-full h-full object-cover grayscale-[0.2]"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-105 transition-all">
                          <Upload size={20} className="text-emerald-600" />
                        </div>
                        <div className="text-center px-4">
                          <p className="text-[9px] font-black text-base-content/40 uppercase tracking-widest leading-none">
                            Upload Diagnostic Image
                          </p>
                          <p className="text-[8px] font-bold text-base-content/20 uppercase mt-1.5 leading-none">
                            PNG / JPG / WEBP
                          </p>
                        </div>
                      </div>
                    )}
                    <input
                      id="field-photo-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT PANEL: NOTE DETAILS */}
              <div className="bg-base-200/30 border border-base-300 rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-2 border-b border-base-300 pb-3 mb-1">
                  <ClipboardList size={14} className="text-emerald-500" />
                  <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                    Clinical Case Information
                  </h4>
                </div>

                {/* Farmer Search Autocomplete */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 relative">
                    <label className={labelClass}>Stakeholder/Farmer (Optional)</label>
                    <div className="relative">
                      <User2
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                      />
                      <input
                        type="text"
                        placeholder="Search or enter farmer name..."
                        value={formData.farmerName}
                        onChange={(e) => {
                          setFormData((prev) => ({
                            ...prev,
                            farmerName: e.target.value,
                          }));
                          setSearchFarmer(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        className={`${inputClass} pl-11`}
                      />
                    </div>

                    {isDropdownOpen && searchFarmer && (
                      <div className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                        {filteredFarmers.length === 0 ? (
                          <div
                            onClick={() => setIsDropdownOpen(false)}
                            className="px-4 py-3 text-xs font-bold text-base-content/40 cursor-pointer hover:bg-base-200/50"
                          >
                            Use as custom text: "{formData.farmerName}"
                          </div>
                        ) : (
                          filteredFarmers.map((f) => (
                            <div
                              key={f._id}
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  farmerName: f.name,
                                }));
                                setIsDropdownOpen(false);
                              }}
                              className="px-4 py-2.5 text-xs font-bold text-base-content hover:bg-emerald-500 hover:text-white cursor-pointer transition-colors"
                            >
                              {f.name} ({f.address?.barangay || "Oton"})
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Note Title */}
                  <div className="space-y-1.5">
                    <label className={labelClass}>Note Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Unusual Fever, Foot Rot, AI Prep"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, title: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Diagnostic Description / Clinical Annotations</label>
                  <textarea
                    placeholder="Provide full description of symptoms, treatment, or technical annotations..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="w-full h-32 bg-base-200 border border-base-300 rounded-xl p-4 text-xs font-bold text-base-content placeholder:text-base-content/25 focus:border-emerald-500 focus:outline-none transition-all resize-none"
                  />
                </div>

                {/* Geolocation Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-base-300">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Latitude Vector</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="10.123456"
                      value={formData.latitude}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          latitude: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Longitude Vector</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="122.123456"
                      value={formData.longitude}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          longitude: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5 flex flex-col justify-end">
                    <button
                      type="button"
                      onClick={handleAutoLocation}
                      disabled={isLocating}
                      className="h-11 w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-500/20 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isLocating ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Locating...
                        </>
                      ) : (
                        <>
                          <Navigation size={14} />
                          Auto Get GPS
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* FOOTER */}
          <div className="bg-base-200/20 border-t border-base-300 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="h-11 px-6 rounded-xl bg-base-200 hover:bg-base-300 text-[10px] font-black uppercase tracking-widest transition-all text-base-content/50 cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleUpload}
              disabled={mutation.isPending}
              className="h-11 px-8 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2.5 shadow-md bg-[#00643b] hover:bg-[#004d2e] cursor-pointer"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Uploading Note...
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Upload Note
                </>
              )}
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
