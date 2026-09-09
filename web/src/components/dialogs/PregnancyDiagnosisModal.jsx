import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Calendar,
  Search,
  Clock,
  Phone,
  Info,
} from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { toast } from "sonner";
import { calculateTargetCalvingDate } from "../../utils/cattleCore";
import {
  PREGNANCY_WORKFLOW_STAGE,
  getWorkflowStage,
} from "../../constants/technicianWorkflow";
import { buildPregnancyActionRequest } from "../../utils/taskNavigation";
import { getManilaDateKey } from "../../utils/healthRequestWorkflow";
import { getPregnancyReadinessFallback } from "../../utils/pregnancyReadinessFallback";
import ImagePreviewModal from "../ui/ImagePreviewModal";
import { formatFarmerLocation } from "./PregnancyLossReviewModal";

const PILOT_DIAGNOSTIC_METHODS = [
  {
    methodCode: "palpation",
    policyMethodCode: "rectal_palpation",
    label: "Manual Palpation",
  },
  {
    methodCode: "visual_observation",
    policyMethodCode: "clinical_examination",
    label: "Visual Assessment",
  },
  {
    methodCode: "farmer_interview",
    policyMethodCode: "clinical_examination",
    label: "Farmer Interview",
  },
  {
    methodCode: "other",
    policyMethodCode: "other_approved",
    label: "Other",
  },
];

