import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Syringe, User, Activity, Calendar, Search, MapPin, Phone, AlertCircle, AlertTriangle, BadgeCheck, Dna, History, Mail } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import { CATTLE_BREEDS, CATTLE_SPECIES } from "../../constants/breeds";
import { getSireCodeByBreed } from "../../constants/sireRegistry";
import { OTON_BARANGAYS } from "../../constants/barangays";

const inputClass = `w-full h-11 bg-base-200/50 border border-base-200 rounded-none px-4 text-xs font-bold text-base-content placeholder:text-base-content/20 focus:border-emerald-500/30 focus:outline-none transition-all`;
const selectClass = `w-full h-11 bg-base-200/50 border border-base-200 rounded-none px-10 text-xs font-bold text-base-content focus:border-emerald-500/30 focus:outline-none transition-all appearance-none`;
const labelClass = `text-[9px] font-black text-base-content/30 uppercase tracking-[0.2em] ml-1`;
const sectionClass = `bg-base-200/20 border border-base-200 rounded-none p-6 space-y-5`;

const WalkInAIModal = ({ isOpen, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [isExistingRecord, setIsExistingRecord] = useState(true);
  const [selectedFarmerId, setSelectedFarmerId] = useState("");
  const [searchFarmer, setSearchFarmer] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [showPregnancyWarning, setShowPregnancyWarning] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [isBarangayDropdownOpen, setIsBarangayDropdownOpen] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    address: {

      barangay: "",
      city: "Oton"
    },
    email: "",
    animalDetails: {
      earTag: "",
      species: "Beef Cattle",
      breed: "",
    },
    inseminationDetails: {
      inseminationDate: new Date().toISOString().split("T")[0],
      time: "08:00",
      sireBreed: "",
      sireCode: `SIRE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      estrus: "Natural",
      status: "done",
    },
  });

  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const res = await axiosInstance.get("/config");
      return res.data;
    },
    enabled: isOpen,
  });

  const { data: farmers = [] } = useQuery({
    queryKey: ["farmers", "list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=farmer");
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: isOpen,
  });

  const { data: animals = [], isLoading: isLoadingAnimals } = useQuery({
    queryKey: ["farmer-animals", selectedFarmerId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/animals/farmer/${selectedFarmerId}`);
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: !!selectedFarmerId && isExistingRecord,
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.post("/technician/walk-in-insemination", data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("AI Transaction recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["farmer-animals"] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error("Failed to record AI: " + (error.response?.data?.message || error.message));
    },
  });

  const overrideMutation = useMutation({
    mutationFn: async (animalId) => {
      return await axiosInstance.patch(`/animals/${animalId}/reproductive-status`, {
        status: "Normal",
        note: "Technician override: Farmer confirmed animal is not pregnant during field visit.",
      });
    },
    onSuccess: () => {
      toast.success("Animal status reset to Normal.");
      queryClient.invalidateQueries({ queryKey: ["farmer-animals"] });
      setShowPregnancyWarning(false);
      setIsOverriding(true);
    },
  });

  useEffect(() => {
    if (!isOpen) {
      setIsExistingRecord(true);
      setSelectedFarmerId("");
      setSearchFarmer("");
      setIsDropdownOpen(false);
      setSelectedAnimalId("");
      setShowPregnancyWarning(false);
      setIsOverriding(false);
      setIsBarangayDropdownOpen(false);
      setFormData({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        address: {

          barangay: "",
          city: "Oton"
        },
        email: "",
        animalDetails: {
          earTag: "",
          species: "Beef Cattle",
          breed: "",
        },
        inseminationDetails: {
          inseminationDate: new Date().toISOString().split("T")[0],
          time: "08:00",
          sireBreed: "",
          sireCode: `SIRE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          estrus: "Natural",
          status: "done",
        },
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    let submissionData;
    if (isExistingRecord) {
      if (!selectedFarmerId || !selectedAnimalId) {
        return toast.error("Please select both a farmer and an animal.");
      }
      const farmer = farmers.find((f) => f._id === selectedFarmerId);
      const animal = animals.find((a) => a._id === selectedAnimalId);
      submissionData = {
        farmerId: selectedFarmerId,
        animalId: selectedAnimalId,
        firstName: farmer.name.split(" ")[0],
        lastName: farmer.name.split(" ").slice(1).join(" "),
        phoneNumber: farmer.phoneNumber || "",
        email: farmer.email || "",
        address: typeof farmer.address === "string" ? farmer.address : farmer.address?.street || "",
        animalDetails: {
          earTag: animal.earTag,
          species: animal.species,
          breed: animal.breed,
        },
        inseminationDetails: formData.inseminationDetails,
      };
    } else {
      if (!formData.phoneNumber || !formData.animalDetails.earTag) {
        return toast.error("Farmer phone number and animal ear tag are required.");
      }
      submissionData = formData;
    }
    if (!formData.inseminationDetails.sireBreed || !formData.inseminationDetails.sireCode) {
      return toast.error("Please provide both Sire Breed and Sire Code.");
    }

    if (showPregnancyWarning && !isOverriding) {
      return toast.error("Please resolve the pregnancy warning before saving.");
    }

    mutation.mutate(submissionData);
  };

  const handleAnimalChange = (animalId) => {
    setSelectedAnimalId(animalId);
    const animal = animals.find((a) => a._id === animalId);
    if (animal?.reproductiveStatus === "Pregnant") {
      setShowPregnancyWarning(true);
    } else {
      setShowPregnancyWarning(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
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
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-4xl overflow-hidden rounded-none border border-base-300 bg-base-100 shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-base-200 bg-base-200/30 px-6 py-4">
            <div className="flex items-center gap-4">
               <div className="w-11 h-11 bg-emerald-500/5 border border-emerald-500/10 rounded-none flex items-center justify-center text-emerald-600 shadow-sm">
                  <Syringe size={20} />
               </div>
               <div>
                  <h3 className="text-sm font-black uppercase tracking-tighter text-base-content">
                    Artificial Insemination Hub
                  </h3>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.3em] text-base-content/25">
                    Field Registry Protocol
                  </p>
               </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-none bg-base-200 text-base-content/40 transition-all hover:bg-base-300 hover:text-base-content"
            >
              <X size={14} />
            </button>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div className="overflow-y-auto flex-1 custom-scrollbar px-6 py-6 space-y-6">
            {config?.isHoliday && (
              <div className="border border-rose-500/20 bg-rose-500/3 p-5 flex items-start gap-4 rounded-none">
                <AlertCircle size={18} className="text-rose-500 shrink-0" />
                <div>
                  <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Off-Schedule Entry</h3>
                  <p className="text-[10px] font-bold text-rose-500/40 uppercase tracking-widest mt-1">Office operations are currently closed. Marked as manual field entry.</p>
                </div>
              </div>
            )}

            {/* TOGGLES */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-base-200/50 p-3 rounded-none border border-base-200">
              <div className="inline-flex p-1 rounded-none bg-base-100 border border-base-200">
                <button
                  type="button"
                  onClick={() => setIsExistingRecord(true)}
                  className={`px-5 h-9 rounded-none text-[9px] font-black uppercase tracking-widest transition-all ${isExistingRecord ? "bg-[#074033] text-white shadow-lg shadow-emerald-950/20" : "text-base-content/30 hover:text-base-content"}`}
                >
                  Existing Record
                </button>
                <button
                  type="button"
                  onClick={() => setIsExistingRecord(false)}
                  className={`px-5 h-9 rounded-none text-[9px] font-black uppercase tracking-widest transition-all ${!isExistingRecord ? "bg-[#074033] text-white shadow-lg shadow-emerald-950/20" : "text-base-content/30 hover:text-base-content"}`}
                >
                  Full Registration
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    inseminationDetails: { ...formData.inseminationDetails, status: "done" }
                  })}
                  className={`px-4 h-9 rounded-none text-[9px] font-black uppercase tracking-widest border transition-all ${formData.inseminationDetails.status !== "in-progress" ? "bg-emerald-500/10 border-emerald-500 text-emerald-600" : "border-transparent text-base-content/20"}`}
                >
                  Service Completed
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    inseminationDetails: { ...formData.inseminationDetails, status: "in-progress" }
                  })}
                  className={`px-4 h-9 rounded-none text-[9px] font-black uppercase tracking-widest border transition-all ${formData.inseminationDetails.status === "in-progress" ? "bg-blue-500/10 border-blue-500 text-blue-600" : "border-transparent text-base-content/20"}`}
                >
                  Schedule Visit
                </button>
              </div>
            </div>



            {isExistingRecord ? (
              <section className={sectionClass}>
                <div className="flex items-center gap-2 mb-2">
                   <BadgeCheck size={14} className="text-emerald-500" />
                   <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">Registry selection</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className={labelClass}>Farmer Record</label>
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

                      <AnimatePresence>
                        {isDropdownOpen && searchFarmer && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto border border-base-200 bg-base-100 shadow-xl custom-scrollbar"
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
                                      setSelectedFarmerId(farmer._id);
                                      setSelectedAnimalId("");
                                      setSearchFarmer(farmer.name);
                                      setIsDropdownOpen(false);
                                    }}
                                    className="w-full px-4 py-3 text-left transition-colors hover:bg-emerald-500/10 flex flex-col gap-1 border-b border-base-200/50 last:border-0"
                                  >
                                    <span className="text-xs font-bold text-base-content block">
                                      {farmer.name}
                                    </span>
                                    <span className="text-[9px] font-black tracking-widest text-base-content/40 uppercase">
                                      {farmer.phoneNumber || "No Contact"} •{" "}
                                      {typeof farmer.address === "string"
                                        ? farmer.address
                                        : farmer.address?.barangay ||
                                          "No Address"}
                                    </span>
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
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Animal Asset</label>
                    <div className="relative">
                      <Activity size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20" />
                      <select
                        disabled={!selectedFarmerId || isLoadingAnimals}
                        value={selectedAnimalId}
                        onChange={(e) => handleAnimalChange(e.target.value)}
                        className={`${selectClass} disabled:opacity-50 ${showPregnancyWarning ? "border-rose-500/50" : ""}`}
                      >
                        <option value="">
                          {isLoadingAnimals ? "Synchronizing..." : "Select animal"}
                        </option>
                        {animals?.map((a) => (
                          <option key={a._id} value={a._id}>
                            Tag #{a.earTag} ({a.breed}) — {a.reproductiveStatus || "Normal"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Sire Selection for Existing Record */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-base-200/50 mt-4">
                    <div className="space-y-2">
                      <label className={labelClass}>Sire Breed</label>
                      <div className="relative">
                        <Dna size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20" />
                        <select
                          value={formData.inseminationDetails.sireBreed}
                          onChange={(e) => {
                            const breed = e.target.value;
                            const code = getSireCodeByBreed(breed);
                            setFormData({ 
                              ...formData, 
                              inseminationDetails: { 
                                ...formData.inseminationDetails, 
                                sireBreed: breed,
                                sireCode: code || formData.inseminationDetails.sireCode
                              } 
                            });
                          }}
                          className={selectClass}
                        >
                          <option value="" disabled>Select Sire Breed</option>
                          {CATTLE_BREEDS.map(b => (
                              <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Sire Code</label>
                      <div className="relative">
                        <BadgeCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20" />
                        <input 
                          type="text" 
                          value={formData.inseminationDetails.sireCode} 
                          readOnly
                          placeholder="Automatic Code" 
                          className={`${inputClass} pl-11 bg-base-200/50 cursor-not-allowed`} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {showPregnancyWarning && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4"
                    >
                      <div className="bg-rose-500/3 border border-rose-500/20 rounded-none p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <AlertTriangle size={20} className="text-rose-500 shrink-0" />
                          <div>
                            <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Pregnancy Warning</h4>
                            <p className="text-[9px] font-bold text-rose-500/40 uppercase tracking-widest mt-1">
                              Asset recorded as PREGNANT. Insemination is risky.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => overrideMutation.mutate(selectedAnimalId)}
                          disabled={overrideMutation.isPending}
                          className="w-full sm:w-auto h-11 px-6 rounded-none bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-950/20"
                        >
                          {overrideMutation.isPending ? "Updating..." : "Override Status"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <section className={sectionClass}>
                  <div className="flex items-center gap-2 mb-2">
                     <User size={14} className="text-emerald-500" />
                     <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">Owner Data</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelClass}>First Name</label>
                      <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} placeholder="JUAN" className={inputClass} />
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Last Name</label>
                      <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} placeholder="DELA CRUZ" className={inputClass} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Email (For App Access)</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20" />
                      <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="juan@example.com" className={`${inputClass} pl-11`} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Contact Number</label>
                    <div className="relative flex items-center">
                      <Phone size={16} className="absolute left-4 z-10 text-base-content/20" />
                      <div className="absolute left-10 z-10 text-xs font-bold text-base-content/50 border-r border-base-200/50 pr-2 py-1">+63</div>
                      <input 
                        type="tel" 
                        maxLength={10}
                        value={formData.phoneNumber} 
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          setFormData({ ...formData, phoneNumber: val });
                        }} 
                        placeholder="917 XXX XXXX" 
                        className={`${inputClass} pl-[84px]`} 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 relative">
                      <label className={labelClass}>Barangay</label>
                      <div className="relative">
                        <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20" />
                        <input 
                          type="text" 
                          value={formData.address.barangay} 
                          onChange={(e) => {
                            setFormData({ ...formData, address: { ...formData.address, barangay: e.target.value } });
                            setIsBarangayDropdownOpen(true);
                          }} 
                          onFocus={() => setIsBarangayDropdownOpen(true)}
                          placeholder="Search barangay..." 
                          className={`${inputClass} pl-11`} 
                        />
                        <AnimatePresence>
                          {isBarangayDropdownOpen && formData.address.barangay && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto border border-base-200 bg-base-100 shadow-xl custom-scrollbar"
                            >
                              {OTON_BARANGAYS.filter((b) =>
                                b.toLowerCase().includes(formData.address.barangay.toLowerCase())
                              ).length > 0 ? (
                                OTON_BARANGAYS
                                  .filter((b) => b.toLowerCase().includes(formData.address.barangay.toLowerCase()))
                                  .map((brgy) => (
                                    <button
                                      key={brgy}
                                      onClick={() => {
                                        setFormData({ ...formData, address: { ...formData.address, barangay: brgy } });
                                        setIsBarangayDropdownOpen(false);
                                      }}
                                      className="w-full px-4 py-3 text-left transition-colors hover:bg-emerald-500/10 border-b border-base-200/50 last:border-0"
                                    >
                                      <span className="text-xs font-bold text-base-content block">
                                        {brgy}
                                      </span>
                                    </button>
                                  ))
                              ) : (
                                <div className="p-4 text-center">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                    No matches found
                                  </span>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Municipality</label>
                      <div className="relative">
                        <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20" />
                        <input type="text" value={formData.address.city} onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })} placeholder="Oton" className={`${inputClass} pl-11`} />
                      </div>
                    </div>
                  </div>
                </section>

                <section className={sectionClass}>
                  <div className="flex items-center gap-2 mb-2">
                     <Activity size={14} className="text-emerald-500" />
                     <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">Asset Profile</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelClass}>Ear Tag</label>
                      <input type="text" maxLength={3} value={formData.animalDetails.earTag} onChange={(e) => setFormData({ ...formData, animalDetails: { ...formData.animalDetails, earTag: e.target.value.toUpperCase() } })} placeholder="104" className={inputClass} />
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Species</label>
                      <select
                        value={formData.animalDetails.species}
                        onChange={(e) => setFormData({ ...formData, animalDetails: { ...formData.animalDetails, species: e.target.value } })}
                        className={selectClass.replace('px-10', 'px-4')}
                      >
                        {CATTLE_SPECIES.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Breed</label>
                    <select
                      value={formData.animalDetails.breed}
                      onChange={(e) => setFormData({ ...formData, animalDetails: { ...formData.animalDetails, breed: e.target.value } })}
                      className={selectClass.replace('px-10', 'px-4')}
                    >
                      <option value="" disabled>Select Breed</option>
                      {CATTLE_BREEDS.map(b => (
                          <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sire Selection for Full Reg */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-base-200/50 mt-4">
                    <div className="space-y-2">
                      <label className={labelClass}>Sire Breed (AI Setup)</label>
                      <div className="relative">
                        <Dna size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20" />
                        <select
                          value={formData.inseminationDetails.sireBreed}
                          onChange={(e) => {
                            const breed = e.target.value;
                            const code = getSireCodeByBreed(breed);
                            setFormData({ 
                              ...formData, 
                              inseminationDetails: { 
                                ...formData.inseminationDetails, 
                                sireBreed: breed,
                                sireCode: code || formData.inseminationDetails.sireCode
                              } 
                            });
                          }}
                          className={selectClass}
                        >
                          <option value="" disabled>Select Sire Breed</option>
                          {CATTLE_BREEDS.map(b => (
                              <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Sire Code</label>
                      <div className="relative">
                        <BadgeCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20" />
                        <input 
                          type="text" 
                          value={formData.inseminationDetails.sireCode} 
                          readOnly
                          placeholder="Automatic Code" 
                          className={`${inputClass} pl-11 bg-base-200/50 cursor-not-allowed`} 
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            <section className={sectionClass}>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-base-200/50">
                 <History size={14} className="text-emerald-500" />
                 <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">Service Metrics</h4>
              </div>


              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className={labelClass}>Mission Date</label>
                  <input type="date" value={formData.inseminationDetails.inseminationDate} onChange={(e) => setFormData({ ...formData, inseminationDetails: { ...formData.inseminationDetails, inseminationDate: e.target.value } })} className={inputClass} />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>T-Time</label>
                  <input type="time" value={formData.inseminationDetails.time} onChange={(e) => setFormData({ ...formData, inseminationDetails: { ...formData.inseminationDetails, time: e.target.value } })} className={inputClass} />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Estrus Cycle</label>
                  <select
                    value={formData.inseminationDetails.estrus}
                    onChange={(e) => setFormData({ ...formData, inseminationDetails: { ...formData.inseminationDetails, estrus: e.target.value } })}
                    className={selectClass.replace('px-10', 'px-4')}
                  >
                    <option>Natural</option>
                    <option>Synchronized</option>
                    <option>Induced</option>
                  </select>
                </div>
              </div>
            </section>
          </div>

          {/* FOOTER */}
          <div className="bg-base-200/20 border-t border-base-200 px-6 py-4 flex justify-end gap-3">
            <button 
              onClick={onClose} 
              className="h-11 px-8 rounded-none bg-base-200 hover:bg-base-300 text-[9px] font-black uppercase tracking-widest transition-all text-base-content/40"
            >
              Cancel
            </button>
            <button
              disabled={mutation.isPending || (showPregnancyWarning && !isOverriding)}
              onClick={handleSubmit}
              className={`h-11 px-10 rounded-none text-white text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-3 shadow-lg shadow-emerald-950/20 ${
                formData.inseminationDetails.status !== 'in-progress' 
                  ? "bg-[#074033] hover:bg-[#0a5242]"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {mutation.isPending 
                ? "Synchronizing Registry..." 
                : formData.inseminationDetails.status !== 'in-progress' 
                  ? "Save AI Record" 
                  : "Schedule AI Visit"
              }
            </button>


          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default WalkInAIModal;
