import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Syringe,
  User,
  Activity,
  Search,
  MapPin,
  Phone,
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  History,
  Mail,
  ChevronDown,
} from "lucide-react";
import { getAIRequestErrorMessage } from "../../utils/aiRequestErrors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import {
  CATTLE_BREEDS,
  CATTLE_SPECIES,
  CATTLE_COLORS,
  BREED_OPTIONS_BY_SPECIES,
} from "../../constants/breeds";
import { getSireCodeByBreed } from "../../constants/sireRegistry";
import {
  formatBarangayWithDistrict,
  getIloiloBarangayOptions,
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
} from "../../utils/addressOptions";
import {
  checkInseminationAgeEligibility,
  verifyPostpartumWindow,
} from "../../utils/cattleCore";

const inputClass = `input input-bordered w-full font-semibold`;
const selectClass = `select select-bordered w-full font-semibold`;
const labelClass = `label-text text-xs font-bold text-base-content/85 py-1 block`;
const sectionClass = `space-y-4`;

const WalkInAIModal = ({
  isOpen,
  onClose,
  onSuccess,
  preSelectedFarmer,
  preSelectedAnimal,
  existingOnly = false,
}) => {
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
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [ageWarning, setAgeWarning] = useState("");
  const [vwpWarning, setVwpWarning] = useState("");

  const [formData, setFormData] = useState(() => ({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    address: {
      barangay: "",
      city: "Oton",
    },
    email: "",
    animalDetails: {
      earTag: "",
      species: "Beef Cattle",
      breed: "",
      color: "",
    },
    inseminationDetails: {
      inseminationDate: new Date().toISOString().split("T")[0],
      time: "08:00",
      sireBreed: "",
      sireCode: `SIRE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      estrus: "Natural",
      status: "done",
    },
  }));

  const targetBarangays = useMemo(() => {
    const selectedCity = formData.address?.city || "Oton";
    return getIloiloBarangayOptions(selectedCity, selectedDistrict);
  }, [formData.address?.city, selectedDistrict]);

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
      const res = await axiosInstance.get(
        `/animals/farmer/${selectedFarmerId}`,
      );
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: !!selectedFarmerId && isExistingRecord,
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.post(
        "/technician/walk-in-insemination",
        data,
      );
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
      toast.error(
        "Failed to record AI: " +
          getAIRequestErrorMessage(error, "Please try again."),
      );
    },
  });

  const overrideMutation = useMutation({
    mutationFn: async (animalId) => {
      return await axiosInstance.patch(
        `/animals/${animalId}/reproductive-status`,
        {
          status: "Normal",
          note: "Technician override: Farmer confirmed animal is not pregnant during field visit.",
        },
      );
    },
    onSuccess: () => {
      toast.success("Animal status reset to Normal.");
      queryClient.invalidateQueries({ queryKey: ["farmer-animals"] });
      setShowPregnancyWarning(false);
      setIsOverriding(true);
    },
  });

  const handleAnimalChange = (animalId) => {
    setSelectedAnimalId(animalId);
    const animal = animals.find((a) => a._id === animalId);
    if (!animal) {
      setShowPregnancyWarning(false);
      setAgeWarning("");
      setVwpWarning("");
      return;
    }

    if (animal.reproductiveStatus === "Pregnant") {
      setShowPregnancyWarning(true);
    } else {
      setShowPregnancyWarning(false);
    }

    // Check minimum breeding age eligibility
    if (animal.birthDate) {
      const ageCheck = checkInseminationAgeEligibility(
        animal.birthDate,
        animal.species,
      );
      if (!ageCheck.isEligible) {
        setAgeWarning(ageCheck.reason);
      } else {
        setAgeWarning("");
      }
    } else {
      setAgeWarning("");
    }

    // Check Postpartum Voluntary Waiting Period
    if (animal.lastCalvingDate) {
      const vwpCheck = verifyPostpartumWindow(
        animal.lastCalvingDate,
        formData.inseminationDetails.inseminationDate || new Date(),
        animal.species,
        animal.breed,
      );
      if (!vwpCheck.isSafe) {
        setVwpWarning(
          `Postpartum Voluntary Waiting Period violated. Only ${vwpCheck.daysPassed} days have passed since calving on ${new Date(animal.lastCalvingDate).toLocaleDateString()}. Minimum required recovery window is ${vwpCheck.requiredDays} days.`,
        );
      } else {
        setVwpWarning("");
      }
    } else {
      setVwpWarning("");
    }
  };

  useEffect(() => {
    if (isOpen && preSelectedAnimal && animals && animals.length > 0) {
      const found = animals.find((a) => a._id === preSelectedAnimal._id);
      if (found) {
        Promise.resolve().then(() => {
          handleAnimalChange(found._id);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preSelectedAnimal, animals]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      Promise.resolve().then(() => {
        if (existingOnly) setIsExistingRecord(true);
        if (preSelectedFarmer) {
          setSelectedFarmerId(preSelectedFarmer._id);
          setSearchFarmer(preSelectedFarmer.name || "");
        }
        if (preSelectedAnimal) {
          setSelectedAnimalId(preSelectedAnimal._id);
        }
      });
    } else {
      Promise.resolve().then(() => {
        setIsExistingRecord(true);
        setSelectedFarmerId("");
        setSearchFarmer("");
        setIsDropdownOpen(false);
        setSelectedAnimalId("");
        setShowPregnancyWarning(false);
        setAgeWarning("");
        setVwpWarning("");
        setIsOverriding(false);
        setIsBarangayDropdownOpen(false);
        setSelectedDistrict("");
        setFormData({
          firstName: "",
          lastName: "",
          phoneNumber: "",
          address: {
            barangay: "",
            city: "Oton",
          },
          email: "",
          animalDetails: {
            earTag: "",
            species: "Beef Cattle",
            breed: "",
            color: "",
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
      });
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, preSelectedFarmer, preSelectedAnimal, existingOnly]);

  const getSelectedAnimalSpecies = () => {
    if (isExistingRecord && selectedAnimalId) {
      const animal = animals.find((a) => a._id === selectedAnimalId);
      return animal?.species || "Beef Cattle";
    }
    return formData.animalDetails.species || "Beef Cattle";
  };

  useEffect(() => {
    const species =
      isExistingRecord && selectedAnimalId
        ? animals.find((a) => a._id === selectedAnimalId)?.species
        : formData.animalDetails.species;
    if (species) {
      const validBreeds = BREED_OPTIONS_BY_SPECIES[species] || [];
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
      if (
        formData.inseminationDetails.sireBreed &&
        !validBreeds.includes(formData.inseminationDetails.sireBreed)
      ) {
        Promise.resolve().then(() => {
          setFormData((prev) => ({
            ...prev,
            inseminationDetails: {
              ...prev.inseminationDetails,
              sireBreed: "",
              sireCode: "",
            },
          }));
        });
      }
    }
  }, [
    selectedAnimalId,
    formData.animalDetails.species,
    isExistingRecord,
    animals,
    formData.animalDetails.breed,
    formData.inseminationDetails.sireBreed,
  ]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    let submissionData;
    if (isExistingRecord) {
      if (!selectedFarmerId || !selectedAnimalId) {
        return toast.error("Please select both a farmer and an animal.");
      }
      const farmer = farmers.find((f) => f._id === selectedFarmerId);
      const animal = animals.find((a) => a._id === selectedAnimalId);

      // Gender Check
      if (animal && animal.gender === "Male") {
        return toast.error(
          "Insemination is restricted to female animals only. This animal is registered as Male.",
        );
      }

      submissionData = {
        farmerId: selectedFarmerId,
        animalId: selectedAnimalId,
        firstName: farmer.name.split(" ")[0],
        lastName: farmer.name.split(" ").slice(1).join(" "),
        phoneNumber: farmer.phoneNumber || "",
        email: farmer.email || "",
        address:
          typeof farmer.address === "string"
            ? farmer.address
            : farmer.address?.street || "",
        animalDetails: {
          earTag: animal.earTag,
          species: animal.species,
          breed: animal.breed,
        },
        inseminationDetails: formData.inseminationDetails,
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
        return toast.error(
          "Farmer phone number and animal ear tag are required.",
        );
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
    if (
      !formData.inseminationDetails.sireBreed ||
      !formData.inseminationDetails.sireCode
    ) {
      return toast.error("Please provide both Sire Breed and Sire Code.");
    }

    if (showPregnancyWarning && !isOverriding) {
      return toast.error("Please resolve the pregnancy warning before saving.");
    }

    mutation.mutate(submissionData);
  };

  const toTitleCase = (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
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
                <Syringe size={20} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter text-base-content leading-none">
                  Record AI Service
                </h3>
                <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-base-content/25 leading-none">
                  Select an existing farmer and animal, then record the service
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
          <div className="overflow-y-auto flex-1 custom-scrollbar px-5 pb-32 pt-5 space-y-5 bg-base-100">
            {config?.isHoliday && (
              <div className="border border-rose-500/20 bg-rose-500/5 p-5 flex items-start gap-4 rounded-2xl">
                <AlertCircle
                  size={18}
                  className="text-rose-500 shrink-0 mt-0.5"
                />
                <div>
                  <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest leading-none">
                    Off-Schedule Entry
                  </h3>
                  <p className="text-[9px] font-bold text-rose-500/40 uppercase tracking-widest mt-2 leading-none">
                    Office operations are currently closed. Marked as manual
                    field entry.
                  </p>
                </div>
              </div>
            )}

            {/* TOGGLES */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-base-200/30 p-3 rounded-2xl border border-base-300">
              {!existingOnly && (
                <div className="inline-flex p-1 rounded-xl bg-base-100 border border-base-300">
                  <button
                    type="button"
                    onClick={() => setIsExistingRecord(true)}
                    className={`px-5 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${isExistingRecord ? "bg-[#074033] text-white shadow-md" : "text-base-content/40 hover:text-base-content"}`}
                  >
                    Existing Record
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsExistingRecord(false)}
                    className={`px-5 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${!isExistingRecord ? "bg-[#074033] text-white shadow-md" : "text-base-content/40 hover:text-base-content"}`}
                  >
                    Full Registration
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      inseminationDetails: {
                        ...formData.inseminationDetails,
                        status: "done",
                      },
                    })
                  }
                  className={`px-4 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer ${formData.inseminationDetails.status !== "in-progress" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "border-transparent text-base-content/20"}`}
                >
                  Completed
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      inseminationDetails: {
                        ...formData.inseminationDetails,
                        status: "in-progress",
                      },
                    })
                  }
                  className={`px-4 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer ${formData.inseminationDetails.status === "in-progress" ? "bg-blue-500/10 border-blue-500/20 text-blue-600" : "border-transparent text-base-content/20"}`}
                >
                  Schedule
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
                    {preSelectedFarmer ? (
                      <div className="flex items-center gap-3 h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content/65 select-none">
                        <User size={14} className="text-emerald-600 shrink-0" />
                        <span className="truncate">
                          {preSelectedFarmer.name}
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                        />
                        <input
                          value={searchFarmer}
                          onChange={(e) => {
                            setSearchFarmer(e.target.value);
                            setSelectedFarmerId("");
                            setSelectedAnimalId("");
                            setIsDropdownOpen(true);
                          }}
                          onFocus={() => setIsDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                          placeholder="Type farmer name..."
                          className={`${inputClass} pl-11`}
                        />

                        <AnimatePresence>
                          {isDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              role="listbox"
                              aria-label="Matching farmers"
                              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-1 shadow-xl custom-scrollbar"
                            >
                              {farmers.filter((f) =>
                                (f.name || "")
                                  .toLowerCase()
                                  .includes(searchFarmer.toLowerCase()) ||
                                (f.phoneNumber || "")
                                  .toLowerCase()
                                  .includes(searchFarmer.toLowerCase()) ||
                                (typeof f.address === "string"
                                  ? f.address
                                  : f.address?.barangay || ""
                                )
                                  .toLowerCase()
                                  .includes(searchFarmer.toLowerCase()),
                              ).length > 0 ? (
                                farmers
                                  .filter((f) =>
                                    (f.name || "")
                                      .toLowerCase()
                                      .includes(searchFarmer.toLowerCase()) ||
                                    (f.phoneNumber || "")
                                      .toLowerCase()
                                      .includes(searchFarmer.toLowerCase()) ||
                                    (typeof f.address === "string"
                                      ? f.address
                                      : f.address?.barangay || ""
                                    )
                                      .toLowerCase()
                                      .includes(searchFarmer.toLowerCase()),
                                  )
                                  .map((farmer) => (
                                    <button
                                      key={farmer._id}
                                      type="button"
                                      role="option"
                                      aria-selected={selectedFarmerId === farmer._id}
                                      onClick={() => {
                                        setSelectedFarmerId(farmer._id);
                                        setSelectedAnimalId("");
                                        setSearchFarmer(farmer.name);
                                        setIsDropdownOpen(false);
                                      }}
                                      className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left hover:bg-base-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary cursor-pointer"
                                    >
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                        {(farmer.name || "Farmer").substring(0, 2).toUpperCase()}
                                      </span>
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-bold text-base-content">
                                          {farmer.name}
                                        </span>
                                        <span className="block text-xs font-medium text-base-content/60">
                                          {farmer.phoneNumber || "No Contact"} •{" "}
                                          {typeof farmer.address === "string"
                                            ? farmer.address
                                            : farmer.address?.barangay || "No Barangay"}
                                        </span>
                                      </span>
                                    </button>
                                  ))
                              ) : (
                                <p className="px-4 py-8 text-center text-sm font-medium text-base-content/60">
                                  No farmers found
                                </p>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Animal</label>
                    {preSelectedAnimal ? (
                      <div className="flex items-center gap-3 h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content/65 select-none">
                        <Activity
                          size={14}
                          className="text-emerald-600 shrink-0"
                        />
                        <span className="truncate">
                          Tag #{preSelectedAnimal.earTag} (
                          {preSelectedAnimal.breed || "Crossbreed"})
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          disabled={!selectedFarmerId || isLoadingAnimals}
                          value={selectedAnimalId}
                          onChange={(e) => handleAnimalChange(e.target.value)}
                          className={`${selectClass} cursor-pointer disabled:opacity-50 ${showPregnancyWarning ? "border-rose-500/50" : ""}`}
                        >
                          <option value="">
                            {isLoadingAnimals
                              ? "Synchronizing..."
                              : "Select animal"}
                          </option>
                          {animals?.map((a) => (
                            <option
                              key={a._id}
                              value={a._id}
                              disabled={a.gender === "Male"}
                            >
                              Tag #{a.earTag} ({a.breed}) —{" "}
                              {a.reproductiveStatus || "Normal"}
                              {a.gender === "Male"
                                ? " (Male - Restricted)"
                                : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Sire Selection for Existing Record */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-base-300 mt-4 col-span-2">
                    <div className="space-y-1.5">
                      <label className={labelClass}>Sire Breed</label>
                      <div className="relative">
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
                                sireCode:
                                  code || formData.inseminationDetails.sireCode,
                              },
                            });
                          }}
                          className={`${selectClass} cursor-pointer`}
                        >
                          <option value="" disabled>
                            Select Sire Breed
                          </option>
                          {(
                            BREED_OPTIONS_BY_SPECIES[
                              getSelectedAnimalSpecies()
                            ] || CATTLE_BREEDS
                          ).map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Sire Code</label>
                      <div className="relative">
                        <BadgeCheck
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                        />
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
                      className="mt-4 overflow-hidden"
                    >
                      <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle
                            size={20}
                            className="text-rose-500 shrink-0 mt-0.5"
                          />
                          <div>
                            <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest leading-none">
                              Pregnancy Warning
                            </h4>
                            <p className="text-[9px] font-bold text-rose-500/40 uppercase tracking-widest mt-2 leading-none">
                              Asset recorded as PREGNANT. Insemination is risky.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            overrideMutation.mutate(selectedAnimalId)
                          }
                          disabled={overrideMutation.isPending}
                          className="w-full sm:w-auto h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase tracking-widest transition-all shadow-md cursor-pointer"
                        >
                          {overrideMutation.isPending
                            ? "Updating..."
                            : "Override Status"}
                        </button>
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
                      className="mt-3 overflow-hidden"
                    >
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-3">
                        <AlertTriangle
                          size={20}
                          className="text-amber-500 shrink-0 mt-0.5"
                        />
                        <div>
                          <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">
                            Age Eligibility Warning
                          </h4>
                          <p className="text-[11px] font-medium text-base-content/85 mt-2 leading-tight">
                            {ageWarning}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {vwpWarning && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 overflow-hidden"
                    >
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-3">
                        <AlertTriangle
                          size={20}
                          className="text-amber-500 shrink-0 mt-0.5"
                        />
                        <div>
                          <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">
                            Postpartum Window Warning
                          </h4>
                          <p className="text-[11px] font-medium text-base-content/85 mt-2 leading-tight">
                            {vwpWarning}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
                        placeholder="e.g. Jane"
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
                        placeholder="e.g. Doe"
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
                        placeholder="e.g. jane.doe@example.com"
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
                        placeholder="e.g. 0912 345 6789"
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
                          value={formData.address.barangay ? toTitleCase(formData.address.barangay) : ""}
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
                              : "Type barangay name..."
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
                                          {toTitleCase(brgy)}
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
                        placeholder="e.g. 104"
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
                  <div className="space-y-1.5">
                    <label className={labelClass}>Color</label>
                    <select
                      value={formData.animalDetails.color}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          animalDetails: {
                            ...formData.animalDetails,
                            color: e.target.value,
                          },
                        })
                      }
                      className={`${selectClass} cursor-pointer`}
                    >
                      <option value="" disabled>
                        Select Color
                      </option>
                      {CATTLE_COLORS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sire Selection for Full Reg */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-base-300 mt-4 col-span-2">
                    <div className="space-y-1.5">
                      <label className={labelClass}>
                        Sire Breed (AI Setup)
                      </label>
                      <div className="relative">
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
                                sireCode:
                                  code || formData.inseminationDetails.sireCode,
                              },
                            });
                          }}
                          className={`${selectClass} cursor-pointer`}
                        >
                          <option value="" disabled>
                            Select Sire Breed
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
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Sire Code</label>
                      <div className="relative">
                        <BadgeCheck
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                        />
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
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-base-300">
                <History size={14} className="text-emerald-500" />
                <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                  Service details
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>AI Service Date</label>
                  <input
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    value={formData.inseminationDetails.inseminationDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        inseminationDetails: {
                          ...formData.inseminationDetails,
                          inseminationDate: e.target.value,
                        },
                      })
                    }
                    className={`${inputClass} cursor-pointer`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Service time</label>
                  <input
                    type="time"
                    value={formData.inseminationDetails.time}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        inseminationDetails: {
                          ...formData.inseminationDetails,
                          time: e.target.value,
                        },
                      })
                    }
                    className={`${inputClass} cursor-pointer`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Estrus type</label>
                  <select
                    value={formData.inseminationDetails.estrus}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        inseminationDetails: {
                          ...formData.inseminationDetails,
                          estrus: e.target.value,
                        },
                      })
                    }
                    className={`${selectClass} cursor-pointer`}
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
          <div className="bg-base-200/20 border-t border-base-300 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="h-11 px-6 rounded-xl bg-base-200 hover:bg-base-300 text-[10px] font-black uppercase tracking-widest transition-all text-base-content/50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={
                mutation.isPending || (showPregnancyWarning && !isOverriding)
              }
              onClick={handleSubmit}
              className={`h-11 px-8 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 shadow-md cursor-pointer ${
                formData.inseminationDetails.status !== "in-progress"
                  ? "bg-[#074033] hover:bg-[#0d5948]"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {mutation.isPending
                ? "Synchronizing Registry..."
                : formData.inseminationDetails.status !== "in-progress"
                  ? "Save AI Service"
                  : "Schedule AI Visit"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default WalkInAIModal;