const PregnancyDiagnosisModal = ({
  isOpen,
  onClose,
  taskData,
  onSuccess,
  preSelectedFarmer,
  preSelectedAnimal,
  taskId,
}) => {
  const queryClient = useQueryClient();
  const queuedTask = taskData?.raw || taskData || {};
  const isVerificationTask = Boolean(
    taskData &&
    (queuedTask.taskType === "PD" ||
      taskData.type === "breeding_verification" ||
      taskData.type === "pregnancy_check"),
  );
  const resolvedTaskId = taskId || queuedTask._id || queuedTask.id || null;
  const {
    data: taskDetails,
    isLoading: isLoadingTaskDetails,
    isError: isTaskDetailsError,
  } = useQuery({
    queryKey: ["technician", "tasks", "detail", resolvedTaskId || ""],
    queryFn: async () => {
      const response = await axiosInstance.get(
        `/tasks/${encodeURIComponent(resolvedTaskId)}`,
      );
      return response.data || null;
    },
    enabled: Boolean(isOpen && isVerificationTask && resolvedTaskId),
  });
  const rawTask = taskDetails || queuedTask;
  const workflowStage = getWorkflowStage(rawTask);
  const isInitialDiagnosis =
    !taskData || workflowStage === PREGNANCY_WORKFLOW_STAGE.INITIAL;
  const isContinuation =
    workflowStage === PREGNANCY_WORKFLOW_STAGE.CONTINUATION;
  const isDiagnosticFollowUp =
    workflowStage === PREGNANCY_WORKFLOW_STAGE.FOLLOW_UP;
  const isContinuationFlow = isContinuation || isDiagnosticFollowUp;
  const pregnancyId =
    rawTask.pregnancy?._id ||
    rawTask.metadata?.pregnancyId ||
    rawTask.relatedRecordId?._id ||
    rawTask.relatedRecordId;
  const taskReadiness = rawTask.pregnancyReadiness;

  // Form & UI state
  const [result, setResult] = useState("");
  const [note, setNote] = useState("");
  const [diagnosisDate, setDiagnosisDate] = useState(() => getManilaDateKey());
  const [followUpDate, setFollowUpDate] = useState("");
  const [diagnosticMethod, setDiagnosticMethod] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [minimumFollowUpDate] = useState(() =>
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const activeWorkflowIdentityRef = useRef(null);

  // Standalone selectors state
  const [selectedFarmerId, setSelectedFarmerId] = useState("");
  const [searchFarmer, setSearchFarmer] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [selectedInseminationId, setSelectedInseminationId] = useState("");

  const initialAnimal =
    preSelectedAnimal?._id ||
    preSelectedAnimal ||
    (isVerificationTask
      ? queuedTask.animalIds?.[0]?._id ||
        queuedTask.animalIds?.[0] ||
        queuedTask.animalId?._id ||
        queuedTask.animalId
      : "");
  const initialFarmer =
    preSelectedFarmer?._id ||
    preSelectedFarmer ||
    (isVerificationTask ? queuedTask.farmerId?._id || queuedTask.farmerId : "");
  const workflowIdentity = String(
    resolvedTaskId ||
      queuedTask.workflowId ||
      queuedTask.relatedRecordId?._id ||
      queuedTask.relatedRecordId ||
      initialAnimal ||
      "standalone-pregnancy",
  );

  // Reset state for a new workflow and handle Escape while idle.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isSubmitting && !previewImage) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      if (activeWorkflowIdentityRef.current === workflowIdentity) {
        return () => window.removeEventListener("keydown", handleKeyDown);
      }
      activeWorkflowIdentityRef.current = workflowIdentity;
      Promise.resolve().then(() => {
        setResult("");
        setNote("");
        setDiagnosisDate(getManilaDateKey());
        setFollowUpDate("");
        setDiagnosticMethod("");
        setSelectedFarmerId(initialFarmer || "");
        setSearchFarmer(preSelectedFarmer?.name || "");
        setIsDropdownOpen(false);
        setSelectedAnimalId(initialAnimal || "");
        setSelectedInseminationId("");
        setFieldErrors({});
        setIsSubmitting(false);
        setPreviewImage(null);
        if (preSelectedFarmer) {
          setSearchFarmer(preSelectedFarmer.name || "");
        }
      });
    } else {
      activeWorkflowIdentityRef.current = null;
      Promise.resolve().then(() => {
        setResult("");
        setNote("");
        setDiagnosisDate(getManilaDateKey());
        setFollowUpDate("");
        setDiagnosticMethod("");
        setSelectedFarmerId("");
        setSearchFarmer("");
        setIsDropdownOpen(false);
        setSelectedAnimalId("");
        setSelectedInseminationId("");
        setFieldErrors({});
        setIsSubmitting(false);
        setPreviewImage(null);
      });
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isOpen,
    onClose,
    workflowIdentity,
    initialAnimal,
    initialFarmer,
    preSelectedFarmer,
    isSubmitting,
    previewImage,
  ]);

  // Queries for standalone mode
  const {
    data: farmers = [],
    error: farmersError,
    isError: isFarmersError,
    isLoading: isLoadingFarmers,
  } = useQuery({
    queryKey: ["farmers", "list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=farmer");
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: isOpen && !taskData,
  });

  const {
    data: animals = [],
    isError: isAnimalsError,
    isLoading: isLoadingAnimals,
  } = useQuery({
    queryKey: ["farmer-animals", selectedFarmerId],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `/animals/farmer/${selectedFarmerId}`,
      );
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: !!selectedFarmerId && isOpen && !taskData,
  });

  const { data: animalHistory = {} } = useQuery({
    queryKey: ["animal-history", selectedAnimalId],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `/technician/animal-history/${selectedAnimalId}`,
      );
      return res.data || {};
    },
    enabled: !!selectedAnimalId && isOpen && !taskData,
  });

  // Determine current animal & breeding attempt references
  const linkedInsemination = isVerificationTask
    ? rawTask.insemination || null
    : null;
  const animal = taskData
    ? isVerificationTask
      ? linkedInsemination?.animalId || rawTask.animalIds?.[0] || {}
      : taskData.animal || taskData.raw?.animalId || {}
    : animals.find((a) => a._id === selectedAnimalId) || {};

  const animalId = taskData
    ? animal._id || animal.id || (typeof animal === "string" ? animal : null)
    : selectedAnimalId;

  const inseminationId = taskData
    ? isVerificationTask
      ? linkedInsemination?._id ||
        rawTask.metadata?.inseminationId ||
        taskData.inseminationId
      : taskData.id
    : selectedInseminationId;

  const historyInseminations = taskData
    ? isVerificationTask
      ? linkedInsemination
        ? [linkedInsemination]
        : []
      : animal.breedingRecords || []
    : animalHistory.inseminations || [];

  const validInseminations =
    taskData && !isVerificationTask
      ? []
      : historyInseminations.filter(
          (item) =>
            ["done", "resolved", "completed"].includes(
              String(item.status || "")
                .trim()
                .toLowerCase(),
            ) &&
            (!item.outcome || item.outcome === "Pending"),
        );

  // Auto-select latest pending insemination for standalone mode
  useEffect(() => {
    if (!taskData && animalHistory && animalHistory.inseminations) {
      const historyInsem = animalHistory.inseminations || [];
      const valid = historyInsem.filter(
        (item) =>
          ["done", "resolved", "completed"].includes(
            String(item.status || "")
              .trim()
              .toLowerCase(),
          ) &&
          (!item.outcome || item.outcome === "Pending"),
      );
      if (valid.length > 0) {
        const sorted = [...valid].sort(
          (a, b) => (b.attemptNumber || 0) - (a.attemptNumber || 0),
        );
        Promise.resolve().then(() => {
          setSelectedInseminationId(sorted[0]._id || sorted[0].id);
        });
      } else {
        Promise.resolve().then(() => {
          setSelectedInseminationId("");
        });
      }
    } else if (!taskData) {
      Promise.resolve().then(() => {
        setSelectedInseminationId("");
      });
    }
  }, [animalHistory, taskData]);

  const selectedInsemination = taskData
    ? isVerificationTask
      ? linkedInsemination
      : null
    : validInseminations.find(
        (i) => (i._id || i.id) === selectedInseminationId,
      );
  const readiness =
    taskReadiness ||
    selectedInsemination?.pregnancyReadiness ||
    getPregnancyReadinessFallback(selectedInsemination?.inseminationDate);
  const methodsEligible = readiness ? readiness.isEligible : true;
  const diagnosticMethods = PILOT_DIAGNOSTIC_METHODS.map((method) => {
    const policyMethod = readiness?.methods?.find(
      (candidate) =>
        candidate.methodCode === method.policyMethodCode ||
        candidate.methodCode === method.methodCode,
    );
    return {
      ...method,
      enabled: policyMethod?.enabled ?? true,
      isEligible: policyMethod?.isEligible ?? methodsEligible,
      reason: policyMethod?.reason || readiness?.reason,
    };
  });
  const isFinalizedVerification = Boolean(
    isVerificationTask &&
    (["completed", "cancelled", "rejected"].includes(
      String(rawTask.status || "").toLowerCase(),
    ) ||
      rawTask.pregnancy?.pregnancyDiagnosis?.result),
  );

  // Calculate days since AI
  let daysSinceAI = Number.isFinite(readiness?.daysPostAI)
    ? readiness.daysPostAI
    : 0;
  if (!daysSinceAI && taskData && !isVerificationTask) {
    daysSinceAI = taskData.daysSinceAI || 0;
  }

  // Estimate calving drop date
  const baseInseminationDate =
    selectedInsemination?.inseminationDate ||
    (taskData && !isVerificationTask ? taskData.inseminationDate : null) ||
    new Date();
  const estCalvingDate = calculateTargetCalvingDate(
    baseInseminationDate,
    animal?.species || "Cattle",
    undefined,
    animal?.breed,
  ).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const farmer =
    (typeof rawTask?.farmerId === "object" ? rawTask.farmerId : null) ||
    (typeof rawTask?.farmer === "object" ? rawTask.farmer : null) ||
    (typeof rawTask?.context?.farmer === "object"
      ? rawTask.context.farmer
      : null) ||
    preSelectedFarmer ||
    (selectedFarmerId ? farmers.find((f) => f._id === selectedFarmerId) : null);

  const farmerPhone =
    typeof farmer?.phoneNumber === "string" && farmer.phoneNumber.trim()
      ? farmer.phoneNumber.trim()
      : typeof farmer?.phone === "string" && farmer.phone.trim()
        ? farmer.phone.trim()
        : typeof farmer?.contactNumber === "string" &&
            farmer.contactNumber.trim()
          ? farmer.contactNumber.trim()
          : null;

  const farmerLocation = formatFarmerLocation(farmer, "Location not provided");

  const farmerName =
    (typeof farmer?.name === "string" && farmer.name.trim()) ||
    (typeof farmer?.fullName === "string" && farmer.fullName.trim()) ||
    [farmer?.firstName, farmer?.lastName]
      .filter((p) => typeof p === "string" && p.trim().length > 0)
      .join(" ") ||
    "";

  const animalEarTag =
    (typeof animal?.earTag === "string" && animal.earTag.trim()) ||
    (typeof animal?.tag === "string" && animal.tag.trim()) ||
    "";
  const animalName =
    (typeof animal?.name === "string" && animal.name.trim()) || "";
  const animalDisplayName =
    animalName ||
    (animalEarTag
      ? `Tag #${animalEarTag}`
      : animal.animalId || "Animal details unavailable");

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const nextErrors = {};
    if (!taskData && !selectedFarmerId) {
      nextErrors.farmer = "Please select a livestock owner.";
    }
    if (!animalId) {
      nextErrors.animal = "Please select a female animal.";
    }
    if (!isContinuationFlow && !inseminationId) {
      nextErrors.insemination = "Please select a completed breeding service.";
    }
    if (isContinuationFlow && !pregnancyId) {
      nextErrors.form =
        "The related pregnancy record is missing from this task.";
    }
    if (!result) {
      nextErrors.result = "Please select a diagnosis outcome.";
    }
    if (
      isInitialDiagnosis &&
      !diagnosticMethod
    ) {
      nextErrors.diagnosticMethod = "Please select an examination method.";
    }
    const officialDiagnosis = isVerificationTask
      ? ["pregnant", "not_pregnant"].includes(result)
      : ["Pregnant", "Empty"].includes(result);
    if (
      isInitialDiagnosis &&
      officialDiagnosis &&
      readiness &&
      !readiness.isEligible
    ) {
      nextErrors.form =
        readiness.reason || "Pregnancy diagnosis is not available yet.";
    }
    const diagnosisTimestamp = new Date(diagnosisDate).getTime();
    if (!diagnosisDate || Number.isNaN(diagnosisTimestamp)) {
      nextErrors.diagnosisDate = "Please enter a valid examination date.";
    } else if (diagnosisTimestamp > new Date().getTime()) {
      nextErrors.diagnosisDate = "Examination date cannot be in the future.";
    } else if (
      selectedInsemination?.inseminationDate &&
      diagnosisTimestamp <
        new Date(selectedInsemination.inseminationDate).setUTCHours(0, 0, 0, 0)
    ) {
      nextErrors.diagnosisDate =
        "Examination date cannot be earlier than the breeding service date.";
    }
    if (["follow_up_required", "needs_recheck"].includes(result)) {
      const followUpTimestamp = new Date(followUpDate).getTime();
      if (
        !followUpDate ||
        Number.isNaN(followUpTimestamp) ||
        followUpTimestamp <= diagnosisTimestamp
      ) {
        nextErrors.followUpDate =
          "Please choose a follow-up date after the examination date.";
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const checkedAt = new Date(
        `${diagnosisDate}T12:00:00.000Z`,
      ).toISOString();
      const request =
        isVerificationTask && !isContinuationFlow
          ? {
              url: `/ai-request/${encodeURIComponent(inseminationId)}/verify-breeding-observation`,
              payload: {
                verificationResult: result,
                checkMethod: diagnosticMethod,
                checkedAt,
                technicianNotes: note,
                ...(result === "needs_recheck" && followUpDate
                  ? {
                      nextCheckDate: new Date(
                        `${followUpDate}T12:00:00.000Z`,
                      ).toISOString(),
                    }
                  : {}),
                ...(readiness?.policyVersion
                  ? { policyVersion: readiness.policyVersion }
                  : {}),
                taskId: rawTask._id || resolvedTaskId,
              },
            }
          : buildPregnancyActionRequest({
              task: { ...rawTask, pregnancyReadiness: readiness },
              animalId,
              inseminationId,
              result,
              note,
              diagnosisDate,
              taskId: taskId || taskData?.id,
              followUpDate,
              diagnosticMethod,
            });
      await axiosInstance.post(request.url, request.payload);

      const successMessage = isContinuationFlow
        ? "Pregnancy follow-up recorded successfully."
        : `Diagnosis recorded: ${result === "Pregnant" || result === "pregnant" ? "Confirmed Pregnant" : result === "Empty" || result === "not_pregnant" ? "Not Pregnant" : result.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;

      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["technician"] }),
        queryClient.invalidateQueries({ queryKey: ["farmer-animals"] }),
        queryClient.invalidateQueries({ queryKey: ["animal-history"] }),
        queryClient.invalidateQueries({ queryKey: ["animal", animalId] }),
      ]);
      if (onSuccess) onSuccess();
      onClose();
      toast.success(successMessage);
    } catch (err) {
      setFieldErrors((current) => ({
        ...current,
        form:
          err.response?.data?.message ||
          "Unable to save diagnosis. Please try again.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="modal modal-open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pregnancy-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="modal-box relative max-h-[90vh] w-11/12 max-w-2xl flex flex-col p-0 overflow-hidden bg-base-100 rounded-3xl shadow-2xl border border-base-300"
        >
          {/* Header: Title & Subtitle & Close */}
          <div className="flex items-center justify-between border-b border-base-300 bg-base-100 px-5 py-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3
                  id="pregnancy-modal-title"
                  className="text-base md:text-lg font-bold text-base-content leading-tight"
                >
                  {isContinuation
                    ? "Pregnancy Recheck"
                    : isDiagnosticFollowUp
                      ? "Diagnostic Follow-up"
                      : "Record Pregnancy Diagnosis"}
                </h3>
                <p className="text-xs text-base-content/70 mt-0.5">
                  {isContinuation
                    ? "Verify ongoing gestation and record recheck outcome"
                    : isDiagnosticFollowUp
                      ? "Record follow-up clinical examination findings"
                      : "Record examination findings and determine clinical outcome"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !isSubmitting && onClose()}
              disabled={isSubmitting}
              className="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:text-base-content"
              aria-label="Close diagnosis form"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 md:p-6 overflow-y-auto space-y-5 custom-scrollbar">
            {/* Standalone selectors (only when not started from task) */}
            {!taskData && (
              <div className="border border-base-300 rounded-2xl p-4 space-y-4 mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                  Select Patient & Breeding Record
                </span>
                {/* Livestock Owner Selector */}
                <div>
                  <label
                    className="label-text text-xs font-semibold text-base-content/80 block mb-1"
                    htmlFor="pregnancy-farmer-search"
                  >
                    Livestock Owner
                  </label>
                  {preSelectedFarmer ? (
                    <div className="flex items-center gap-3 h-10 bg-base-200/50 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content/70 select-none">
                      <span className="truncate">{preSelectedFarmer.name}</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40"
                      />
                      <input
                        id="pregnancy-farmer-search"
                        value={searchFarmer}
                        onChange={(e) => {
                          setSearchFarmer(e.target.value);
                          setSelectedFarmerId("");
                          setSelectedAnimalId("");
                          setSelectedInseminationId("");
                          setFieldErrors((current) => ({
                            ...current,
                            farmer: null,
                            animal: null,
                            insemination: null,
                          }));
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        onBlur={() =>
                          setTimeout(() => setIsDropdownOpen(false), 200)
                        }
                        placeholder="Search farmer by name or phone..."
                        className="input input-bordered w-full text-xs font-semibold pl-10 rounded-xl"
                      />
                      <AnimatePresence>
                        {isDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            role="listbox"
                            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-1 shadow-xl custom-scrollbar"
                          >
                            {isLoadingFarmers ? (
                              <div className="space-y-2 p-3">
                                <div className="skeleton h-8 w-full rounded-lg" />
                                <div className="skeleton h-8 w-full rounded-lg" />
                              </div>
                            ) : isFarmersError ? (
                              <div className="alert alert-error m-2 w-auto text-xs rounded-xl">
                                <span>
                                  {farmersError?.response?.data?.message ||
                                    "Unable to load farmers."}
                                </span>
                              </div>
                            ) : farmers.filter(
                                (f) =>
                                  (f.name || "")
                                    .toLowerCase()
                                    .includes(searchFarmer.toLowerCase()) ||
                                  (f.phoneNumber || "")
                                    .toLowerCase()
                                    .includes(searchFarmer.toLowerCase()),
                              ).length > 0 ? (
                              farmers
                                .filter(
                                  (f) =>
                                    (f.name || "")
                                      .toLowerCase()
                                      .includes(searchFarmer.toLowerCase()) ||
                                    (f.phoneNumber || "")
                                      .toLowerCase()
                                      .includes(searchFarmer.toLowerCase()),
                                )
                                .map((farmer) => (
                                  <button
                                    key={farmer._id}
                                    type="button"
                                    role="option"
                                    onClick={() => {
                                      setSelectedFarmerId(farmer._id);
                                      setSelectedAnimalId("");
                                      setSearchFarmer(farmer.name);
                                      setIsDropdownOpen(false);
                                      setFieldErrors((current) => ({
                                        ...current,
                                        farmer: null,
                                        animal: null,
                                        insemination: null,
                                      }));
                                    }}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-base-200 cursor-pointer"
                                  >
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                      {(farmer.name || "Farmer")
                                        .substring(0, 2)
                                        .toUpperCase()}
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate text-xs font-bold text-base-content">
                                        {farmer.name}
                                      </span>
                                    </span>
                                  </button>
                                ))
                            ) : (
                              <p className="px-4 py-6 text-center text-xs font-medium text-base-content/60">
                                No farmers found
                              </p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  {fieldErrors.farmer && (
                    <p role="alert" className="text-xs text-error font-medium mt-1">
                      {fieldErrors.farmer}
                    </p>
                  )}
                </div>

                {/* Animal Selector */}
                <div>
                  <label
                    className="label-text text-xs font-semibold text-base-content/80 block mb-1"
                    htmlFor="pregnancy-animal"
                  >
                    Animal
                  </label>
                  {preSelectedAnimal ? (
                    <div className="flex items-center gap-3 h-10 bg-base-200/50 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content/70 select-none">
                      <span className="truncate">
                        Tag #{preSelectedAnimal.earTag} (
                        {preSelectedAnimal.breed || "Crossbreed"})
                      </span>
                    </div>
                  ) : (
                    <select
                      id="pregnancy-animal"
                      disabled={
                        !selectedFarmerId || isLoadingAnimals || isAnimalsError
                      }
                      value={selectedAnimalId}
                      onChange={(e) => {
                        setSelectedAnimalId(e.target.value);
                        setSelectedInseminationId("");
                        setFieldErrors((current) => ({
                          ...current,
                          animal: null,
                          insemination: null,
                        }));
                      }}
                      className="select select-bordered w-full text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                    >
                      <option value="">
                        {isLoadingAnimals
                          ? "Loading animals..."
                          : "Select a female animal..."}
                      </option>
                      {animals.map((a) => (
                        <option
                          key={a._id}
                          value={a._id}
                          disabled={
                            a.gender === "Male" ||
                            a.reproductiveStatus === "Pregnant"
                          }
                        >
                          Tag #{a.earTag} ({a.breed}) -{" "}
                          {a.reproductiveStatus || "Normal"}
                        </option>
                      ))}
                    </select>
                  )}
                  {fieldErrors.animal && (
                    <p role="alert" className="text-xs text-error font-medium mt-1">
                      {fieldErrors.animal}
                    </p>
                  )}
                </div>

                {/* Breeding Service Reference */}
                {selectedAnimalId && (
                  <div>
                    <label
                      className="label-text text-xs font-semibold text-base-content/80 block mb-1"
                      htmlFor="pregnancy-insemination"
                    >
                      Breeding Service Reference
                    </label>
                    <select
                      id="pregnancy-insemination"
                      value={selectedInseminationId}
                      onChange={(e) => {
                        setSelectedInseminationId(e.target.value);
                        setDiagnosticMethod("");
                        setFieldErrors((current) => ({
                          ...current,
                          insemination: null,
                          diagnosticMethod: null,
                        }));
                      }}
                      className="select select-bordered w-full text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      <option value="" disabled>
                        Select completed AI service...
                      </option>
                      {validInseminations.map((item) => (
                        <option
                          key={item._id || item.id}
                          value={item._id || item.id}
                        >
                          Attempt #{item.attemptNumber || 1} -{" "}
                          {formatDate(item.inseminationDate)}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.insemination && (
                      <p role="alert" className="text-xs text-error font-medium mt-1">
                        {fieldErrors.insemination}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Context & Readiness */}
            {isVerificationTask && isLoadingTaskDetails ? (
              <div className="skeleton h-28 w-full rounded-2xl" />
            ) : taskData || selectedInseminationId ? (
              <div className="space-y-4">
                {/* Animal & Farmer Cards Grid */}
                <div
                  className={`grid grid-cols-1 ${farmerName ? "sm:grid-cols-2" : ""} gap-3`}
                >
                  {/* Mother Animal */}
                  <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block mb-2">
                      Mother Animal (Dam)
                    </span>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-base-content">
                          {animalDisplayName}
                        </h4>
                        <p className="text-xs text-base-content/70 mt-0.5">
                          {[
                            animalEarTag && `Tag ${animalEarTag}`,
                            animal.species,
                            animal.breed,
                          ]
                            .filter(Boolean)
                            .join(" • ") || "Breed not recorded"}
                        </p>
                      </div>
                      {animal.reproductiveStatus && (
                        <span className="badge badge-sm font-semibold badge-ghost">
                          {animal.reproductiveStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Livestock Owner */}
                  {farmerName && (
                    <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block mb-2">
                        Livestock Owner
                      </span>
                      <h4 className="font-bold text-sm text-base-content">
                        {farmerName}
                      </h4>
                      <p className="text-xs text-base-content/70 mt-0.5">
                        {farmerLocation}
                      </p>
                      {farmerPhone ? (
                        <a
                          href={`tel:${farmerPhone}`}
                          className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold mt-2 hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {farmerPhone}
                        </a>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Service Details */}
                {isVerificationTask && selectedInsemination && (
                  <div className="border border-base-300 rounded-2xl p-4 space-y-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                      Breeding Service Details
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="bg-base-100 border border-base-200 rounded-xl p-3">
                        <span className="text-[10px] font-semibold uppercase text-base-content/60 block">
                          Service Date
                        </span>
                        <span className="text-xs font-bold text-base-content">
                          {formatDate(selectedInsemination.inseminationDate)}
                        </span>
                      </div>
                      <div className="bg-base-100 border border-base-200 rounded-xl p-3">
                        <span className="text-[10px] font-semibold uppercase text-base-content/60 block">
                          Attempt
                        </span>
                        <span className="text-xs font-bold text-base-content">
                          #{selectedInsemination.attemptNumber ?? "Not recorded"}
                        </span>
                      </div>
                      <div className="bg-base-100 border border-base-200 rounded-xl p-3">
                        <span className="text-[10px] font-semibold uppercase text-base-content/60 block">
                          Sire
                        </span>
                        <span className="text-xs font-bold text-base-content truncate block">
                          {selectedInsemination.sireCode ||
                            selectedInsemination.sireBreed ||
                            "Not recorded"}
                          {selectedInsemination.sireCode &&
                          selectedInsemination.sireBreed
                            ? ` · ${selectedInsemination.sireBreed}`
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Farmer's Observation Report */}
                {isVerificationTask && selectedInsemination && (
                  <div className="border border-base-300 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-base-content">
                        Farmer's Observation Report
                      </h4>
                      {selectedInsemination.farmerPregnancyReport &&
                        (selectedInsemination.pregnancyReportVerificationStatus ===
                          "pending" ||
                          !selectedInsemination.pregnancyReportVerificationStatus) && (
                          <span className="badge badge-warning badge-sm font-semibold text-[10px]">
                            Pending verification
                          </span>
                        )}
                    </div>
                    {selectedInsemination.farmerPregnancyReport ? (
                      <div className="space-y-3 text-xs">
                        {selectedInsemination.farmerPregnancyReportedAt && (
                          <div className="bg-base-100 border border-base-200 rounded-xl p-3 flex items-center gap-3">
                            <Clock className="h-4 w-4 text-primary shrink-0" />
                            <div>
                              <span className="text-[10px] font-semibold uppercase text-base-content/60 block">
                                Reported
                              </span>
                              <span className="text-xs font-bold text-base-content">
                                {formatDate(
                                  selectedInsemination.farmerPregnancyReportedAt,
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                        {selectedInsemination.farmerPregnancyNotes && (
                          <div>
                            <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1">
                              Notes from farmer:
                            </span>
                            <p className="bg-base-100 border border-base-200 rounded-xl p-3 text-xs leading-relaxed text-base-content font-medium">
                              {selectedInsemination.farmerPregnancyNotes}
                            </p>
                          </div>
                        )}
                        {Array.isArray(
                          selectedInsemination.farmerPregnancyPhotos,
                        ) &&
                          selectedInsemination.farmerPregnancyPhotos.length >
                            0 && (
                            <div>
                              <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1.5">
                                Supporting photos ({selectedInsemination.farmerPregnancyPhotos.length})
                              </span>
                              <div className="flex flex-wrap gap-2.5">
                                {selectedInsemination.farmerPregnancyPhotos.map(
                                  (photo, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setPreviewImage(photo)}
                                      className="w-16 h-16 rounded-xl border border-base-300 overflow-hidden hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                                      aria-label={`View photo ${idx + 1}`}
                                    >
                                      <img
                                        src={photo}
                                        alt={`Farmer pregnancy evidence ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    ) : (
                      <p className="text-xs text-base-content/60 font-medium">
                        No observation report submitted by farmer.
                      </p>
                    )}
                  </div>
                )}

                {/* Diagnosis Window / Readiness Banner */}
                <div className="border border-base-300 rounded-2xl p-4 bg-base-200/50">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        readiness?.isEligible !== false
                          ? "bg-primary/10 text-primary"
                          : "bg-warning/15 text-warning"
                      }`}
                    >
                      <Sparkles size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="text-xs font-bold text-base-content">
                          Diagnosis Window
                        </span>
                        {daysSinceAI > 0 && (
                          <span className="text-[11px] text-base-content/60 font-medium">
                            • {daysSinceAI} days since Inseminated
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-base-content/70 mt-0.5 font-medium">
                        {readiness?.policyMode === "method_based" &&
                        readiness.methods?.length > 0
                          ? readiness.methods
                              .filter((m) => m.enabled && m.isEligible)
                              .map((m) => m.label)
                              .join(" · ") || "Manual examination"
                          : "Manual examination"}
                      </p>
                      <p
                        className={`text-xs font-bold mt-1.5 ${
                          readiness?.isEligible !== false
                            ? "text-success"
                            : "text-amber-600"
                        }`}
                      >
                        {readiness?.isEligible !== false
                          ? "Ready for diagnosis"
                          : (() => {
                              const checkDateStr =
                                rawTask?.dueDate ||
                                readiness?.availableDate ||
                                readiness?.earliestAvailableMethod
                                  ?.availableDate;
                              const checkDate = checkDateStr
                                ? new Date(checkDateStr)
                                : null;
                              const isValidDate =
                                checkDate &&
                                !Number.isNaN(checkDate.getTime());
                              return isValidDate
                                ? `Available from ${formatDate(checkDate)}`
                                : readiness?.reason || "Not yet available";
                            })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Farmer Outcome Report */}
                {selectedInsemination?.farmerOutcomeReport && (
                  <div className="alert alert-info/15 border-info/30 rounded-2xl p-3.5 text-xs">
                    <div className="flex items-start gap-2.5">
                      <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-base-content">
                          Farmer's Report:{" "}
                          <span className="capitalize">
                            {String(
                              selectedInsemination.farmerOutcomeReport,
                            ).replaceAll("_", " ")}
                          </span>
                        </p>
                        {selectedInsemination.farmerObservationNotes && (
                          <p className="text-base-content/75 mt-0.5 leading-relaxed font-medium">
                            {selectedInsemination.farmerObservationNotes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {fieldErrors.form && (
              <div
                className="alert alert-error/15 border-error/30 text-xs text-error flex items-start gap-3 rounded-2xl py-3 px-4"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-error mt-0.5" />
                <span className="font-semibold">{fieldErrors.form}</span>
              </div>
            )}

            {isFinalizedVerification && (
              <div
                className="alert alert-info/15 border-info/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4"
                role="status"
              >
                <Info className="h-4 w-4 shrink-0 text-info mt-0.5" />
                <div>
                  <p className="font-bold text-base-content">
                    Diagnosis Finalized
                  </p>
                  <p className="mt-0.5 leading-relaxed text-base-content/75">
                    This pregnancy diagnosis has already been finalized. Review
                    it from the official record.
                  </p>
                </div>
              </div>
            )}

            {/* Main Diagnosis Form */}
            {(taskData || selectedInseminationId) &&
              !isLoadingTaskDetails &&
              !isTaskDetailsError &&
              !isFinalizedVerification && (
                <div className="space-y-4">
                  {/* Diagnosis Outcome Selector */}
                  <div className="border border-base-300 rounded-2xl p-4 space-y-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                      Diagnosis Outcome
                    </span>
                    <p className="text-xs text-base-content/70 -mt-1.5">
                      Select the result of your examination to proceed with the
                      diagnosis.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        aria-pressed={
                          result ===
                          (isContinuationFlow
                            ? "continuing"
                            : isVerificationTask
                              ? "pregnant"
                              : "Pregnant")
                        }
                        onClick={() => {
                          setResult(
                            isContinuationFlow
                              ? "continuing"
                              : isVerificationTask
                                ? "pregnant"
                                : "Pregnant",
                          );
                          setFieldErrors((current) => ({
                            ...current,
                            result: null,
                            followUpDate: null,
                          }));
                        }}
                        className={`group flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          result ===
                          (isContinuationFlow
                            ? "continuing"
                            : isVerificationTask
                              ? "pregnant"
                              : "Pregnant")
                            ? "border-success bg-success/15 text-success shadow-sm"
                            : "border-base-300 bg-base-100 hover:border-success/50 hover:bg-success/5 text-base-content"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle
                            size={16}
                            className={
                              result ===
                              (isContinuationFlow
                                ? "continuing"
                                : isVerificationTask
                                  ? "pregnant"
                                  : "Pregnant")
                                ? "text-success"
                                : "text-success/70"
                            }
                          />
                          <span className="font-bold text-xs">
                            {isContinuationFlow
                              ? "Pregnancy Continuing"
                              : "Confirmed Pregnant"}
                          </span>
                        </div>
                        <span className="text-[10px] text-base-content/65 font-normal leading-tight">
                          Pregnancy confirmed
                        </span>
                      </button>

                      <button
                        type="button"
                        aria-pressed={
                          result ===
                          (isContinuationFlow
                            ? "loss_detected"
                            : isVerificationTask
                              ? "not_pregnant"
                              : "Empty")
                        }
                        onClick={() => {
                          setResult(
                            isContinuationFlow
                              ? "loss_detected"
                              : isVerificationTask
                                ? "not_pregnant"
                                : "Empty",
                          );
                          setFieldErrors((current) => ({
                            ...current,
                            result: null,
                            followUpDate: null,
                          }));
                        }}
                        className={`group flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          result ===
                          (isContinuationFlow
                            ? "loss_detected"
                            : isVerificationTask
                              ? "not_pregnant"
                              : "Empty")
                            ? "border-error bg-error/15 text-error shadow-sm"
                            : "border-base-300 bg-base-100 hover:border-error/50 hover:bg-error/5 text-base-content"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <AlertCircle
                            size={16}
                            className={
                              result ===
                              (isContinuationFlow
                                ? "loss_detected"
                                : isVerificationTask
                                  ? "not_pregnant"
                                  : "Empty")
                                ? "text-error"
                                : "text-error/70"
                            }
                          />
                          <span className="font-bold text-xs">
                            {isContinuationFlow
                              ? "Pregnancy Loss"
                              : "Not Pregnant"}
                          </span>
                        </div>
                        <span className="text-[10px] text-base-content/65 font-normal leading-tight">
                          No pregnancy detected
                        </span>
                      </button>

                      {isVerificationTask && !isContinuationFlow && (
                        <>
                          <button
                            type="button"
                            aria-pressed={result === "return_to_heat"}
                            onClick={() => {
                              setResult("return_to_heat");
                              setFieldErrors((current) => ({
                                ...current,
                                result: null,
                                followUpDate: null,
                              }));
                            }}
                            className={`group flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              result === "return_to_heat"
                                ? "border-warning bg-warning/15 text-warning-content shadow-sm"
                                : "border-base-300 bg-base-100 hover:border-warning/50 hover:bg-warning/5 text-base-content"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Sparkles
                                size={16}
                                className={
                                  result === "return_to_heat"
                                    ? "text-warning"
                                    : "text-warning/70"
                                }
                              />
                              <span className="font-bold text-xs">
                                Returned to Heat
                              </span>
                            </div>
                            <span className="text-[10px] text-base-content/65 font-normal leading-tight">
                              Heat cycle observed
                            </span>
                          </button>

                          <button
                            type="button"
                            aria-pressed={result === "needs_recheck"}
                            onClick={() => {
                              setResult("needs_recheck");
                              setFieldErrors((current) => ({
                                ...current,
                                result: null,
                              }));
                            }}
                            className={`group flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              result === "needs_recheck"
                                ? "border-info bg-info/15 text-info shadow-sm"
                                : "border-base-300 bg-base-100 hover:border-info/50 hover:bg-info/5 text-base-content"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Calendar
                                size={16}
                                className={
                                  result === "needs_recheck"
                                    ? "text-info"
                                    : "text-info/70"
                                }
                              />
                              <span className="font-bold text-xs">
                                Additional Check Needed
                              </span>
                            </div>
                            <span className="text-[10px] text-base-content/65 font-normal leading-tight">
                              Schedule another examination
                            </span>
                          </button>
                        </>
                      )}

                      {isContinuationFlow && (
                        <button
                          type="button"
                          aria-pressed={result === "follow_up_required"}
                          onClick={() => {
                            setResult("follow_up_required");
                            setFieldErrors((current) => ({
                              ...current,
                              result: null,
                            }));
                          }}
                          className={`col-span-1 sm:col-span-2 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                            result === "follow_up_required"
                              ? "border-warning bg-warning/15 text-warning-content font-bold shadow-sm"
                              : "border-base-300 bg-base-100 hover:border-warning/50 hover:bg-warning/5 font-semibold text-base-content"
                          }`}
                        >
                          Additional follow-up required
                        </button>
                      )}
                    </div>
                    {fieldErrors.result && (
                      <p
                        role="alert"
                        className="text-xs text-error font-medium mt-1"
                      >
                        {fieldErrors.result}
                      </p>
                    )}
                  </div>

                  {/* Examination Method */}
                  {isInitialDiagnosis && (
                    <div className="border border-base-300 rounded-2xl p-4 space-y-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                        Examination Method
                      </span>
                      <p className="text-xs text-base-content/70 -mt-1.5">
                        Choose the diagnostic technique used during the
                        examination.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {diagnosticMethods.map((method) => (
                          <button
                            key={method.methodCode}
                            type="button"
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              diagnosticMethod === method.methodCode
                                ? "bg-primary text-primary-content border-primary shadow-sm"
                                : "bg-base-100 text-base-content/80 border-base-300 hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                            } ${!method.enabled || !method.isEligible ? "opacity-50 cursor-not-allowed" : ""}`}
                            disabled={!method.enabled || !method.isEligible}
                            aria-pressed={
                              diagnosticMethod === method.methodCode
                            }
                            onClick={() => {
                              setDiagnosticMethod(method.methodCode);
                              setFieldErrors((current) => ({
                                ...current,
                                diagnosticMethod: null,
                              }));
                            }}
                            title={method.reason || `Select ${method.label}`}
                          >
                            {method.label}
                          </button>
                        ))}
                      </div>
                      {fieldErrors.diagnosticMethod && (
                        <p
                          role="alert"
                          className="text-xs text-error font-medium mt-1"
                        >
                          {fieldErrors.diagnosticMethod}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Clinical Record & Notes */}
                  <div className="border border-base-300 rounded-2xl p-4 space-y-4">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                      Clinical Record & Notes
                    </span>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="pregnancy-diagnosis-date"
                          className="label-text text-xs font-semibold text-base-content/80 block mb-1"
                        >
                          Examination Date
                        </label>
                        <input
                          id="pregnancy-diagnosis-date"
                          type="date"
                          value={diagnosisDate}
                          max={getManilaDateKey()}
                          onChange={(event) => {
                            setDiagnosisDate(event.target.value);
                            setFieldErrors((current) => ({
                              ...current,
                              diagnosisDate: null,
                            }));
                          }}
                          className="input input-bordered w-full text-xs font-semibold rounded-xl"
                        />
                        {fieldErrors.diagnosisDate && (
                          <p
                            role="alert"
                            className="text-xs text-error font-medium mt-1"
                          >
                            {fieldErrors.diagnosisDate}
                          </p>
                        )}
                      </div>

                      {((isContinuationFlow &&
                        result === "follow_up_required") ||
                        (isVerificationTask &&
                          result === "needs_recheck")) && (
                        <div>
                          <label
                            className="label-text text-xs font-semibold text-base-content/80 block mb-1"
                            htmlFor="pregnancy-follow-up-date"
                          >
                            {isVerificationTask
                              ? "Next Check Date"
                              : "Recommended Follow-up"}
                          </label>
                          <input
                            id="pregnancy-follow-up-date"
                            type="date"
                            min={minimumFollowUpDate}
                            value={followUpDate}
                            onChange={(event) => {
                              setFollowUpDate(event.target.value);
                              setFieldErrors((current) => ({
                                ...current,
                                followUpDate: null,
                              }));
                            }}
                            className="input input-bordered w-full text-xs font-semibold rounded-xl"
                            required
                          />
                          {fieldErrors.followUpDate && (
                            <p
                              role="alert"
                              className="text-xs text-error font-medium mt-1"
                            >
                              {fieldErrors.followUpDate}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label
                        className="label-text text-xs font-semibold text-base-content/80 block mb-1"
                        htmlFor="pregnancy-findings"
                      >
                        Clinical Notes
                      </label>
                      <textarea
                        id="pregnancy-findings"
                        rows={3}
                        placeholder="Record your observations, findings, and recommendations..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="textarea textarea-bordered w-full text-xs font-medium placeholder:text-base-content/40 focus:outline-primary rounded-xl resize-none"
                      />
                    </div>

                    {(result === "Pregnant" || result === "pregnant") && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="alert alert-info/15 border-info/30 text-xs text-base-content/80 flex items-center justify-between rounded-2xl py-3 px-4"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-info shrink-0" />
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-info block">
                              Projected Calving
                            </span>
                            <span className="text-xs font-bold text-base-content">
                              {estCalvingDate}
                            </span>
                          </div>
                        </div>
                        <CheckCircle className="h-4 w-4 text-info shrink-0" />
                      </motion.div>
                    )}
                  </div>
                </div>
              )}
          </div>

          {/* Actions */}
          {!isFinalizedVerification &&
            !isTaskDetailsError &&
            (!isVerificationTask || !isLoadingTaskDetails) && (
              <div className="border-t border-base-300 px-5 py-4 md:px-6 bg-base-100 flex justify-end gap-2.5 sticky bottom-0">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm font-bold rounded-xl text-base-content/70"
                  onClick={() => !isSubmitting && onClose()}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    isSubmitting ||
                    (isInitialDiagnosis &&
                      [
                        "pregnant",
                        "not_pregnant",
                        "Pregnant",
                        "Empty",
                      ].includes(result) &&
                      readiness &&
                      !readiness.isEligible)
                  }
                  className="btn btn-primary btn-sm font-bold gap-1.5 rounded-xl min-w-32"
                >
                  {isSubmitting ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : isContinuationFlow ? (
                    "Save Follow-up"
                  ) : (
                    "Submit Diagnosis"
                  )}
                </button>
              </div>
            )}
        </motion.div>
        <button
          type="button"
          className="modal-backdrop"
          onClick={() => !isSubmitting && onClose()}
          aria-label="Close diagnosis form"
        />
      </div>

      {previewImage && (
        <ImagePreviewModal
          images={
            Array.isArray(selectedInsemination?.farmerPregnancyPhotos)
              ? selectedInsemination.farmerPregnancyPhotos
              : []
          }
          selectedImage={previewImage}
          onSelectImage={setPreviewImage}
          onClose={() => setPreviewImage(null)}
          title="Farmer pregnancy report photos"
        />
      )}
    </AnimatePresence>
  );
};

export default PregnancyDiagnosisModal;
