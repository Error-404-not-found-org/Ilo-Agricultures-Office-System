import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Syringe,
  User,
  Activity,
  Search,
  MapPin,
  Phone,
  Mail,
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  History,
  ArrowLeft,
  CheckCircle2,
  Info,
  Dna,
  ChevronDown,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAIRequestErrorMessage } from "../../utils/aiRequestErrors";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import { CATTLE_BREEDS, CATTLE_SPECIES } from "../../constants/breeds";
import { getSireCodeByBreed } from "../../constants/sireRegistry";
import {
  normalizeTaskContext,
  validateTaskContextForAction,
  sanitizeReturnTo,
} from "../../utils/taskNavigation";
import TaskContextCard from "../../features/technician/TaskContextCard";
import TaskContextErrorView from "../../features/technician/TaskContextErrorView";
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

const inputClass = `w-full h-11 bg-base-100 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content placeholder:text-base-content/40 focus:border-primary focus:outline-none transition-all`;
const selectClass = `w-full h-11 bg-base-100 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content focus:border-primary focus:outline-none transition-all appearance-none cursor-pointer`;
const labelClass = `text-[10px] font-black text-base-content/50 uppercase tracking-[0.2em] ml-1 block mb-1.5`;
const cardClass = `bg-base-100 border border-base-300 rounded-2xl p-6 space-y-5 shadow-sm text-base-content`;

