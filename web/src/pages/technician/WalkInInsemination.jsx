import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Syringe, User, Activity, Search, MapPin, Phone, Mail,
  AlertCircle, AlertTriangle, BadgeCheck, History, ArrowLeft,
  CheckCircle2, Info, Dna,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import { CATTLE_BREEDS, CATTLE_SPECIES } from "../../constants/breeds";
import { getSireCodeByBreed } from "../../constants/sireRegistry";
import { OTON_BARANGAYS } from "../../constants/barangays";
import { checkInseminationAgeEligibility, verifyPostpartumWindow } from "../../utils/cattleCore";

const inputClass = `w-full h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none transition-all`;
const selectClass = `w-full h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-emerald-500 focus:outline-none transition-all appearance-none cursor-pointer`;
const labelClass = `text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 block mb-1.5`;
const cardClass = `bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5`;

export default function WalkInInsemination() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  // --- MODE: existing record lookup or full new registration ---
  const [isExistingRecord, setIsExistingRecord] = useState(true);

  // Existing-record lookup state
  const [searchFarmer, setSearchFarmer] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedFarmerId, setSelectedFarmerId] = useState("");
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [showPregnancyWarning, setShowPregnancyWarning] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [ageWarning, setAgeWarning] = useState("");
  const [vwpWarning, setVwpWarning] = useState("");

  // Barangay autocomplete for new-entry mode
  const [isBarangayDropdownOpen, setIsBarangayDropdownOpen] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",
    address: { barangay: "", city: "Oton" },
    animalDetails: { earTag: "", species: "Beef Cattle", breed: "" },
    inseminationDetails: {
      inseminationDate: new Date().toISOString().split("T")[0],
      time: "08:00",
      sireBreed: "",
      sireCode: `SIRE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      estrus: "Natural",
      status: "done",
    },
  });

  // --- QUERIES ---
  const { data: farmers = [] } = useQuery({
    queryKey: ["farmers", "list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=farmer");
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
  });

  const { data: animals = [], isLoading: isLoadingAnimals } = useQuery({
    queryKey: ["farmer-animals", selectedFarmerId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/animals/farmer/${selectedFarmerId}`);
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: !!selectedFarmerId && isExistingRecord,
  });

  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const res = await axiosInstance.get("/config");
      return res.data;
    },
  });

  // --- MUTATIONS ---
  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.post("/technician/walk-in-insemination", data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("AI Transaction recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["farmer-animals"] });
      navigate(-1);
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

  // --- HANDLERS ---
  const handleAnimalChange = (animalId) => {
    setSelectedAnimalId(animalId);
    const animal = animals.find((a) => a._id === animalId);
    if (!animal) {
      setShowPregnancyWarning(false);
      setAgeWarning("");
      setVwpWarning("");
      return;
    }
    setShowPregnancyWarning(animal.reproductiveStatus === "Pregnant");
    if (animal.birthDate) {
      const ageCheck = checkInseminationAgeEligibility(animal.birthDate, animal.species);
      setAgeWarning(ageCheck.isEligible ? "" : ageCheck.reason);
    }
    if (animal.lastCalvingDate) {
      const vwpCheck = verifyPostpartumWindow(
        animal.lastCalvingDate,
        formData.inseminationDetails.inseminationDate || new Date(),
        animal.species
      );
      setVwpWarning(
        vwpCheck.isSafe
          ? ""
          : `Postpartum Voluntary Waiting Period violated. Only ${vwpCheck.daysPassed} days have passed since calving. Minimum is ${vwpCheck.requiredDays} days.`
      );
    }
  };

  const handleSireBreedChange = (breed) => {
    const code = getSireCodeByBreed(breed) || formData.inseminationDetails.sireCode;
    setFormData({
      ...formData,
      inseminationDetails: { ...formData.inseminationDetails, sireBreed: breed, sireCode: code },
    });
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    let submissionData;

    if (isExistingRecord) {
      if (!selectedFarmerId || !selectedAnimalId) {
        return toast.error("Please select both a farmer and an animal.");
      }
      const farmer = farmers.find((f) => f._id === selectedFarmerId);
      const animal = animals.find((a) => a._id === selectedAnimalId);
      if (animal?.gender === "Male") {
        return toast.error("Insemination is restricted to female animals only.");
      }
      submissionData = {
        farmerId: selectedFarmerId,
        animalId: selectedAnimalId,
        firstName: farmer.name.split(" ")[0],
        lastName: farmer.name.split(" ").slice(1).join(" "),
        phoneNumber: farmer.phoneNumber || "",
        email: farmer.email || "",
        address: typeof farmer.address === "string" ? farmer.address : farmer.address?.street || "",
        animalDetails: { earTag: animal.earTag, species: animal.species, breed: animal.breed },
        inseminationDetails: formData.inseminationDetails,
      };
    } else {
      if (!formData.firstName || !formData.lastName || !formData.phoneNumber || !formData.address.barangay) {
        return toast.error("Please fill in all owner details (First Name, Last Name, Phone, and Barangay).");
      }
      if (formData.phoneNumber.length < 10) {
        return toast.error("Phone number must be at least 10 digits.");
      }
      if (!formData.animalDetails.earTag || !formData.animalDetails.breed) {
        return toast.error("Please fill in animal Ear Tag and Breed details.");
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

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/80 px-8 h-16 flex items-center shrink-0 gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-bold text-xs uppercase tracking-widest transition-all group cursor-pointer"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Back
        </button>
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />
        <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
          <Syringe size={16} />
        </div>
        <div>
          <h1 className="text-sm font-black text-slate-900 dark:text-white leading-none">Walk-In AI Registration</h1>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Field Protocol: Register new farmer, specimen & procedure in one cycle</p>
        </div>

        {config?.isHoliday && (
          <div className="ml-auto flex items-center gap-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 px-4 py-2 rounded-xl">
            <AlertCircle size={14} className="text-rose-500" />
            <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">Off-Schedule Entry</span>
          </div>
        )}
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto space-y-5">

          {/* Mode / Status Toggle Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            {/* Record mode toggle */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsExistingRecord(true)}
                className={`px-5 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${isExistingRecord ? "bg-[#074033] text-white shadow-md" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
              >
                Existing Record
              </button>
              <button
                type="button"
                onClick={() => setIsExistingRecord(false)}
                className={`px-5 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${!isExistingRecord ? "bg-[#074033] text-white shadow-md" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
              >
                Full Registration
              </button>
            </div>

            {/* Status toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, inseminationDetails: { ...formData.inseminationDetails, status: "done" } })}
                className={`px-4 h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${formData.inseminationDetails.status !== "in-progress" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "border-slate-200 dark:border-slate-800 text-slate-400"}`}
              >
                Service Completed
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, inseminationDetails: { ...formData.inseminationDetails, status: "in-progress" } })}
                className={`px-4 h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${formData.inseminationDetails.status === "in-progress" ? "bg-blue-500/10 border-blue-500/20 text-blue-600" : "border-slate-200 dark:border-slate-800 text-slate-400"}`}
              >
                Schedule Visit
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* LEFT: Main Form */}
            <div className="xl:col-span-2 space-y-5">

              {/* --- EXISTING RECORD MODE --- */}
              {isExistingRecord ? (
                <div className={cardClass}>
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <BadgeCheck size={14} className="text-emerald-500" />
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Registry Selection</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Farmer search */}
                    <div className="space-y-1.5">
                      <label className={labelClass}>Farmer Record</label>
                      <div className="relative">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={searchFarmer}
                          onChange={(e) => { setSearchFarmer(e.target.value); setIsDropdownOpen(true); }}
                          onFocus={() => setIsDropdownOpen(true)}
                          placeholder="Search farmer name..."
                          className={`${inputClass} pl-10`}
                        />
                        <AnimatePresence>
                          {isDropdownOpen && searchFarmer && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-xl rounded-xl custom-scrollbar"
                            >
                              {farmers.filter((f) => f.name.toLowerCase().includes(searchFarmer.toLowerCase())).length > 0
                                ? farmers
                                    .filter((f) => f.name.toLowerCase().includes(searchFarmer.toLowerCase()))
                                    .map((farmer) => (
                                      <button
                                        key={farmer._id}
                                        onClick={() => { setSelectedFarmerId(farmer._id); setSelectedAnimalId(""); setSearchFarmer(farmer.name); setIsDropdownOpen(false); }}
                                        className="w-full px-4 py-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer flex flex-col gap-0.5"
                                      >
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{farmer.name}</span>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                          {farmer.phoneNumber || "No Contact"} • {typeof farmer.address === "string" ? farmer.address : farmer.address?.barangay || "No Address"}
                                        </span>
                                      </button>
                                    ))
                                : (
                                  <div className="py-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">No records found</div>
                                )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Animal select */}
                    <div className="space-y-1.5">
                      <label className={labelClass}>Animal Asset</label>
                      <select
                        disabled={!selectedFarmerId || isLoadingAnimals}
                        value={selectedAnimalId}
                        onChange={(e) => handleAnimalChange(e.target.value)}
                        className={`${selectClass} disabled:opacity-50 ${showPregnancyWarning ? "border-rose-400" : ""}`}
                      >
                        <option value="">{isLoadingAnimals ? "Synchronizing..." : "Select animal"}</option>
                        {animals.map((a) => (
                          <option key={a._id} value={a._id} disabled={a.gender === "Male"}>
                            Tag #{a.earTag} ({a.breed}) — {a.reproductiveStatus || "Normal"}{a.gender === "Male" ? " (Male - Restricted)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Sire selection for existing record */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="space-y-1.5">
                      <label className={labelClass}>Sire Breed</label>
                      <select
                        value={formData.inseminationDetails.sireBreed}
                        onChange={(e) => handleSireBreedChange(e.target.value)}
                        className={selectClass}
                      >
                        <option value="" disabled>Select Sire Breed</option>
                        {CATTLE_BREEDS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Sire Code (Auto)</label>
                      <div className="relative">
                        <Dna size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          readOnly
                          value={formData.inseminationDetails.sireCode}
                          placeholder="Auto-generated"
                          className={`${inputClass} pl-10 cursor-not-allowed opacity-60`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Warnings */}
                  <AnimatePresence>
                    {showPregnancyWarning && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Pregnancy Warning</h4>
                              <p className="text-[10px] font-medium text-rose-500/70 dark:text-rose-500/50 mt-1">Asset recorded as PREGNANT. Insemination is risky without field confirmation.</p>
                            </div>
                          </div>
                          <button
                            onClick={() => overrideMutation.mutate(selectedAnimalId)}
                            disabled={overrideMutation.isPending}
                            className="shrink-0 px-5 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
                          >
                            {overrideMutation.isPending ? "Updating..." : "Override Status"}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <AnimatePresence>
                    {ageWarning && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex items-start gap-3">
                          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Age Eligibility Warning</h4>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">{ageWarning}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <AnimatePresence>
                    {vwpWarning && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex items-start gap-3">
                          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Postpartum Window Warning</h4>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">{vwpWarning}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* --- FULL REGISTRATION MODE --- */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Owner Data */}
                  <div className={cardClass}>
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <User size={14} className="text-emerald-500" />
                      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Owner Data</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className={labelClass}>First Name *</label>
                        <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} placeholder="JUAN" className={inputClass} />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelClass}>Last Name *</label>
                        <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} placeholder="DELA CRUZ" className={inputClass} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Email (Optional)</label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="juan@example.com" className={`${inputClass} pl-10`} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Contact Number *</label>
                      <div className="relative flex items-center">
                        <Phone size={14} className="absolute left-4 z-10 text-slate-400" />
                        <div className="absolute left-10 z-10 text-xs font-bold text-slate-500 border-r border-slate-200 dark:border-slate-700 pr-2 py-1">+63</div>
                        <input
                          type="tel" maxLength={10}
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, "") })}
                          placeholder="917 XXX XXXX"
                          className={`${inputClass} pl-[84px]`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 relative">
                        <label className={labelClass}>Barangay *</label>
                        <div className="relative">
                          <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={formData.address.barangay}
                            onChange={(e) => { setFormData({ ...formData, address: { ...formData.address, barangay: e.target.value } }); setIsBarangayDropdownOpen(true); }}
                            onFocus={() => setIsBarangayDropdownOpen(true)}
                            placeholder="Search barangay..."
                            className={`${inputClass} pl-10`}
                          />
                          <AnimatePresence>
                            {isBarangayDropdownOpen && formData.address.barangay && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-xl rounded-xl custom-scrollbar"
                              >
                                {OTON_BARANGAYS.filter((b) => b.toLowerCase().includes(formData.address.barangay.toLowerCase())).length > 0
                                  ? OTON_BARANGAYS.filter((b) => b.toLowerCase().includes(formData.address.barangay.toLowerCase())).map((brgy) => (
                                      <button
                                        key={brgy}
                                        onClick={() => { setFormData({ ...formData, address: { ...formData.address, barangay: brgy } }); setIsBarangayDropdownOpen(false); }}
                                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer"
                                      >{brgy}</button>
                                    ))
                                  : <div className="py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">No matches found</div>
                                }
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelClass}>Municipality</label>
                        <input type="text" value={formData.address.city} onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })} placeholder="Oton" className={inputClass} />
                      </div>
                    </div>
                  </div>

                  {/* Animal / Asset Profile */}
                  <div className={cardClass}>
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <Activity size={14} className="text-emerald-500" />
                      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Animal Profile</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className={labelClass}>Ear Tag *</label>
                        <input type="text" maxLength={10} value={formData.animalDetails.earTag} onChange={(e) => setFormData({ ...formData, animalDetails: { ...formData.animalDetails, earTag: e.target.value.toUpperCase() } })} placeholder="TAG-0104" className={inputClass} />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelClass}>Species</label>
                        <select value={formData.animalDetails.species} onChange={(e) => setFormData({ ...formData, animalDetails: { ...formData.animalDetails, species: e.target.value } })} className={selectClass}>
                          {CATTLE_SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Breed *</label>
                      <select value={formData.animalDetails.breed} onChange={(e) => setFormData({ ...formData, animalDetails: { ...formData.animalDetails, breed: e.target.value } })} className={selectClass}>
                        <option value="" disabled>Select Breed</option>
                        {CATTLE_BREEDS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                      <div className="space-y-1.5">
                        <label className={labelClass}>Sire Breed *</label>
                        <select value={formData.inseminationDetails.sireBreed} onChange={(e) => handleSireBreedChange(e.target.value)} className={selectClass}>
                          <option value="" disabled>Select Sire Breed</option>
                          {CATTLE_BREEDS.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelClass}>Sire Code (Auto)</label>
                        <div className="relative">
                          <Dna size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input type="text" readOnly value={formData.inseminationDetails.sireCode} placeholder="Auto-generated" className={`${inputClass} pl-10 cursor-not-allowed opacity-60`} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Service Metrics — always shown */}
              <div className={cardClass}>
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <History size={14} className="text-emerald-500" />
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Service Metrics</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Mission Date</label>
                    <input
                      type="date"
                      value={formData.inseminationDetails.inseminationDate}
                      onChange={(e) => setFormData({ ...formData, inseminationDetails: { ...formData.inseminationDetails, inseminationDate: e.target.value } })}
                      className={`${inputClass} cursor-pointer`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>T-Time</label>
                    <input
                      type="time"
                      value={formData.inseminationDetails.time}
                      onChange={(e) => setFormData({ ...formData, inseminationDetails: { ...formData.inseminationDetails, time: e.target.value } })}
                      className={`${inputClass} cursor-pointer`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Estrus Cycle</label>
                    <select
                      value={formData.inseminationDetails.estrus}
                      onChange={(e) => setFormData({ ...formData, inseminationDetails: { ...formData.inseminationDetails, estrus: e.target.value } })}
                      className={selectClass}
                    >
                      <option>Natural</option>
                      <option>Synchronized</option>
                      <option>Induced</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Action Panel + Tips */}
            <div className="space-y-5">
              {/* Submit Card */}
              <div className="bg-[#074033] dark:bg-emerald-800 rounded-2xl p-6 text-white shadow-xl shadow-emerald-950/20 sticky top-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <Syringe size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">AI Protocol</p>
                    <p className="text-sm font-black uppercase tracking-tight leading-none mt-0.5">
                      {formData.inseminationDetails.status === "done" ? "Record Service" : "Schedule Visit"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-6 text-[10px] font-semibold text-emerald-100/50 uppercase tracking-wider">
                  <div className="flex justify-between">
                    <span>Mode</span>
                    <span className="text-white font-black">{isExistingRecord ? "Existing Record" : "Full Registration"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status</span>
                    <span className={`font-black ${formData.inseminationDetails.status === "done" ? "text-emerald-300" : "text-blue-300"}`}>
                      {formData.inseminationDetails.status === "done" ? "Completed" : "Scheduled"}
                    </span>
                  </div>
                  {formData.inseminationDetails.sireBreed && (
                    <div className="flex justify-between">
                      <span>Sire</span>
                      <span className="text-white font-black">{formData.inseminationDetails.sireBreed}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={mutation.isPending || (showPregnancyWarning && !isOverriding)}
                  className={`w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    formData.inseminationDetails.status === "done"
                      ? "bg-white text-[#074033] hover:bg-emerald-50"
                      : "bg-blue-500 text-white hover:bg-blue-400"
                  }`}
                >
                  {mutation.isPending ? (
                    <span>Synchronizing...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      {formData.inseminationDetails.status === "done" ? "Commit AI Record" : "Schedule AI Visit"}
                    </>
                  )}
                </button>
              </div>

              {/* Quick Guidance */}
              <div className={cardClass}>
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <Info size={13} className="text-slate-400" />
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Quick Guidance</h4>
                </div>
                <ul className="space-y-3">
                  {[
                    "Use Existing Record for registered farmers & animals",
                    "Verify animal age & species eligibility before proceeding",
                    "Double-check sire breed — code is auto-generated",
                    "Male animals are strictly excluded from AI procedures",
                    "Pregnant animals require override confirmation",
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[9px] font-black text-slate-400 shrink-0 mt-0.5">{i + 1}</div>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
