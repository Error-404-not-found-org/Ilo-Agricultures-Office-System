import { useState, useEffect, useMemo, useRef } from "react";
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

const inputClass = `input input-bordered w-full font-semibold`;
const selectClass = `select select-bordered w-full font-semibold`;
const textareaClass = `textarea textarea-bordered w-full font-semibold min-h-[120px] resize-none`;
const labelClass = `label-text text-xs font-bold text-base-content/85 py-1 block`;
const sectionClass = `space-y-4`;

const WalkInHealthModal = ({
  isOpen,
  onClose,
  onSuccess,
  prefillData,
  preSelectedFarmer,
  existingOnly = false,
}) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const submittingRef = useRef(false);

  const [isExistingRecord, setIsExistingRecord] = useState(true);
  const [selectedFarmerId, setSelectedFarmerId] = useState("");
  const [searchFarmer, setSearchFarmer] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [isBarangayDropdownOpen, setIsBarangayDropdownOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

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

  const {
    data: farmers = [],
    error: farmersError,
    isError: isFarmersError,
    isLoading: isLoadingFarmers,
    refetch: refetchFarmers,
  } = useQuery({
    queryKey: ["farmers", "list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=farmer");
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: isOpen && !preSelectedFarmer,
  });

  const {
    data: animals = [],
    error: animalsError,
    isError: isAnimalsError,
    isLoading: isLoadingAnimals,
    refetch: refetchAnimals,
  } = useQuery({
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
      if (existingOnly) {
        Promise.resolve().then(() => {
          setIsExistingRecord(true);
          setFormData((current) => ({ ...current, status: "resolved" }));
        });
      }
    }
    if (isOpen && preSelectedFarmer) {
      Promise.resolve().then(() => {
        setIsExistingRecord(true);
        setSelectedFarmerId(preSelectedFarmer._id || preSelectedFarmer.id || "");
        setSelectedAnimalId("");
        setSearchFarmer(preSelectedFarmer.name || "");
        setIsDropdownOpen(false);
      });
    } else if (isOpen && prefillData) {
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
        setFieldErrors({});
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
  }, [isOpen, prefillData, preSelectedFarmer, onClose, existingOnly]);

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
    onSuccess: async (result) => {
      submittingRef.current = false;
      toast.success(
        formData.status === "resolved"
          ? "Health record saved!"
          : "Visit scheduled successfully!",
      );
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ["technician"] }),
        queryClient.invalidateQueries({
          queryKey: ["technician", "health-requests-list"],
        }),
      ];
      if (selectedFarmerId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: ["farmer-animals", selectedFarmerId],
          }),
        );
      }
      if (selectedAnimalId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: ["animal", selectedAnimalId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["animal-history", selectedAnimalId],
          }),
        );
      }
      await Promise.allSettled(invalidations);
      if (onSuccess) onSuccess(result);
      onClose();
    },
    onError: (error) => {
      submittingRef.current = false;
      toast.error(
        "Failed to process request: " +
          (error?.response?.data?.message ||
            error?.message ||
            "Unable to save the health service."),
      );
    },
  });

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (submittingRef.current || mutation.isPending) return;
    const nextErrors = {};
    let submissionData;
    if (isExistingRecord) {
      if (!selectedFarmerId) nextErrors.farmer = "Select a farmer.";
      if (!selectedAnimalId) nextErrors.animal = "Select an animal.";
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        return;
      }
      const farmer =
        farmers.find((f) => f._id === selectedFarmerId) ||
        ((preSelectedFarmer?._id || preSelectedFarmer?.id) === selectedFarmerId
          ? preSelectedFarmer
          : null);
      const animal = animals.find((a) => a._id === selectedAnimalId);
      if (!farmer || !animal) {
        setFieldErrors({
          ...(!farmer ? { farmer: "The selected farmer is no longer available." } : {}),
          ...(!animal ? { animal: "The selected animal is no longer available." } : {}),
        });
        return;
      }
      submissionData = {
        ...formData,
        farmerId: selectedFarmerId,
        animalId: selectedAnimalId,
        firstName: (farmer.name || "").split(" ")[0],
        lastName: (farmer.name || "").split(" ").slice(1).join(" "),
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

    submissionData.diagnosis = submissionData.diagnosis.trim();
    submissionData.treatment = submissionData.treatment.trim();
    submissionData.advice = submissionData.advice.trim();
    submissionData.technicianNote = submissionData.technicianNote.trim();

    if (!submissionData.diagnosis) {
      nextErrors.diagnosis = "Enter the findings or diagnosis.";
    }

    if (submissionData.withdrawalPeriodDays !== "") {
      const withdrawalDays = Number(submissionData.withdrawalPeriodDays);
      if (!Number.isSafeInteger(withdrawalDays) || withdrawalDays < 0) {
        nextErrors.withdrawalPeriodDays =
          "Withdrawal period must be a whole number of 0 days or more.";
      } else {
        submissionData.withdrawalPeriodDays = withdrawalDays;
      }
    }

    if (submissionData.status === "in-progress") {
      const selectedDateTime = new Date(
        `${submissionData.preferredDate}T${submissionData.preferredTime}:00`,
      );
      if (selectedDateTime < new Date()) {
        nextErrors.preferredDate =
          "Choose a visit date and time that has not passed.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    submittingRef.current = true;
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
      <div
        className="modal modal-open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-health-title"
      >
        {/* MODAL */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="modal-box relative flex max-h-[86vh] w-11/12 max-w-3xl flex-col overflow-hidden p-0"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-base-300 bg-base-200/40 px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="flex size-11 items-center justify-center rounded-box bg-primary/10 text-primary">
                <HeartPulse size={20} />
              </div>
              <div>
                <h3
                  id="record-health-title"
                  className="text-lg font-bold text-base-content"
                >
                  Record Health Assistance
                </h3>
                <p className="mt-1 text-sm text-base-content/65">
                  Select an existing farmer and animal, then document the visit
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Close Record Health Assistance"
            >
              <X size={16} />
            </button>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div className="overflow-y-auto flex-1 custom-scrollbar px-5 pb-32 pt-5 space-y-5 bg-base-100">
            {/* TOGGLES */}
            {!existingOnly && (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-base-200/30 p-3 rounded-2xl border border-base-300">
                <div className="join">
                  <button
                    type="button"
                    onClick={() => setIsExistingRecord(true)}
                    className={`btn btn-sm join-item ${isExistingRecord ? "btn-primary" : "btn-ghost"}`}
                  >
                    Existing Record
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsExistingRecord(false)}
                    className={`btn btn-sm join-item ${!isExistingRecord ? "btn-primary" : "btn-ghost"}`}
                  >
                    Manual Entry
                  </button>
                </div>

              <div className="join">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, status: "resolved" })
                  }
                  className={`btn btn-sm join-item ${formData.status === "resolved" ? "btn-success" : "btn-ghost"}`}
                >
                  Completed
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, status: "in-progress" })
                  }
                  className={`btn btn-sm join-item ${formData.status === "in-progress" ? "btn-info" : "btn-ghost"}`}
                >
                  Schedule
                </button>
              </div>
            </div>
            )}

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
                    <label className={labelClass} htmlFor="health-farmer-search">
                      Farmer
                    </label>
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                      />
                      <input
                        id="health-farmer-search"
                        aria-describedby={fieldErrors.farmer ? "health-farmer-error" : undefined}
                        value={searchFarmer}
                        readOnly={Boolean(preSelectedFarmer)}
                        onChange={(e) => {
                          setSearchFarmer(e.target.value);
                          setSelectedFarmerId("");
                          setSelectedAnimalId("");
                          setFieldErrors((current) => ({
                            ...current,
                            farmer: null,
                            animal: null,
                          }));
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => {
                          if (!preSelectedFarmer) setIsDropdownOpen(true);
                        }}
                        onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                        placeholder="Type farmer name..."
                        className={`${inputClass} pl-11`}
                      />

                      <AnimatePresence>
                        {isDropdownOpen && !preSelectedFarmer && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            role="listbox"
                            aria-label="Matching farmers"
                            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-1 shadow-xl custom-scrollbar"
                          >
                            {isLoadingFarmers ? (
                              <div
                                className="space-y-3 p-4"
                                role="status"
                                aria-live="polite"
                              >
                                <div className="skeleton h-10 w-full" />
                                <div className="skeleton h-10 w-full" />
                                <span className="sr-only">
                                  Loading registered farmers
                                </span>
                              </div>
                            ) : isFarmersError ? (
                              <div className="space-y-3 p-4">
                                <div
                                  role="alert"
                                  className="alert alert-error alert-soft"
                                >
                                  <span className="text-sm">
                                    {farmersError?.response?.data?.message ||
                                      "Registered farmers could not be loaded."}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-sm w-full"
                                  onMouseDown={(event) =>
                                    event.preventDefault()
                                  }
                                  onClick={() => refetchFarmers()}
                                >
                                  Try again
                                </button>
                              </div>
                            ) : farmers.filter((f) =>
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
                                      setFieldErrors((current) => ({
                                        ...current,
                                        farmer: null,
                                        animal: null,
                                      }));
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
                    {fieldErrors.farmer && (
                      <p id="health-farmer-error" role="alert" className="text-sm text-error">
                        {fieldErrors.farmer}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass} htmlFor="health-animal">
                      Animal
                    </label>
                    <div className="relative">
                      <select
                        id="health-animal"
                        aria-describedby={fieldErrors.animal ? "health-animal-error" : undefined}
                        disabled={!selectedFarmerId || isLoadingAnimals}
                        value={selectedAnimalId}
                        onChange={(e) => {
                          setSelectedAnimalId(e.target.value);
                          setFieldErrors((current) => ({
                            ...current,
                            animal: null,
                          }));
                        }}
                        className={`${selectClass} disabled:opacity-50 cursor-pointer`}
                      >
                        <option value="">
                          {isLoadingAnimals
                            ? "Synchronizing..."
                            : "Select animal"}
                        </option>
                        {animals.map((a) => (
                          <option key={a._id} value={a._id}>
                            Tag #{a.earTag} ({a.breed}) -{" "}
                            {a.reproductiveStatus || "Normal"}
                          </option>
                        ))}
                      </select>
                      {!isLoadingAnimals &&
                        !isAnimalsError &&
                        selectedFarmerId &&
                        animals.length === 0 && (
                          <p className="mt-2 text-sm text-base-content/65">
                            This farmer has no registered animals.
                          </p>
                        )}
                      {isAnimalsError && (
                        <div className="mt-2 space-y-2">
                          <div
                            role="alert"
                            className="alert alert-error alert-soft py-2 text-sm"
                          >
                            {animalsError?.response?.data?.message ||
                              "Registered animals could not be loaded."}
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm w-full"
                            onClick={() => refetchAnimals()}
                          >
                            Try again
                          </button>
                        </div>
                      )}
                    </div>
                    {fieldErrors.animal && (
                      <p id="health-animal-error" role="alert" className="text-sm text-error">
                        {fieldErrors.animal}
                      </p>
                    )}
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
                  <label className={labelClass} htmlFor="health-service-type">
                    Service type
                  </label>
                  <div className="relative">
                    <select
                      id="health-service-type"
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
                  <label className={labelClass} htmlFor="health-visit-date">
                    {formData.status === "resolved" ? "Service date" : "Visit date"}
                  </label>
                  <div className="relative">
                    <input
                      id="health-visit-date"
                      type="date"
                      aria-describedby={fieldErrors.preferredDate ? "health-date-error" : undefined}
                      value={formData.preferredDate}
                      onChange={(e) =>
                        {
                          setFormData({
                            ...formData,
                            preferredDate: e.target.value,
                          });
                          setFieldErrors((current) => ({
                            ...current,
                            preferredDate: null,
                          }));
                        }
                      }
                      className={`${inputClass} cursor-pointer`}
                    />
                  </div>
                  {fieldErrors.preferredDate && (
                    <p id="health-date-error" role="alert" className="text-sm text-error">
                      {fieldErrors.preferredDate}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass} htmlFor="health-visit-time">
                    {formData.status === "resolved" ? "Service time" : "Visit time"}
                  </label>
                  <div className="relative">
                    <input
                      id="health-visit-time"
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
                      type="button"
                      key={u}
                      aria-pressed={formData.urgency === u}
                      onClick={() => setFormData({ ...formData, urgency: u })}
                      className={`btn btn-sm flex-1 ${
                        formData.urgency === u
                          ? u === "high" || u === "emergency"
                            ? "btn-error"
                            : u === "medium"
                              ? "btn-warning"
                              : "btn-success"
                          : "btn-outline"
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
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="health-diagnosis">
                  Findings / diagnosis
                </label>
                <textarea
                  id="health-diagnosis"
                  aria-describedby={fieldErrors.diagnosis ? "health-diagnosis-error" : undefined}
                  value={formData.diagnosis}
                  onChange={(e) => {
                    setFormData({ ...formData, diagnosis: e.target.value });
                    setFieldErrors((current) => ({
                      ...current,
                      diagnosis: null,
                    }));
                  }}
                  placeholder={
                    formData.status === "resolved"
                      ? "Record clinical findings and diagnosis"
                      : "Describe symptoms or reason for visit request..."
                  }
                  className={textareaClass}
                />
                {fieldErrors.diagnosis && (
                  <p id="health-diagnosis-error" role="alert" className="text-sm text-error">
                    {fieldErrors.diagnosis}
                  </p>
                )}
              </div>
            </section>

            {formData.status === "resolved" && (
              <>
                <section className={sectionClass}>
                  <div className="flex items-center gap-2 mb-1">
                    <Stethoscope size={14} className="text-emerald-500" />
                    <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                      Treatment details
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={labelClass} htmlFor="health-treatment">
                        Treatment provided (optional)
                      </label>
                      <input
                        id="health-treatment"
                        type="text"
                        value={formData.treatment}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            treatment: e.target.value,
                          })
                        }
                        placeholder="e.g. Wound cleaning or injection"
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass} htmlFor="health-advice">
                        Care advice (optional)
                      </label>
                      <input
                        id="health-advice"
                        type="text"
                        value={formData.advice}
                        onChange={(e) =>
                          setFormData({ ...formData, advice: e.target.value })
                        }
                        placeholder="Instructions for the farmer"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 border-t border-base-300 pt-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={labelClass} htmlFor="health-follow-up-date">
                        Follow-up date (optional)
                      </label>
                      <input
                        id="health-follow-up-date"
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
                      <label className={labelClass} htmlFor="health-withdrawal-days">
                        Withdrawal period in days (optional)
                      </label>
                      <input
                        id="health-withdrawal-days"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        aria-describedby={fieldErrors.withdrawalPeriodDays ? "health-withdrawal-error" : undefined}
                        value={formData.withdrawalPeriodDays}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            withdrawalPeriodDays: e.target.value,
                          });
                          setFieldErrors((current) => ({
                            ...current,
                            withdrawalPeriodDays: null,
                          }));
                        }}
                        placeholder="0"
                        className={inputClass}
                      />
                      {fieldErrors.withdrawalPeriodDays && (
                        <p id="health-withdrawal-error" role="alert" className="text-sm text-error">
                          {fieldErrors.withdrawalPeriodDays}
                        </p>
                      )}
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
                  <div className="space-y-1.5">
                    <label className={labelClass} htmlFor="health-technician-notes">
                      Technician notes (optional)
                    </label>
                    <textarea
                      id="health-technician-notes"
                      value={formData.technicianNote}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          technicianNote: e.target.value,
                        })
                      }
                      placeholder="Add relevant service observations"
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
              type="button"
              onClick={onClose}
              className="btn"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={handleSubmit}
              className="btn btn-primary min-w-44"
            >
              {mutation.isPending && (
                <span className="loading loading-spinner loading-sm" />
              )}
              {formData.status === "resolved"
                ? "Save Health Assistance"
                : "Save Visit"}
            </button>
          </div>
        </motion.div>
        <button
          type="button"
          className="modal-backdrop"
          aria-label="Close Record Health Assistance"
          onClick={onClose}
        />
      </div>
    </AnimatePresence>
  );
};

export default WalkInHealthModal;
