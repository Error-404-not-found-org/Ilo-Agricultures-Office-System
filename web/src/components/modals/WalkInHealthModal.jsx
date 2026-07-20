import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  HeartPulse,
  User,
  Activity,
  Search,
  Phone,
  MapPin,
  Calendar,
  Stethoscope,
  BadgeCheck,
  StickyNote,
  Mail,
  ChevronDown,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import {
  CATTLE_BREEDS,
  CATTLE_SPECIES,
  BREED_OPTIONS_BY_SPECIES,
} from "../../constants/breeds";
import {
  formatBarangayWithDistrict,
  getIloiloBarangayOptions,
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
} from "../../utils/addressOptions";

const inputClass = `w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-sm font-semibold text-base-content placeholder:text-base-content/55 focus:border-primary focus:outline-none transition-all`;
const selectClass = `w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-sm font-semibold text-base-content focus:border-primary focus:outline-none transition-all appearance-none`;
const textareaClass = `w-full min-h-[120px] bg-base-200 border border-base-300 rounded-xl pl-12 pr-4 py-4 text-xs font-bold text-base-content placeholder:text-base-content/25 focus:border-emerald-500 focus:outline-none transition-all resize-none`;
const labelClass = `text-[11px] font-bold text-base-content/70 tracking-wide ml-1`;
const sectionClass = `bg-base-200/40 border border-base-300 rounded-2xl p-4 space-y-4`;

