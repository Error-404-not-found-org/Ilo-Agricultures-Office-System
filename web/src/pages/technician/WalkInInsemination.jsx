import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Syringe, User, Binary, Info, CheckCircle2, ArrowLeft, AlertTriangle, Phone, Mail, MapPin, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import { CATTLE_BREEDS, CATTLE_SPECIES } from "../../constants/breeds";
import { getSireCodeByBreed } from "../../constants/sireRegistry";
import { OTON_BARANGAYS } from "../../constants/barangays";
import { checkInseminationAgeEligibility } from "../../utils/cattleCore";
import LoadingView from "../../components/LoadingView";

const inputClass = `h-14 bg-base-200 border-none rounded-2xl px-6 font-bold text-sm focus:ring-2 focus:ring-emerald-500 transition-all text-base-content placeholder:text-base-content/25 w-full`;
const selectClass = `h-14 bg-base-200 border-none rounded-2xl px-6 font-bold text-sm focus:ring-2 focus:ring-emerald-500 transition-all text-base-content appearance-none w-full cursor-pointer`;
const labelClass = `text-[10px] font-black uppercase tracking-widest text-base-content/30 ml-1 mb-2 block`;

export default function WalkInInsemination() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",
    address: {
      barangay: "",
      city: "Oton"
    },
    animalDetails: {
      earTag: "",
      species: "Beef Cattle",
      breed: "",
      birthDate: "",
      gender: "Female",
    },
    inseminationDetails: {
      inseminationDate: new Date().toISOString().split("T")[0],
      time: "08:00",
      sireBreed: "",
      sireCode: "",
      estrus: "Natural",
      status: "done",
    }
  });

  const [ageWarning, setAgeWarning] = useState("");
  const [isBarangayDropdownOpen, setIsBarangayDropdownOpen] = useState(false);

  useEffect(() => {
    setTimeout(() => setLoading(false), 500);
  }, []);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.post("/technician/walk-in-insemination", data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("AI Transaction recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      navigate(-1);
    },
    onError: (error) => {
      toast.error("Failed to record AI: " + (error.response?.data?.message || error.message));
    },
  });

  // Calculate age eligibility check dynamically
  const handleAnimalFieldChange = (field, value) => {
    const updatedAnimalDetails = {
      ...formData.animalDetails,
      [field]: value
    };
    
    setFormData({
      ...formData,
      animalDetails: updatedAnimalDetails
    });

    if (field === "birthDate" || field === "species") {
      const bDate = field === "birthDate" ? value : formData.animalDetails.birthDate;
      const spec = field === "species" ? value : formData.animalDetails.species;
      
      if (bDate) {
        const check = checkInseminationAgeEligibility(bDate, spec);
        if (!check.isEligible) {
          setAgeWarning(check.reason);
        } else {
          setAgeWarning("");
        }
      } else {
        setAgeWarning("");
      }
    }
  };

  const handleSireBreedChange = (breed) => {
    const code = getSireCodeByBreed(breed) || `SIRE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    setFormData({
      ...formData,
      inseminationDetails: {
        ...formData.inseminationDetails,
        sireBreed: breed,
        sireCode: code
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validations
    if (!formData.firstName || !formData.lastName || !formData.phoneNumber || !formData.address.barangay) {
      return toast.error("Please fill in all owner details (First Name, Last Name, Phone, and Barangay).");
    }
    
    if (formData.phoneNumber.length < 10) {
      return toast.error("Phone number must be at least 10 digits.");
    }

    if (!formData.animalDetails.earTag || !formData.animalDetails.breed) {
      return toast.error("Please fill in animal Ear Tag and Breed details.");
    }

    if (formData.animalDetails.gender !== "Female") {
      return toast.error("Insemination is restricted to female animals only. This animal is registered as Male.");
    }

    if (!formData.inseminationDetails.sireBreed) {
      return toast.error("Please select a Sire Breed.");
    }

    // Prepare submission data matching the API schema
    const submissionData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phoneNumber: formData.phoneNumber,
      email: formData.email || undefined,
      address: {
        barangay: formData.address.barangay,
        city: formData.address.city,
        province: "Iloilo",
        street: ""
      },
      animalDetails: {
        earTag: formData.animalDetails.earTag,
        species: formData.animalDetails.species,
        breed: formData.animalDetails.breed,
        birthDate: formData.animalDetails.birthDate || undefined,
        gender: formData.animalDetails.gender,
      },
      inseminationDetails: formData.inseminationDetails
    };

    mutation.mutate(submissionData);
  };

  if (loading) return <LoadingView message="Initializing Field Protocol..." />;

  // Support extended species in technician console
  const ALL_SPECIES = ["Beef Cattle", "Dairy Cattle", "Carabao", "Swine", "Goat"];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-base-content/40 hover:text-emerald-500 font-black uppercase text-[10px] tracking-widest transition-all mb-4 group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Console
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#074033] dark:bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
              <Syringe className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-base-content tracking-tighter uppercase leading-none">
                Walk-in Registration
              </h1>
              <p className="text-base-content/40 font-black uppercase tracking-widest text-[9px] flex items-center gap-2 mt-3 leading-none">
                <Info size={14} className="text-emerald-500 shrink-0" />
                Field Protocol: Register new farmer, specimen, and procedure in one cycle.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form Area */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Farmer Details */}
          <div className="bg-base-100 rounded-3xl p-8 shadow-xl border border-base-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity pointer-events-none">
              <User size={120} />
            </div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Farmer Identity
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <div className="form-control">
                <label className="label py-0 mb-1">
                  <span className={labelClass}>First Name *</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="John"
                  className={inputClass}
                />
              </div>
              <div className="form-control">
                <label className="label py-0 mb-1">
                  <span className={labelClass}>Last Name *</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Doe"
                  className={inputClass}
                />
              </div>
              <div className="form-control">
                <label className="label py-0 mb-1">
                  <span className={labelClass}>Contact Number *</span>
                </label>
                <div className="relative flex items-center">
                  <Phone size={16} className="absolute left-6 text-base-content/20" />
                  <div className="absolute left-12 text-xs font-bold text-base-content/50 border-r border-base-300 pr-2 py-1">+63</div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={formData.phoneNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setFormData({ ...formData, phoneNumber: val });
                    }}
                    placeholder="917 XXX XXXX"
                    className={`${inputClass} pl-[86px]`}
                  />
                </div>
              </div>
              <div className="form-control">
                <label className="label py-0 mb-1">
                  <span className={labelClass}>Email Address (Optional)</span>
                </label>
                <div className="relative flex items-center">
                  <Mail size={16} className="absolute left-6 text-base-content/20" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="farmer@example.com"
                    className={`${inputClass} pl-12`}
                  />
                </div>
              </div>
              
              <div className="form-control md:col-span-2 relative">
                <label className="label py-0 mb-1">
                  <span className={labelClass}>Barangay *</span>
                </label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-base-content/20" />
                  <input
                    type="text"
                    required
                    value={formData.address.barangay}
                    onChange={(e) => {
                      setFormData({ ...formData, address: { ...formData.address, barangay: e.target.value } });
                      setIsBarangayDropdownOpen(true);
                    }}
                    onFocus={() => setIsBarangayDropdownOpen(true)}
                    placeholder="Search Barangay in Oton..."
                    className={`${inputClass} pl-12`}
                  />
                  <AnimatePresence>
                    {isBarangayDropdownOpen && formData.address.barangay && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto border border-base-300 bg-base-100 shadow-xl rounded-2xl custom-scrollbar"
                      >
                        {OTON_BARANGAYS.filter((b) =>
                          b.toLowerCase().includes(formData.address.barangay.toLowerCase())
                        ).length > 0 ? (
                          OTON_BARANGAYS
                            .filter((b) => b.toLowerCase().includes(formData.address.barangay.toLowerCase()))
                            .map((brgy) => (
                              <button
                                type="button"
                                key={brgy}
                                onClick={() => {
                                  setFormData({ ...formData, address: { ...formData.address, barangay: brgy } });
                                  setIsBarangayDropdownOpen(false);
                                }}
                                className="w-full px-6 py-3 text-left transition-colors hover:bg-emerald-500/10 border-b border-base-200/50 last:border-0 cursor-pointer block text-xs font-bold text-base-content"
                              >
                                {brgy}
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
            </div>
          </div>

          {/* Animal Details */}
          <div className="bg-base-100 rounded-3xl p-8 shadow-xl border border-base-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity pointer-events-none">
              <Binary size={120} />
            </div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Specimen Metadata
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <div className="form-control">
                <label className="label py-0 mb-1">
                  <span className={labelClass}>Ear Tag ID *</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={formData.animalDetails.earTag}
                  onChange={(e) => handleAnimalFieldChange("earTag", e.target.value.toUpperCase())}
                  placeholder="TAG-0104"
                  className={inputClass}
                />
              </div>
              <div className="form-control">
                <label className="label py-0 mb-1">
                  <span className={labelClass}>Species *</span>
                </label>
                <select
                  value={formData.animalDetails.species}
                  onChange={(e) => handleAnimalFieldChange("species", e.target.value)}
                  className={selectClass}
                >
                  {ALL_SPECIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-control">
                <label className="label py-0 mb-1">
                  <span className={labelClass}>Breed Type *</span>
                </label>
                <select
                  value={formData.animalDetails.breed}
                  onChange={(e) => handleAnimalFieldChange("breed", e.target.value)}
                  className={selectClass}
                  required
                >
                  <option value="" disabled>Select Breed</option>
                  {CATTLE_BREEDS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label py-0 mb-1">
                  <span className={labelClass}>Gender / Sex *</span>
                </label>
                <select
                  value={formData.animalDetails.gender}
                  onChange={(e) => handleAnimalFieldChange("gender", e.target.value)}
                  className={`${selectClass} ${formData.animalDetails.gender === "Male" ? "text-rose-500" : ""}`}
                >
                  <option value="Female">Female (Breeding Stock)</option>
                  <option value="Male">Male (Insemination Restricted)</option>
                </select>
              </div>

              <div className="form-control md:col-span-2">
                <label className="label py-0 mb-1">
                  <span className={labelClass}>Birth Date (Required for Age Check)</span>
                </label>
                <input
                  type="date"
                  value={formData.animalDetails.birthDate}
                  onChange={(e) => handleAnimalFieldChange("birthDate", e.target.value)}
                  className={inputClass}
                />
              </div>
              
              {/* Warnings display */}
              <div className="md:col-span-2 space-y-3">
                <AnimatePresence>
                  {formData.animalDetails.gender === "Male" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 flex items-start gap-3">
                        <AlertTriangle size={20} className="text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest leading-none">Gender Restriction Error</h4>
                          <p className="text-[11px] font-medium text-rose-500 mt-2 leading-tight">
                            Artificial Insemination cannot be performed on Male animals. Please register a female animal to proceed.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <AnimatePresence>
                  {ageWarning && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-3">
                        <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">Age Eligibility Warning</h4>
                          <p className="text-[11px] font-medium text-base-content/85 mt-2 leading-tight">
                            {ageWarning}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#074033] dark:bg-emerald-600 rounded-3xl p-8 shadow-2xl shadow-emerald-900/20 text-white relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-[0.04] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
              <Syringe size={160} />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-8">AI Procedure</h3>
            <div className="space-y-6 relative z-10">
              
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest opacity-35 mb-2 block">Insemination Date</label>
                <input
                  type="date"
                  required
                  value={formData.inseminationDetails.inseminationDate}
                  onChange={(e) => setFormData({
                    ...formData,
                    inseminationDetails: { ...formData.inseminationDetails, inseminationDate: e.target.value }
                  })}
                  className="w-full h-12 bg-white/10 border-none rounded-xl px-5 font-bold text-xs focus:ring-2 focus:ring-white/30 transition-all text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest opacity-35 mb-2 block">Time</label>
                <input
                  type="time"
                  required
                  value={formData.inseminationDetails.time}
                  onChange={(e) => setFormData({
                    ...formData,
                    inseminationDetails: { ...formData.inseminationDetails, time: e.target.value }
                  })}
                  className="w-full h-12 bg-white/10 border-none rounded-xl px-5 font-bold text-xs focus:ring-2 focus:ring-white/30 transition-all text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest opacity-35 mb-2 block">Sire Breed</label>
                <select
                  required
                  value={formData.inseminationDetails.sireBreed}
                  onChange={(e) => handleSireBreedChange(e.target.value)}
                  className="w-full h-12 bg-white/10 border-none rounded-xl px-5 font-bold text-xs focus:ring-2 focus:ring-white/30 transition-all text-white cursor-pointer"
                >
                  <option value="" disabled className="text-emerald-950">Select Sire Breed</option>
                  {CATTLE_BREEDS.map((b) => (
                    <option key={b} value={b} className="text-emerald-950">{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest opacity-35 mb-2 block">Sire Code</label>
                <input
                  type="text"
                  readOnly
                  value={formData.inseminationDetails.sireCode}
                  placeholder="Auto-generated"
                  className="w-full h-12 bg-white/5 border-none rounded-xl px-5 font-bold text-xs cursor-not-allowed text-white/50"
                />
              </div>

              <div className="h-px bg-white/10 my-4" />
              <button
                type="submit"
                disabled={mutation.isPending || formData.animalDetails.gender === "Male"}
                className={`w-full h-16 bg-white text-emerald-900 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {mutation.isPending ? (
                  <span>Recording...</span>
                ) : (
                  <>
                    <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform text-emerald-800" />
                    Commit Cycle
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-base-100 rounded-3xl p-8 shadow-xl border border-base-300">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-4">Quick Guidance</h4>
            <ul className="space-y-4">
              {[
                "Ensure correct farmer phone for invitations",
                "Verify animal age & species eligibility",
                "Double-check sire breed details",
                "Male animals are strictly excluded from AI",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-3 text-xs font-bold text-base-content uppercase tracking-tighter opacity-70">
                  <div className="w-5 h-5 rounded-lg bg-base-200 flex items-center justify-center text-[10px] shrink-0 border border-base-300 font-black">{i+1}</div>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </form>
    </div>
  );
}