export default function WalkInInsemination() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const searchParams = new URLSearchParams(location.search);
  const taskIdQuery = searchParams.get("taskId");
  const returnTo = sanitizeReturnTo(location.state?.returnTo);
  const isTaskWorkflow = Boolean(taskIdQuery);
  const routedTaskContext = useMemo(() => {
    const routedContext = location.state?.taskContext;
    if (!routedContext) return null;
    if (routedContext.isValid === false) {
      return routedContext;
    }
    return normalizeTaskContext(routedContext);
  }, [location.state?.taskContext]);
  const {
    data: fetchedContext,
    isFetched: isContextFetched,
    isError: isContextQueryError,
    error: contextQueryError,
  } = useQuery({
    queryKey: ["task-context", taskIdQuery],
    queryFn: async () => {
      const response = await axiosInstance.get(`/tasks/${taskIdQuery}`);
      const responseData = response.data;
      if (responseData?.isValid === false) {
        return responseData;
      }
      return normalizeTaskContext(responseData);
    },
    enabled: isTaskWorkflow && !routedTaskContext,
    retry: false,
  });
  const taskContext =
    routedTaskContext ||
    fetchedContext ||
    null;
  const isContextLoading =
    isTaskWorkflow &&
    !routedTaskContext &&
    !isContextFetched &&
    !isContextQueryError;
  const validation =
    taskContext && taskContext.isValid !== false
      ? validateTaskContextForAction(taskContext)
      : null;
  const isWrongTaskType =
    Boolean(taskContext) &&
    taskContext.isValid !== false &&
    taskContext.taskType !== "AI";
  const isStateMissing =
    isTaskWorkflow &&
    !isContextLoading &&
    !isContextQueryError &&
    (
      !taskContext ||
      taskContext.isValid === false ||
      !validation?.valid ||
      isWrongTaskType
    );
  const isTaskPreview =
    isTaskWorkflow &&
    !isContextLoading &&
    !isContextQueryError &&
    Boolean(taskContext) &&
    taskContext.isValid !== false &&
    validation?.valid &&
    taskContext.taskType === "AI";
  // --- MODE: existing record lookup or full new registration ---
  const [isExistingRecord, setIsExistingRecord] = useState(
    () => !!isTaskWorkflow,
  );

  // Existing-record lookup state
  const [searchFarmer, setSearchFarmer] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedFarmerId, setSelectedFarmerId] = useState("");
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [isOverriding, setIsOverriding] = useState(false);

  const [formData, setFormData] = useState(() => ({
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
      sireCode: "",
      estrus: "Natural",
      status: "done",
    },
  }));

  const [prevTaskContext, setPrevTaskContext] = useState(null);
  if (taskContext !== prevTaskContext) {
    setPrevTaskContext(taskContext);
    if (taskContext) {
      setSearchFarmer(taskContext.farmerName || "");
      setSelectedFarmerId(taskContext.farmerId || "");
      setSelectedAnimalId(taskContext.animalId || "");
    }
  }

  // Synchronize context once loaded
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
      const res = await axiosInstance.get(
        `/animals/farmer/${selectedFarmerId}`,
      );
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: !!selectedFarmerId && isExistingRecord,
  });

  const contextError = useMemo(() => {
    if (!isTaskWorkflow) return null;
    if (isContextLoading) return null;
    if (!taskContext) return "Task context is missing.";
    if (taskContext.isValid === false) {
      return taskContext.message || "Invalid task context.";
    }

    if (farmers.length > 0) {
      const farmerExists = farmers.some((f) => f._id === taskContext.farmerId);
      if (!farmerExists) {
        return `Context Mismatch: Farmer "${taskContext.farmerName}" (ID: ${taskContext.farmerId}) was not found in the registry.`;
      }
    }

    if (selectedFarmerId && !isLoadingAnimals && animals.length > 0) {
      const targetAnimal = animals.find((a) => a._id === taskContext.animalId);
      if (!targetAnimal) {
        return `Context Mismatch: Animal Tag #${taskContext.animalReference} (ID: ${taskContext.animalId}) does not belong to farmer "${taskContext.farmerName}".`;
      }
    }

    return null;
  }, [
    isTaskWorkflow,
    isContextLoading,
    taskContext,
    farmers,
    animals,
    selectedFarmerId,
    isLoadingAnimals,
  ]);

  const selectedAnimal = useMemo(() => {
    return animals.find((a) => a._id === selectedAnimalId) || null;
  }, [animals, selectedAnimalId]);

  const showPregnancyWarning =
    selectedAnimal?.reproductiveStatus === "Pregnant";

  const ageWarning = useMemo(() => {
    if (!selectedAnimal || !selectedAnimal.birthDate) return "";
    const ageCheck = checkInseminationAgeEligibility(
      selectedAnimal.birthDate,
      selectedAnimal.species,
    );
    return ageCheck.isEligible ? "" : ageCheck.reason;
  }, [selectedAnimal]);

  const vwpWarning = useMemo(() => {
    if (!selectedAnimal || !selectedAnimal.lastCalvingDate) return "";
    const vwpCheck = verifyPostpartumWindow(
      selectedAnimal.lastCalvingDate,
      formData.inseminationDetails.inseminationDate || new Date(),
      selectedAnimal.species,
      selectedAnimal.breed,
    );
    return vwpCheck.isSafe
      ? ""
      : `Postpartum recovery: Rebreeding allowed after ${vwpCheck.requiredDays} days.`;
  }, [selectedAnimal, formData.inseminationDetails.inseminationDate]);

  // Barangay autocomplete for new-entry mode
  const [isBarangayDropdownOpen, setIsBarangayDropdownOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState("");

  const targetBarangays = useMemo(() => {
    const selectedCity = formData.address.city || "Oton";
    return getIloiloBarangayOptions(selectedCity, selectedDistrict);
  }, [formData.address.city, selectedDistrict]);

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
      const res = await axiosInstance.post(
        "/technician/walk-in-insemination",
        data,
      );
      return res.data;
    },
    onSuccess: (data) => {
      if (
        data?.outcome === "existing_and_task_completed" ||
        data?.outcome === "existing_task_reconciled"
      ) {
        toast.success(
          "AI Service record verified and task completed (reconciled).",
        );
      } else {
        toast.success("AI Transaction recorded successfully!");
      }
      queryClient.invalidateQueries({ queryKey: ["technician", "work-queue"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["farmer-animals"] });
      queryClient.invalidateQueries({ queryKey: ["inseminations"] });
      queryClient.invalidateQueries({
        queryKey: ["technician-requests-badge"],
      });
      queryClient.invalidateQueries({ queryKey: ["animal-history"] });
      queryClient.invalidateQueries({ queryKey: ["farmer-profile"] });
      queryClient.invalidateQueries({ queryKey: ["breeding-ledger"] });

      if (isTaskWorkflow && returnTo) {
        navigate(returnTo);
      } else {
        navigate(-1);
      }
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
      setIsOverriding(true);
    },
  });

  // --- HANDLERS ---
  const handleAnimalChange = (animalId) => {
    setSelectedAnimalId(animalId);
  };

  const handleSireBreedChange = (breed) => {
    const code =
      getSireCodeByBreed(breed) || formData.inseminationDetails.sireCode;
    setFormData({
      ...formData,
      inseminationDetails: {
        ...formData.inseminationDetails,
        sireBreed: breed,
        sireCode: code,
      },
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
        return toast.error(
          "Insemination is restricted to female animals only.",
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
        taskId: taskContext?.taskId || null,
        requestId: taskContext?.requestId || null,
      };
    } else {
      if (
        !formData.firstName ||
        !formData.lastName ||
        !formData.phoneNumber ||
        !formData.address.city ||
        !formData.address.barangay
      ) {
        return toast.error(
          "Please fill in all owner details (First Name, Last Name, Phone, Municipality/City, and Barangay).",
        );
      }
      if (formData.address.city === ILOILO_CITY_NAME && !selectedDistrict) {
        return toast.error("Please select the Iloilo City district.");
      }
      if (formData.phoneNumber.length < 11) {
        return toast.error("Phone number must be exactly 11 digits.");
      }
      if (!formData.phoneNumber.startsWith("09")) {
        return toast.error("Phone number must start with 09.");
      }
      if (!formData.animalDetails.earTag || !formData.animalDetails.breed) {
        return toast.error("Please fill in animal Ear Tag and Breed details.");
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

  if (isTaskWorkflow && isContextQueryError) {
    return (
      <TaskContextErrorView
        errorType="missing_info"
        title="Task could not be loaded"
        message={
          contextQueryError?.response?.data?.message ||
          "The task is unavailable, completed, or no longer assigned to you."
        }
        returnTo={returnTo}
      />
    );
  }
  if (isStateMissing) {
    const explicitInvalid = taskContext?.isValid === false;
    return (
      <TaskContextErrorView
        errorType={isWrongTaskType ? "unavailable" : "missing_info"}
        title={
          isWrongTaskType
            ? "Task target unavailable"
            : explicitInvalid
              ? "Task unavailable"
              : "Missing task information"
        }
        message={
          explicitInvalid && taskContext?.message
            ? taskContext.message
            : isWrongTaskType
              ? "This task must be completed using its correct service workflow."
              : validation?.message ||
                "This task does not contain enough information to open the service form."
        }
        returnTo={returnTo}
      />
    );
  }
  if (contextError) {
    return (
      <TaskContextErrorView
        errorType="mismatch"
        title="Context Mismatch Error"
        message={contextError}
        returnTo={returnTo}
      />
    );
  }

  if (contextError) {
    return (
      <TaskContextErrorView
        errorType="mismatch"
        title="Context Mismatch Error"
        message={contextError}
        returnTo={returnTo}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
      {/* Header */}
      <header className="bg-base-100/95 backdrop-blur border-b border-base-300 px-6 sm:px-8 h-16 flex items-center shrink-0 gap-4 sticky top-0 z-30">
        <button
          type="button"
          onClick={() => {
            if (location.state?.returnTo) {
              navigate(location.state.returnTo);
            } else {
              navigate(-1);
            }
          }}
          className="flex items-center gap-2 text-base-content/60 hover:text-primary font-bold text-xs uppercase tracking-widest transition-all group cursor-pointer"
        >
          <ArrowLeft
            size={14}
            className="group-hover:-translate-x-1 transition-transform"
          />
          Back
        </button>
        <div className="h-5 w-px bg-base-300" />
        <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
          <Syringe size={16} />
        </div>
        <div>
          <h1 className="text-sm font-black text-base-content leading-none">
            Walk-In AI Registration
          </h1>
          <p className="text-[10px] text-base-content/55 mt-0.5 font-medium">
            Field Protocol: Register new farmer, specimen & procedure in one
            cycle
          </p>
        </div>

        {config?.isHoliday && (
          <div className="ml-auto flex items-center gap-2 badge badge-error badge-soft px-4 py-2 rounded-xl">
            <AlertCircle size={14} className="text-error" />
            <span className="text-[10px] font-black uppercase tracking-wider">
              Off-Schedule Entry
            </span>
          </div>
        )}
      </header>

      <main className="flex-1 p-4 md:p-6 space-y-5 w-full">
        <div className="w-full space-y-5">
          {isTaskPreview && (
            <TaskContextCard
              taskContext={taskContext}
              mode="active"
            />
          )}

          {/* Mode / Status Toggle Bar */}
          {!isTaskWorkflow && (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-base-100 border border-base-300 rounded-2xl p-4 shadow-sm">
              {/* Record mode toggle */}
              <div className="inline-flex p-1 rounded-xl bg-base-200 border border-base-300">
                <button
                  type="button"
                  onClick={() => setIsExistingRecord(true)}
                  className={`px-5 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${isExistingRecord ? "bg-primary text-primary-content shadow-sm" : "text-base-content/60 hover:text-base-content"}`}
                >
                  Existing Record
                </button>
                <button
                  type="button"
                  onClick={() => setIsExistingRecord(false)}
                  className={`px-5 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${!isExistingRecord ? "bg-primary text-primary-content shadow-sm" : "text-base-content/60 hover:text-base-content"}`}
                >
                  Full Registration
                </button>
              </div>

              {/* Status toggle */}
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
                  className={`px-4 h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${formData.inseminationDetails.status !== "in-progress" ? "bg-success/15 border-success/30 text-success font-black" : "border-base-300 text-base-content/50"}`}
                >
                  Service Completed
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
                  className={`px-4 h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${formData.inseminationDetails.status === "in-progress" ? "bg-info/15 border-info/30 text-info font-black" : "border-base-300 text-base-content/50"}`}
                >
                  Schedule Visit
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* LEFT: Main Form */}
            <div className="xl:col-span-2 space-y-5">
              {/* --- EXISTING RECORD MODE --- */}
              {isExistingRecord ? (
                <div className={cardClass}>
                  <div className="flex items-center gap-2 pb-3 border-b border-base-200">
                    <BadgeCheck size={14} className="text-primary" />
                    <h4 className="text-[10px] font-black text-base-content/50 uppercase tracking-[0.2em]">
                      Registry Selection
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Farmer search */}
                    <div className="space-y-1.5">
                      <label className={labelClass}>Farmer Record</label>
                      <div className="relative">
                        <Search
                          size={14}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40"
                        />
                        <input
                          value={searchFarmer}
                          onChange={(e) => {
                            if (!isTaskWorkflow) {
                              setSearchFarmer(e.target.value);
                              setIsDropdownOpen(true);
                            }
                          }}
                          onFocus={() => {
                            if (!isTaskWorkflow) setIsDropdownOpen(true);
                          }}
                          disabled={isTaskWorkflow}
                          placeholder="Search farmer name..."
                          className={`${inputClass} pl-10 disabled:bg-base-200 disabled:opacity-80`}
                        />
                        <AnimatePresence>
                          {isDropdownOpen &&
                            searchFarmer &&
                            !isTaskWorkflow && (
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
                                        className="w-full px-4 py-3 text-left hover:bg-base-200 border-b border-base-200 last:border-0 cursor-pointer flex flex-col gap-0.5"
                                      >
                                        <span className="text-xs font-bold text-base-content">
                                          {farmer.name}
                                        </span>
                                        <span className="text-[9px] font-black text-base-content/50 uppercase tracking-widest">
                                          {farmer.phoneNumber || "No Contact"} •{" "}
                                          {typeof farmer.address === "string"
                                            ? farmer.address
                                            : farmer.address?.barangay ||
                                              "No Address"}
                                        </span>
                                      </button>
                                    ))
                                ) : (
                                  <div className="py-8 text-center text-[10px] font-black text-base-content/50 uppercase tracking-widest">
                                    No records found
                                  </div>
                                )}
                              </motion.div>
                            )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Animal select */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="walk-in-animal-select"
                        className={labelClass}
                      >
                        Animal Asset
                      </label>
                      <select
                        id="walk-in-animal-select"
                        name="walk-in-animal-select"
                        disabled={
                          !selectedFarmerId ||
                          isLoadingAnimals ||
                          isTaskWorkflow
                        }
                        value={selectedAnimalId}
                        onChange={(e) => handleAnimalChange(e.target.value)}
                        className={`${selectClass} disabled:opacity-50 ${showPregnancyWarning ? "border-rose-400" : ""}`}
                      >
                        <option value="">
                          {isLoadingAnimals
                            ? "Synchronizing..."
                            : "Select animal"}
                        </option>
                        {animals.map((a) => (
                          <option
                            key={a._id}
                            value={a._id}
                            disabled={a.gender === "Male"}
                          >
                            Tag #{a.earTag} ({a.breed}) —{" "}
                            {a.reproductiveStatus || "Normal"}
                            {a.gender === "Male" ? " (Male - Restricted)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Sire selection for existing record */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-base-200">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="walk-in-sire-breed-existing"
                        className={labelClass}
                      >
                        Sire Breed
                      </label>
                      <select
                        id="walk-in-sire-breed-existing"
                        name="walk-in-sire-breed-existing"
                        value={formData.inseminationDetails.sireBreed}
                        onChange={(e) => handleSireBreedChange(e.target.value)}
                        className={selectClass}
                      >
                        <option value="" disabled>
                          Select Sire Breed
                        </option>
                        {CATTLE_BREEDS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Sire Code (Auto)</label>
                      <div className="relative">
                        <Dna
                          size={14}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40"
                        />
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
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle
                              size={18}
                              className="text-rose-500 shrink-0 mt-0.5"
                            />
                            <div>
                              <h4 className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                                Pregnancy Warning
                              </h4>
                              <p className="text-[10px] font-medium text-rose-500/70 dark:text-rose-500/50 mt-1">
                                Asset recorded as PREGNANT. Insemination is
                                risky without field confirmation.
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              overrideMutation.mutate(selectedAnimalId)
                            }
                            disabled={overrideMutation.isPending}
                            className="shrink-0 px-5 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
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
                        className="overflow-hidden"
                      >
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex items-start gap-3">
                          <AlertTriangle
                            size={16}
                            className="text-amber-500 shrink-0 mt-0.5"
                          />
                          <div>
                            <h4 className="text-[9px] font-black text-amber-600 uppercase tracking-widest">
                              Age Eligibility Warning
                            </h4>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
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
                        className="overflow-hidden"
                      >
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex items-start gap-3">
                          <AlertTriangle
                            size={16}
                            className="text-amber-500 shrink-0 mt-0.5"
                          />
                          <div>
                            <h4 className="text-[9px] font-black text-amber-600 uppercase tracking-widest">
                              Postpartum Window Warning
                            </h4>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
                              {vwpWarning}
                            </p>
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
                    <div className="flex items-center gap-2 pb-3 border-b border-base-200">
                      <User size={14} className="text-primary" />
                      <h4 className="text-[10px] font-black text-base-content/50 uppercase tracking-[0.2em]">
                        Owner Data
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className={labelClass}>First Name *</label>
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
                        <label className={labelClass}>Last Name *</label>
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              lastName: e.target.value,
                            })
                          }
                          placeholder="DELA CRUZ"
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Email (Optional)</label>
                      <div className="relative">
                        <Mail
                          size={14}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          placeholder="juan@example.com"
                          className={`${inputClass} pl-10`}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Contact Number *</label>
                      <div className="relative">
                        <Phone
                          size={14}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className={labelClass}>
                          Municipality / City *
                        </label>
                        <div className="relative">
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
                            className={`${selectClass} pr-10 appearance-none cursor-pointer`}
                          >
                            {ILOILO_MUNICIPALITY_OPTIONS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={14}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                          />
                        </div>
                      </div>

                      {formData.address.city === ILOILO_CITY_NAME && (
                        <div className="space-y-1.5">
                          <label className={labelClass}>
                            Iloilo City District *
                          </label>
                          <div className="relative">
                            <select
                              value={selectedDistrict}
                              onChange={(e) => {
                                setSelectedDistrict(e.target.value);
                                setFormData({
                                  ...formData,
                                  address: {
                                    ...formData.address,
                                    barangay: "",
                                  },
                                });
                              }}
                              className={`${selectClass} pr-10 appearance-none cursor-pointer`}
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
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5 relative">
                        <label className={labelClass}>Barangay *</label>
                        <div className="relative">
                          <MapPin
                            size={14}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
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
                            className={`${inputClass} pl-10 disabled:opacity-50`}
                          />
                          <AnimatePresence>
                            {isBarangayDropdownOpen &&
                              formData.address.barangay && (
                                <motion.div
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -5 }}
                                  className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-xl rounded-xl custom-scrollbar"
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
                                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer"
                                        >
                                          {brgy}
                                        </button>
                                      ))
                                  ) : (
                                    <div className="py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                      No matches found
                                    </div>
                                  )}
                                </motion.div>
                              )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Animal / Asset Profile */}
                  <div className={cardClass}>
                    <div className="flex items-center gap-2 pb-3 border-b border-base-200">
                      <Activity size={14} className="text-primary" />
                      <h4 className="text-[10px] font-black text-base-content/50 uppercase tracking-[0.2em]">
                        Animal Profile
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className={labelClass}>Ear Tag *</label>
                        <input
                          type="text"
                          maxLength={10}
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
                          placeholder="TAG-0104"
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
                          className={selectClass}
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
                      <label className={labelClass}>Breed *</label>
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
                        className={selectClass}
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
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="walk-in-sire-breed"
                          className={labelClass}
                        >
                          Sire Breed *
                        </label>
                        <select
                          id="walk-in-sire-breed"
                          name="walk-in-sire-breed"
                          value={formData.inseminationDetails.sireBreed}
                          onChange={(e) =>
                            handleSireBreedChange(e.target.value)
                          }
                          className={selectClass}
                        >
                          <option value="" disabled>
                            Select Sire Breed
                          </option>
                          {CATTLE_BREEDS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelClass}>Sire Code (Auto)</label>
                        <div className="relative">
                          <Dna
                            size={14}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                          />
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
                  </div>
                </div>
              )}

              {/* Service Metrics — always shown */}
              <div className={cardClass}>
                <div className="flex items-center gap-2 pb-3 border-b border-base-200">
                  <History size={14} className="text-primary" />
                  <h4 className="text-[10px] font-black text-base-content/50 uppercase tracking-[0.2em]">
                    Service Metrics
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Mission Date</label>
                    <input
                      type="date"
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
                    <label className={labelClass}>T-Time</label>
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
                    <label className={labelClass}>Estrus Cycle</label>
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
              <div className="bg-primary text-primary-content rounded-2xl p-6 shadow-xl sticky top-20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-primary-content/10 rounded-xl flex items-center justify-center">
                    <Syringe size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60">
                      AI Protocol
                    </p>
                    <p className="text-sm font-black uppercase tracking-tight leading-none mt-0.5">
                      {formData.inseminationDetails.status === "done"
                        ? "Record Service"
                        : "Schedule Visit"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-6 text-[10px] font-semibold opacity-70 uppercase tracking-wider">
                  <div className="flex justify-between">
                    <span>Mode</span>
                    <span className="font-black opacity-100">
                      {isExistingRecord
                        ? "Existing Record"
                        : "Full Registration"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status</span>
                    <span className="font-black opacity-100">
                      {formData.inseminationDetails.status === "done"
                        ? "Completed"
                        : "Scheduled"}
                    </span>
                  </div>
                  {formData.inseminationDetails.sireBreed && (
                    <div className="flex justify-between">
                      <span>Sire</span>
                      <span className="font-black opacity-100">
                        {formData.inseminationDetails.sireBreed}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    mutation.isPending ||
                    (showPregnancyWarning && !isOverriding) ||
                    (isTaskWorkflow && taskContext?.taskType !== "AI")
                  }
                  className={`w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    formData.inseminationDetails.status === "done"
                      ? "bg-primary-content text-primary hover:bg-base-100 font-extrabold"
                      : "btn btn-info font-extrabold"
                  }`}
                >
                  {mutation.isPending ? (
                    <span>Synchronizing...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      {formData.inseminationDetails.status === "done"
                        ? "Commit AI Record"
                        : "Schedule AI Visit"}
                    </>
                  )}
                </button>
              </div>

              {/* Quick Guidance */}
              <div className={cardClass}>
                <div className="flex items-center gap-2 pb-3 border-b border-base-200">
                  <Info size={13} className="text-base-content/40" />
                  <h4 className="text-[10px] font-black text-base-content/50 uppercase tracking-[0.2em]">
                    Quick Guidance
                  </h4>
                </div>
                <ul className="space-y-3">
                  {[
                    "Use Existing Record for registered farmers & animals",
                    "Verify animal age & species eligibility before proceeding",
                    "Double-check sire breed — code is auto-generated",
                    "Male animals are strictly excluded from AI procedures",
                    "Pregnant animals require override confirmation",
                  ].map((tip, i) => (
                    <li
                      key={tip}
                      className="flex items-start gap-2.5 text-[10px] font-semibold text-base-content/70"
                    >
                      <div className="w-4 h-4 rounded bg-base-200 flex items-center justify-center text-[9px] font-black text-base-content/50 shrink-0 mt-0.5">
                        {i + 1}
                      </div>
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
