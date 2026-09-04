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
  UserPlus,
  AlertCircle,
  Check,
  Plus
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import {
  CATTLE_BREEDS,
  CATTLE_SPECIES,
  BREED_OPTIONS_BY_SPECIES,
} from "../../constants/breeds";
import UserAvatar from "../ui/UserAvatar";
import {
  formatBarangayWithDistrict,
  getIloiloBarangayOptions,
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
} from "../../utils/addressOptions";
import {
  buildDirectHealthRecordPayload,
  DIRECT_HEALTH_SERVICE_TYPES,
  formatDirectHealthDateKey,
} from "../../utils/directHealthRecord";

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
  const [isAnimalDropdownOpen, setIsAnimalDropdownOpen] = useState(false);
  const animalDropdownRef = useRef(null);
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [isBarangayDropdownOpen, setIsBarangayDropdownOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submissionError, setSubmissionError] = useState("");

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
    preferredDate: formatDirectHealthDateKey(),
    preferredTime: "08:00",
    diagnosis: "",
    treatment: "",
    medicineGiven: "",
    dosage: "",
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
    enabled: isOpen,
  });

  const matchingFarmers = useMemo(() => {
    const query = searchFarmer.toLowerCase();
    return farmers.filter(
      (f) =>
        (f.name || "").toLowerCase().includes(query) ||
        (f.phoneNumber || "").toLowerCase().includes(query) ||
        (typeof f.address === "string" ? f.address : f.address?.barangay || "").toLowerCase().includes(query)
    );
  }, [farmers, searchFarmer]);

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

  const selectedFarmer = useMemo(() => {
    return farmers.find((f) => String(f._id) === String(selectedFarmerId));
  }, [farmers, selectedFarmerId]);

  const selectedAnimal = useMemo(() => {
    return animals.find((a) => String(a._id) === String(selectedAnimalId));
  }, [animals, selectedAnimalId]);

  const clearFarmer = () => {
    setSearchFarmer("");
    setSelectedFarmerId("");
    setSelectedAnimalId("");
    setFieldErrors((current) => ({ ...current, farmer: null, animal: null }));
    setTimeout(() => setIsDropdownOpen(true), 0);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !submittingRef.current) {
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
        setSelectedFarmerId(
          preSelectedFarmer._id || preSelectedFarmer.id || "",
        );
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
        setSubmissionError("");
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
          preferredDate: formatDirectHealthDateKey(),
          preferredTime: "08:00",
          diagnosis: "",
          treatment: "",
          medicineGiven: "",
          dosage: "",
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
      const isCanonicalDirectRecord =
        existingOnly && Boolean(data.farmerId) && Boolean(data.animalId);
      if (!isCanonicalDirectRecord) {
        const res = await axiosInstance.post("/health-request/walk-in", data);
        return res.data;
      }
      const payload = buildDirectHealthRecordPayload({
        animalId: data.animalId,
        serviceType: data.requestType,
        serviceDate: data.preferredDate,
        diagnosis: data.diagnosis,
        treatment: data.treatment,
        medicineGiven: data.medicineGiven,
        dosage: data.dosage,
        withdrawalPeriodDays: data.withdrawalPeriodDays,
        advice: data.advice,
        resolutionNotes: data.technicianNote,
        followUpDate: data.followUpDate,
      });
      const res = await axiosInstance.post("/medical", payload);
      return res.data;
    },
    onSuccess: async (result) => {
      submittingRef.current = false;
      setSubmissionError("");
      const invalidations = existingOnly
        ? [
            queryClient.invalidateQueries({
              queryKey: ["technician", "official-records"],
            }),
            queryClient.invalidateQueries({
              queryKey: ["technician", "dashboard"],
            }),
          ]
        : [
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
      toast.success(
        formData.status === "resolved"
          ? "Health record saved!"
          : "Visit scheduled successfully!",
      );
    },
    onError: (error) => {
      submittingRef.current = false;
      setSubmissionError(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to save the health service.",
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
          ...(!farmer
            ? { farmer: "The selected farmer is no longer available." }
            : {}),
          ...(!animal
            ? { animal: "The selected animal is no longer available." }
            : {}),
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
        setSubmissionError("Municipality or city is required.");
        return;
      }
      if (formData.address.city === ILOILO_CITY_NAME && !selectedDistrict) {
        setSubmissionError("Please select the Iloilo City district.");
        return;
      }
      if (!formData.address.barangay) {
        setSubmissionError("Barangay is required.");
        return;
      }
      if (!formData.phoneNumber || !formData.animalDetails.earTag) {
        setSubmissionError("Phone number and Ear Tag are required.");
        return;
      }
      if (formData.phoneNumber.length < 11) {
        setSubmissionError("Phone number must be exactly 11 digits.");
        return;
      }
      if (!formData.phoneNumber.startsWith("09")) {
        setSubmissionError("Phone number must start with 09.");
        return;
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
    submissionData.medicineGiven = submissionData.medicineGiven.trim();
    submissionData.dosage = submissionData.dosage.trim();
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
    setSubmissionError("");
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
            {submissionError && (
              <div role="alert" className="alert alert-error alert-soft">
                <span>{submissionError}</span>
              </div>
            )}
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
                <div className="grid gap-4 md:grid-cols-2">
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">Farmer</legend>
                    {preSelectedFarmer ? (
                      <div className="flex h-12 items-center gap-3 rounded-field border border-base-300 bg-base-200 px-4">
                        <UserAvatar
                          name={preSelectedFarmer.name}
                          imageUrl={
                            preSelectedFarmer.imageUrl ||
                            preSelectedFarmer.avatarUrl ||
                            preSelectedFarmer.avatar
                          }
                          size={28}
                          sizeClass="h-7 w-7"
                        />
                        <span className="truncate font-semibold">
                          {preSelectedFarmer.name}
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <label className="input w-full flex items-center gap-2">
                          {selectedFarmer ? (
                            <UserAvatar
                              name={selectedFarmer.name}
                              imageUrl={
                                selectedFarmer.imageUrl ||
                                selectedFarmer.avatarUrl ||
                                selectedFarmer.avatar
                              }
                              size={22}
                              sizeClass="h-5.5 w-5.5"
                            />
                          ) : (
                            <Search
                              size={16}
                              className="shrink-0 text-base-content/40"
                            />
                          )}
                          <input
                            className="grow min-w-0"
                            value={searchFarmer}
                            onChange={(event) => {
                              setSearchFarmer(event.target.value);
                              setSelectedFarmerId("");
                              setSelectedAnimalId("");
                              setFieldErrors((current) => ({ ...current, farmer: null, animal: null }));
                              setIsDropdownOpen(true);
                            }}
                            onFocus={() => setIsDropdownOpen(true)}
                            onBlur={() =>
                              window.setTimeout(
                                () => setIsDropdownOpen(false),
                                150,
                              )
                            }
                            placeholder="Name, phone, or barangay"
                          />
                          {Boolean(searchFarmer || selectedFarmerId) && (
                            <button
                              type="button"
                              aria-label="Clear farmer selection"
                              className="btn btn-ghost btn-circle btn-xs shrink-0 text-base-content/50 hover:text-base-content"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                clearFarmer();
                              }}
                            >
                              <X size={14} aria-hidden="true" />
                            </button>
                          )}
                        </label>
                        {isDropdownOpen && (
                          <div
                            role="listbox"
                            aria-label="Matching farmers"
                            className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-box border border-base-300 bg-base-100 p-1 shadow-lg"
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
                                  <AlertCircle size={16} />
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
                            ) : matchingFarmers.length ? (
                              matchingFarmers.map((farmer) => (
                                <button
                                  key={farmer._id}
                                  type="button"
                                  role="option"
                                  aria-selected={
                                    selectedFarmerId === farmer._id
                                  }
                                  className="flex w-full cursor-pointer items-center gap-3 rounded-field px-3 py-2.5 text-left hover:bg-base-200"
                                  onMouseDown={(event) =>
                                    event.preventDefault()
                                  }
                                  onClick={() => {
                                    setSelectedFarmerId(farmer._id);
                                    setSelectedAnimalId("");
                                    setSearchFarmer(farmer.name);
                                    setIsDropdownOpen(false);
                                    setFieldErrors((current) => ({ ...current, farmer: null, animal: null }));
                                  }}
                                >
                                  <UserAvatar
                                    name={farmer.name}
                                    imageUrl={
                                      farmer.imageUrl ||
                                      farmer.avatarUrl ||
                                      farmer.avatar
                                    }
                                    size={36}
                                    sizeClass="h-9 w-9"
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate font-semibold">
                                      {farmer.name}
                                    </span>
                                    <span className="block truncate text-xs text-base-content/55">
                                      {farmer.phoneNumber || "No phone number"}
                                    </span>
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className="space-y-3 p-4 text-center">
                                <div>
                                  <div className="font-semibold">
                                    Farmer not found
                                  </div>
                                  <div className="text-sm text-base-content/55">
                                    No matching registered farmer is available.
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </fieldset>

                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">Animal</legend>
                    {selectedFarmerId &&
                      !isLoadingAnimals &&
                      !isAnimalsError &&
                      animals.length === 0 ? (
                      <div className="space-y-3 rounded-field border border-base-300 bg-base-200 p-4 text-center">
                        <div>
                          <div className="font-semibold">
                            No animals found
                          </div>
                          <div className="text-sm text-base-content/55">
                            This farmer has no registered animals.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative" ref={animalDropdownRef}>
                        <button
                          type="button"
                          disabled={
                            !selectedFarmerId ||
                            isLoadingAnimals ||
                            isAnimalsError
                          }
                          onClick={() =>
                            setIsAnimalDropdownOpen((prev) => !prev)
                          }
                          className={`input w-full flex items-center justify-between gap-2 text-left ${
                            !selectedFarmerId ||
                            isLoadingAnimals ||
                            isAnimalsError
                              ? "opacity-60 cursor-not-allowed bg-base-200/50"
                              : "cursor-pointer hover:border-primary/50"
                          }`}
                        >
                          {selectedAnimal ? (
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="badge badge-sm font-mono font-bold bg-base-200 text-base-content border border-base-300 shrink-0">
                                #
                                {String(selectedAnimal.earTag || "").replace(
                                  /^#/,
                                  "",
                                )}
                              </span>
                              <span className="font-semibold text-sm text-base-content truncate">
                                {selectedAnimal.name
                                  ? `${selectedAnimal.name} · `
                                  : ""}
                                {selectedAnimal.breed ||
                                  selectedAnimal.species}
                              </span>
                              <span className="badge badge-xs badge-success badge-soft font-semibold shrink-0">
                                {selectedAnimal.gender || "Female"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-base-content/50">
                              {isLoadingAnimals
                                ? "Loading registered animals…"
                                : selectedFarmerId
                                  ? "Select animal"
                                  : "Select a farmer first"}
                            </span>
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            {Boolean(selectedAnimalId) && (
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label="Clear animal selection"
                                className="btn btn-ghost btn-circle btn-xs text-base-content/50 hover:text-base-content"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedAnimalId("");
                                  setFieldErrors((current) => ({ ...current, animal: null }));
                                }}
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.stopPropagation();
                                    setSelectedAnimalId("");
                                    setFieldErrors((current) => ({ ...current, animal: null }));
                                  }
                                }}
                              >
                                <X size={14} aria-hidden="true" />
                              </span>
                            )}
                            <ChevronDown
                              size={16}
                              className={`text-base-content/50 transition-transform ${
                                isAnimalDropdownOpen ? "rotate-180" : ""
                              }`}
                              aria-hidden="true"
                            />
                          </div>
                        </button>

                        {isAnimalDropdownOpen && (
                          <div
                            role="listbox"
                            aria-label="Registered animals"
                            className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-box border border-base-300 bg-base-100 p-1.5 shadow-xl space-y-1"
                          >
                            <button
                              type="button"
                              role="option"
                              aria-selected={!selectedAnimalId}
                              onClick={() => {
                                setSelectedAnimalId("");
                                setIsAnimalDropdownOpen(false);
                                setFieldErrors((current) => ({ ...current, animal: null }));
                              }}
                              className={`flex w-full items-center justify-between rounded-field px-3 py-2 text-xs font-medium text-left transition-colors ${
                                !selectedAnimalId
                                  ? "bg-base-200 text-base-content font-bold"
                                  : "text-base-content/60 hover:bg-base-200"
                              }`}
                            >
                              <span>Select animal</span>
                              {!selectedAnimalId && (
                                <Check size={14} className="text-primary" />
                              )}
                            </button>

                            <div className="divider my-0.5" />

                            {animals.map((animal) => {
                              const isSelected =
                                String(animal._id) ===
                                String(selectedAnimalId);
                              const tag = String(animal.earTag || "").replace(
                                /^#/,
                                "",
                              );

                              return (
                                <button
                                  key={animal._id}
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  onClick={() => {
                                    setSelectedAnimalId(animal._id);
                                    setIsAnimalDropdownOpen(false);
                                    setFieldErrors((current) => ({ ...current, animal: null }));
                                  }}
                                  className={`flex w-full items-center justify-between gap-3 rounded-field px-3 py-2.5 text-left transition-all ${
                                    isSelected
                                      ? "bg-primary/10 text-primary font-semibold"
                                      : "hover:bg-base-200 cursor-pointer"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <span
                                      className={`badge badge-sm font-mono font-bold shrink-0 ${
                                        isSelected
                                          ? "bg-primary! text-primary-content! border-0!"
                                          : "bg-base-200 text-base-content border border-base-300"
                                      }`}
                                    >
                                      Tag #{tag}
                                    </span>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-sm text-base-content truncate">
                                          {animal.name
                                            ? `${animal.name} · `
                                            : ""}
                                          {animal.breed || animal.species}
                                        </span>
                                        <span
                                          className="badge badge-xs font-semibold shrink-0 badge-success badge-soft"
                                        >
                                          {animal.gender || "Female"}
                                        </span>
                                      </div>
                                      <div className="text-xs text-base-content/60 truncate">
                                        {animal.species
                                          ? `${animal.species}`
                                          : "Livestock"}
                                        {animal.reproductiveStatus
                                          ? ` · ${animal.reproductiveStatus}`
                                          : ""}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="shrink-0">
                                    {isSelected ? (
                                      <Check
                                        size={16}
                                        className="text-primary"
                                      />
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {isAnimalsError && (
                          <div
                            className="alert alert-error mt-2 text-sm"
                            role="alert"
                          >
                            <AlertCircle size={16} />
                            <span>
                              {animalsError?.response?.data?.message ||
                                "Registered animals could not be loaded."}
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => refetchAnimals()}
                            >
                              Try again
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </fieldset>
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
                          value={
                            formData.address.barangay
                              ? toTitleCase(formData.address.barangay)
                              : ""
                          }
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
                  {existingOnly ? "Service details" : "Visit details"}
                </h4>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                      {DIRECT_HEALTH_SERVICE_TYPES.map((serviceType) => (
                        <option
                          key={serviceType.value}
                          value={serviceType.value}
                        >
                          {serviceType.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass} htmlFor="health-visit-date">
                    {formData.status === "resolved"
                      ? "Service date"
                      : "Visit date"}
                  </label>
                  <div className="relative">
                    <input
                      id="health-visit-date"
                      type="date"
                      max={
                        existingOnly ? formatDirectHealthDateKey() : undefined
                      }
                      aria-describedby={
                        fieldErrors.preferredDate
                          ? "health-date-error"
                          : undefined
                      }
                      value={formData.preferredDate}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          preferredDate: e.target.value,
                        });
                        setFieldErrors((current) => ({
                          ...current,
                          preferredDate: null,
                        }));
                      }}
                      className={`${inputClass} cursor-pointer`}
                    />
                  </div>
                  {fieldErrors.preferredDate && (
                    <p
                      id="health-date-error"
                      role="alert"
                      className="text-sm text-error"
                    >
                      {fieldErrors.preferredDate}
                    </p>
                  )}
                </div>
                {!existingOnly && (
                  <div className="space-y-1.5">
                    <label className={labelClass} htmlFor="health-visit-time">
                      Visit time
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
                )}
              </div>

              {!existingOnly && (
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
              )}
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
                  aria-describedby={
                    fieldErrors.diagnosis ? "health-diagnosis-error" : undefined
                  }
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
                  <p
                    id="health-diagnosis-error"
                    role="alert"
                    className="text-sm text-error"
                  >
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
                  <div className="space-y-1.5">
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
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={labelClass} htmlFor="health-medicine">
                        Medication given (optional)
                      </label>
                      <input
                        id="health-medicine"
                        type="text"
                        value={formData.medicineGiven}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            medicineGiven: e.target.value,
                          })
                        }
                        placeholder="e.g. Penicillin"
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass} htmlFor="health-dosage">
                        Dosage (optional)
                      </label>
                      <input
                        id="health-dosage"
                        type="text"
                        value={formData.dosage}
                        onChange={(e) =>
                          setFormData({ ...formData, dosage: e.target.value })
                        }
                        placeholder="e.g. 10 ml"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 border-t border-base-300 pt-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        className={labelClass}
                        htmlFor="health-follow-up-date"
                      >
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
                      <label
                        className={labelClass}
                        htmlFor="health-withdrawal-days"
                      >
                        Withdrawal period in days (optional)
                      </label>
                      <input
                        id="health-withdrawal-days"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        aria-describedby={
                          fieldErrors.withdrawalPeriodDays
                            ? "health-withdrawal-error"
                            : undefined
                        }
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
                        <p
                          id="health-withdrawal-error"
                          role="alert"
                          className="text-sm text-error"
                        >
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
                      Care and notes
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={labelClass} htmlFor="health-advice">
                        Care advice (optional)
                      </label>
                      <textarea
                        id="health-advice"
                        value={formData.advice}
                        onChange={(e) =>
                          setFormData({ ...formData, advice: e.target.value })
                        }
                        placeholder="Instructions for the farmer"
                        className={textareaClass}
                      />
                    </div>
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
              disabled={mutation.isPending}
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
          onClick={() => {
            if (!submittingRef.current && !mutation.isPending) onClose();
          }}
        />
      </div>
    </AnimatePresence>
  );
};

export default WalkInHealthModal;