const WalkInHealthModal = ({
  isOpen,
  onClose,
  onSuccess,
  prefillData,
  existingOnly = false,
}) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [isExistingRecord, setIsExistingRecord] = useState(true);
  const [selectedFarmerId, setSelectedFarmerId] = useState("");
  const [searchFarmer, setSearchFarmer] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [isBarangayDropdownOpen, setIsBarangayDropdownOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState("");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",
    address: {
      barangay: "",
      city: "Oton",
    },
    animalDetails: {
      earTag: "",
      species: "Beef Cattle",
      breed: "",
    },
    requestType: "disease",
    urgency: "medium",
    status: "resolved",
    preferredDate: new Date().toISOString().split("T")[0],
    preferredTime: "08:00",
    diagnosis: "",
    treatment: "",
    advice: "",
    technicianNote: "",
    followUpDate: "",
    withdrawalPeriodDays: "",
  });

  const targetBarangays = useMemo(() => {
    const selectedCity = formData.address?.city || "Oton";
    return getIloiloBarangayOptions(selectedCity, selectedDistrict);
  }, [formData.address?.city, selectedDistrict]);

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
      const res = await axiosInstance.get(
        `/animals/farmer/${selectedFarmerId}`,
      );
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: !!selectedFarmerId && isExistingRecord,
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      if (existingOnly) Promise.resolve().then(() => setIsExistingRecord(true));
    }
    if (isOpen && prefillData) {
      Promise.resolve().then(() => {
        setFormData((prev) => ({
          ...prev,
          firstName: prefillData.farmerName?.split(" ")[0] || "",
          lastName: prefillData.farmerName?.split(" ").slice(1).join(" ") || "",
          animalDetails: {
            ...prev.animalDetails,
            earTag: prefillData.earTag || "",
          },
        }));
        setIsExistingRecord(false);
      });
    } else if (!isOpen) {
      Promise.resolve().then(() => {
        setIsExistingRecord(true);
        setSelectedFarmerId("");
        setSearchFarmer("");
        setIsDropdownOpen(false);
        setSelectedAnimalId("");
        setIsBarangayDropdownOpen(false);
        setSelectedDistrict("");
        setFormData({
          firstName: "",
          lastName: "",
          phoneNumber: "",
          email: "",
          address: {
            barangay: "",
            city: "Oton",
          },
          animalDetails: {
            earTag: "",
            species: "Beef Cattle",
            breed: "",
          },
          requestType: "disease",
          urgency: "medium",
          status: "resolved",
          preferredDate: new Date().toISOString().split("T")[0],
          preferredTime: "08:00",
          diagnosis: "",
          treatment: "",
          advice: "",
          technicianNote: "",
          followUpDate: "",
          withdrawalPeriodDays: "",
        });
      });
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, prefillData, onClose, existingOnly]);

  useEffect(() => {
    if (formData.animalDetails.species) {
      const validBreeds =
        BREED_OPTIONS_BY_SPECIES[formData.animalDetails.species] || [];
      if (
        formData.animalDetails.breed &&
        !validBreeds.includes(formData.animalDetails.breed)
      ) {
        Promise.resolve().then(() => {
          setFormData((prev) => ({
            ...prev,
            animalDetails: { ...prev.animalDetails, breed: "" },
          }));
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.animalDetails.species]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.post("/health-request/walk-in", data);
      return res.data;
    },
    onSuccess: () => {
      toast.success(
        formData.status === "resolved"
          ? "Health record saved!"
          : "Visit scheduled successfully!",
      );
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(
        "Failed to process request: " +
          (error.response?.data?.message || error.message),
      );
    },
  });

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
        address:
          typeof farmer.address === "string"
            ? farmer.address
            : farmer.address?.street || "",
        animalDetails: {
          earTag: animal.earTag,
          species: animal.species,
          breed: animal.breed,
        },
        ...formData,
      };
    } else {
      if (!formData.address.city) {
        return toast.error("Municipality or city is required.");
      }
      if (formData.address.city === ILOILO_CITY_NAME && !selectedDistrict) {
        return toast.error("Please select the Iloilo City district.");
      }
      if (!formData.address.barangay) {
        return toast.error("Barangay is required.");
      }
      if (!formData.phoneNumber || !formData.animalDetails.earTag) {
        return toast.error("Phone number and Ear Tag are required.");
      }
      if (formData.phoneNumber.length < 11) {
        return toast.error("Phone number must be exactly 11 digits.");
      }
      if (!formData.phoneNumber.startsWith("09")) {
        return toast.error("Phone number must start with 09.");
      }
      submissionData = {
        ...formData,
        address: {
          ...formData.address,
          barangay: formatBarangayWithDistrict(
            formData.address.barangay,
            formData.address.city,
            selectedDistrict,
          ),
          district:
            formData.address.city === ILOILO_CITY_NAME ? selectedDistrict : "",
        },
      };
    }

    if (!submissionData.diagnosis) {
      return toast.error("Please enter Findings/Symptoms.");
    }

    if (submissionData.status === "in-progress") {
      const selectedDateTime = new Date(
        `${submissionData.preferredDate}T${submissionData.preferredTime}:00`,
      );
      if (selectedDateTime < new Date()) {
        return toast.error(
          "Cannot schedule a visit for a date and time that has already passed.",
        );
      }
    }

    mutation.mutate(submissionData);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
        {/* MODAL */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl flex flex-col max-h-[86vh]"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-base-300 bg-base-200/40 px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                <HeartPulse size={20} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter text-base-content leading-none">
                  Record Health Assistance
                </h3>
                <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-base-content/25 leading-none">
                  Select an existing farmer and animal, then document the visit
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
          <div className="overflow-y-auto flex-1 custom-scrollbar p-5 space-y-5 bg-base-100">
            {/* TOGGLES */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-base-200/30 p-3 rounded-2xl border border-base-300">
              {!existingOnly && (
                <div className="inline-flex p-1 rounded-xl bg-base-100 border border-base-300">
                  <button
                    onClick={() => setIsExistingRecord(true)}
                    className={`px-5 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${isExistingRecord ? "bg-[#074033] text-white shadow-md" : "text-base-content/40 hover:text-base-content"}`}
                  >
                    Existing Record
                  </button>
                  <button
                    onClick={() => setIsExistingRecord(false)}
                    className={`px-5 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${!isExistingRecord ? "bg-[#074033] text-white shadow-md" : "text-base-content/40 hover:text-base-content"}`}
                  >
                    Manual Entry
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setFormData({ ...formData, status: "resolved" })
                  }
                  className={`px-4 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer ${formData.status === "resolved" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "border-transparent text-base-content/20"}`}
                >
                  Completed
                </button>
                <button
                  onClick={() =>
                    setFormData({ ...formData, status: "in-progress" })
                  }
                  className={`px-4 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer ${formData.status === "in-progress" ? "bg-blue-500/10 border-blue-500/20 text-blue-600" : "border-transparent text-base-content/20"}`}
                >
                  In progress
                </button>
              </div>
            </div>

            {isExistingRecord ? (
              <section className={sectionClass}>
                <div className="flex items-center gap-2 mb-1">
                  <BadgeCheck size={14} className="text-emerald-500" />
                  <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                    Farmer and animal
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Farmer</label>
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
                            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto border border-base-300 bg-base-100 shadow-xl rounded-xl custom-scrollbar"
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
                                    className="w-full px-4 py-3 text-left transition-colors hover:bg-emerald-500/10 flex flex-col gap-1 border-b border-base-200/50 last:border-0 cursor-pointer"
                                  >
                                    <span className="text-xs font-bold text-base-content block">
                                      {farmer.name}
                                    </span>
                                    <span className="text-[9px] font-black tracking-widest text-base-content/40 uppercase leading-none mt-0.5">
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
                  <div className="space-y-1.5">
                    <label className={labelClass}>Animal</label>
                    <div className="relative">
                      <select
                        disabled={!selectedFarmerId || isLoadingAnimals}
                        value={selectedAnimalId}
                        onChange={(e) => setSelectedAnimalId(e.target.value)}
                        className={`${selectClass} disabled:opacity-50 cursor-pointer`}
                      >
                        <option value="">
                          {isLoadingAnimals
                            ? "Synchronizing..."
                            : "Select animal"}
                        </option>
                        {animals.map((a) => (
                          <option key={a._id} value={a._id}>
                            Tag #{a.earTag} ({a.breed}) —{" "}
                            {a.reproductiveStatus || "Normal"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <section className={sectionClass}>
                  <div className="flex items-center gap-2 mb-1">
                    <User size={14} className="text-emerald-500" />
                    <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                      Owner Data
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className={labelClass}>First Name</label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            firstName: e.target.value,
                          })
                        }
                        placeholder="JUAN"
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Last Name</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) =>
                          setFormData({ ...formData, lastName: e.target.value })
                        }
                        placeholder="DELA CRUZ"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Email (For App Access)</label>
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                      />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="juan@example.com"
                        className={`${inputClass} pl-11`}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Contact Number</label>
                    <div className="relative">
                      <Phone
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                      />
                      <input
                        type="tel"
                        maxLength={11}
                        value={formData.phoneNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          if (val.length <= 11) {
                            setFormData({ ...formData, phoneNumber: val });
                          }
                        }}
                        placeholder="0912 345 6789"
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className={labelClass}>
                        Municipality / City *
                      </label>
                      <div className="relative">
                        <MapPin
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20 pointer-events-none"
                        />
                        <select
                          value={formData.address.city || "Oton"}
                          onChange={(e) => {
                            const newCity = e.target.value;
                            setSelectedDistrict("");
                            setFormData({
                              ...formData,
                              address: {
                                ...formData.address,
                                city: newCity,
                                barangay: "",
                              },
                            });
                          }}
                          className={`${selectClass} pl-11 pr-10 appearance-none cursor-pointer`}
                        >
                          {ILOILO_MUNICIPALITY_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={14}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"
                        />
                      </div>
                    </div>

                    {formData.address.city === ILOILO_CITY_NAME && (
                      <div className="space-y-1.5">
                        <label className={labelClass}>
                          Iloilo City District *
                        </label>
                        <div className="relative">
                          <MapPin
                            size={16}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20 pointer-events-none"
                          />
                          <select
                            value={selectedDistrict}
                            onChange={(e) => {
                              setSelectedDistrict(e.target.value);
                              setFormData({
                                ...formData,
                                address: { ...formData.address, barangay: "" },
                              });
                            }}
                            className={`${selectClass} pl-11 pr-10 appearance-none cursor-pointer`}
                          >
                            <option value="" disabled>
                              Select District
                            </option>
                            {ILOILO_CITY_DISTRICT_OPTIONS.map((district) => (
                              <option key={district} value={district}>
                                {district}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={14}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5 relative">
                      <label className={labelClass}>Barangay *</label>
                      <div className="relative">
                        <MapPin
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                        />
                        <input
                          type="text"
                          value={formData.address.barangay}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              address: {
                                ...formData.address,
                                barangay: e.target.value,
                              },
                            });
                            setIsBarangayDropdownOpen(true);
                          }}
                          onFocus={() => setIsBarangayDropdownOpen(true)}
                          placeholder={
                            formData.address.city === ILOILO_CITY_NAME &&
                            !selectedDistrict
                              ? "Select district first"
                              : "Search barangay..."
                          }
                          disabled={
                            formData.address.city === ILOILO_CITY_NAME &&
                            !selectedDistrict
                          }
                          className={`${inputClass} pl-11 disabled:opacity-50`}
                        />
                        <AnimatePresence>
                          {isBarangayDropdownOpen &&
                            formData.address.barangay && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto border border-base-300 bg-base-100 shadow-xl rounded-xl custom-scrollbar"
                              >
                                {targetBarangays.filter((b) =>
                                  b
                                    .toLowerCase()
                                    .includes(
                                      formData.address.barangay.toLowerCase(),
                                    ),
                                ).length > 0 ? (
                                  targetBarangays
                                    .filter((b) =>
                                      b
                                        .toLowerCase()
                                        .includes(
                                          formData.address.barangay.toLowerCase(),
                                        ),
                                    )
                                    .map((brgy) => (
                                      <button
                                        key={brgy}
                                        onClick={() => {
                                          setFormData({
                                            ...formData,
                                            address: {
                                              ...formData.address,
                                              barangay: brgy,
                                            },
                                          });
                                          setIsBarangayDropdownOpen(false);
                                        }}
                                        className="w-full px-4 py-3 text-left transition-colors hover:bg-emerald-500/10 border-b border-base-200/50 last:border-0 cursor-pointer"
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
                  </div>
                </section>

                <section className={sectionClass}>
                  <div className="flex items-center gap-2 mb-1">
                    <Activity size={14} className="text-emerald-500" />
                    <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                      Asset Profile
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className={labelClass}>Ear Tag</label>
                      <input
                        type="text"
                        maxLength={3}
                        value={formData.animalDetails.earTag}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            animalDetails: {
                              ...formData.animalDetails,
                              earTag: e.target.value.toUpperCase(),
                            },
                          })
                        }
                        placeholder="104"
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Species</label>
                      <select
                        value={formData.animalDetails.species}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            animalDetails: {
                              ...formData.animalDetails,
                              species: e.target.value,
                            },
                          })
                        }
                        className={`${selectClass} cursor-pointer`}
                      >
                        {CATTLE_SPECIES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Breed</label>
                    <select
                      value={formData.animalDetails.breed}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          animalDetails: {
                            ...formData.animalDetails,
                            breed: e.target.value,
                          },
                        })
                      }
                      className={`${selectClass} cursor-pointer`}
                    >
                      <option value="" disabled>
                        Select Breed
                      </option>
                      {(
                        BREED_OPTIONS_BY_SPECIES[
                          formData.animalDetails.species
                        ] || CATTLE_BREEDS
                      ).map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                </section>
              </div>
            )}

            {/* Service Logistics */}
            <section className={sectionClass}>
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={14} className="text-emerald-500" />
                <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                  Visit details
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>Service Type</label>
                  <div className="relative">
                    <select
                      value={formData.requestType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          requestType: e.target.value,
                        })
                      }
                      className={`${selectClass} cursor-pointer`}
                    >
                      <option value="disease">Disease Control</option>
                      <option value="medicine">Medicine/Supplies</option>
                      <option value="checkup">Routine Checkup</option>
                      <option value="injury">Injury Treatment</option>
                      <option value="vaccination">Vaccination</option>
                      <option value="deworming">Deworming</option>
                      <option value="other">Other Veterinary</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Visit date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.preferredDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          preferredDate: e.target.value,
                        })
                      }
                      className={`${inputClass} cursor-pointer`}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Visit time</label>
                  <div className="relative">
                    <input
                      type="time"
                      value={formData.preferredTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          preferredTime: e.target.value,
                        })
                      }
                      className={`${inputClass} cursor-pointer`}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-4 border-t border-base-300">
                <label className={labelClass}>Urgency</label>
                <div className="flex gap-4">
                  {["low", "medium", "high", "emergency"].map((u) => (
                    <button
                      key={u}
                      onClick={() => setFormData({ ...formData, urgency: u })}
                      className={`flex-1 h-11 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                        formData.urgency === u
                          ? u === "high" || u === "emergency"
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-600"
                            : u === "medium"
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                          : "border-base-300 text-base-content/40 hover:bg-base-200"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Medical Findings */}
            <section className={sectionClass}>
              <div className="flex items-center gap-2 mb-1">
                <StickyNote size={14} className="text-emerald-500" />
                <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                  Assessment and symptoms
                </h4>
              </div>
              <div className="relative">
                <textarea
                  value={formData.diagnosis}
                  onChange={(e) =>
                    setFormData({ ...formData, diagnosis: e.target.value })
                  }
                  placeholder={
                    formData.status === "resolved"
                      ? "DESCRIBE TREATMENT GIVEN AND RECOMMENDATIONS..."
                      : "DESCRIBE SYMPTOMS OR REASON FOR VISIT REQUEST..."
                  }
                  className={textareaClass}
                />
              </div>
            </section>

            {formData.status === "resolved" && (
              <>
                <section className={sectionClass}>
                  <div className="flex items-center gap-2 mb-1">
                    <Stethoscope size={14} className="text-emerald-500" />
                    <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                      Treatment and medicine
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className={labelClass}>Treatment Action</label>
                      <input
                        type="text"
                        value={formData.treatment}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            treatment: e.target.value,
                          })
                        }
                        placeholder="e.g. Wound cleaning, Injection..."
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Medicine & Dosage</label>
                      <input
                        type="text"
                        value={formData.advice}
                        onChange={(e) =>
                          setFormData({ ...formData, advice: e.target.value })
                        }
                        placeholder="e.g. Penicillin 10ml"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 border-t border-base-300 pt-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={labelClass}>Follow-up date</label>
                      <input
                        type="date"
                        value={formData.followUpDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            followUpDate: e.target.value,
                          })
                        }
                        className={`${inputClass} cursor-pointer`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>
                        Withdrawal period (days)
                      </label>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={formData.withdrawalPeriodDays}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            withdrawalPeriodDays: e.target.value,
                          })
                        }
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </section>

                <section className={sectionClass}>
                  <div className="flex items-center gap-2 mb-1">
                    <StickyNote size={14} className="text-emerald-500" />
                    <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                      Notes and follow-up
                    </h4>
                  </div>
                  <div className="relative">
                    <textarea
                      value={formData.technicianNote}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          technicianNote: e.target.value,
                        })
                      }
                      placeholder="Any other clinical signs noticed..."
                      className={textareaClass}
                    />
                  </div>
                </section>
              </>
            )}
          </div>

          {/* FOOTER */}
          <div className="bg-base-200/20 border-t border-base-300 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="h-11 px-8 rounded-xl bg-base-200 hover:bg-base-300 text-[10px] font-black uppercase tracking-widest transition-all text-base-content/50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={mutation.isPending}
              onClick={handleSubmit}
              className={`h-11 px-8 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 shadow-md cursor-pointer ${
                formData.status === "resolved"
                  ? "bg-[#074033] hover:bg-[#0d5948]"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {mutation.isPending
                ? "Synchronizing Record..."
                : formData.status === "resolved"
                  ? "Save Health Assistance"
                  : "Save Visit"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default WalkInHealthModal;
