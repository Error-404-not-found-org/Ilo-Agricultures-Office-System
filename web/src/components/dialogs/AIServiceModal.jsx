import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  ClipboardList,
  History,
  Plus,
  Search,
  Syringe,
  User,
  UserPlus,
  X,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import { getAIRequestErrorMessage } from "../../utils/aiRequestErrors";
import RegisterFarmerModal from "./RegisterFarmerModal";
import RegisterLivestockModal from "./RegisterLivestockModal";

const pad = (value) => String(value).padStart(2, "0");

const localDate = (value = new Date()) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

const localTime = (value = new Date()) =>
  `${pad(value.getHours())}:${pad(value.getMinutes())}`;

const initialProcedure = () => {
  const now = new Date();
  return {
    inseminationDate: localDate(now),
    time: localTime(now),
    sireBreed: "",
    sireCode: "",
    semenDosesUsed: 1,
    estrus: "Natural",
    technicianNote: "",
  };
};

const idOf = (value) => value?._id || value?.id || null;

const isMongoId = (value) => /^[a-f\d]{24}$/i.test(String(value || ""));

const validatePerformedAt = (procedure) => {
  const performedAt = new Date(
    `${procedure.inseminationDate}T${procedure.time}:00+08:00`,
  );
  const now = Date.now();
  if (Number.isNaN(performedAt.getTime())) {
    return { error: "Enter a valid AI service date and time." };
  }
  if (performedAt.getTime() > now + 5 * 60 * 1000) {
    return { error: "The AI service time cannot be in the future." };
  }
  if (performedAt.getTime() < now - 24 * 60 * 60 * 1000) {
    return {
      error:
        "Use the authorized historical-record workflow for an older AI service.",
    };
  }
  return { performedAt, error: null };
};

const formatCanonicalSchedule = (schedule = {}) => {
  if (!schedule.date) return "Not scheduled";
  const date = new Date(schedule.date);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  const dateLabel = date.toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const periodLabel = schedule.visitPeriod
    ? `${schedule.visitPeriod.charAt(0).toUpperCase()}${schedule.visitPeriod.slice(1)}`
    : null;
  return [dateLabel, periodLabel].filter(Boolean).join(" · ");
};

const requestStatusLabel = (status) =>
  ({
    pending: "Awaiting technician",
    approved: "Claimed",
    scheduled: "Scheduled",
    "in-progress": "In progress",
    in_progress: "In progress",
  })[String(status || "").toLowerCase()] || "Active request";

const formatVisit = (value) => {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const farmerAddress = (farmer) =>
  typeof farmer?.address === "string"
    ? farmer.address
    : [farmer?.address?.barangay, farmer?.address?.city]
        .filter(Boolean)
        .join(" ");

const normalizedRequestStatus = (status) =>
  String(status || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");

const isWorkQueueStatus = (status) =>
  ["scheduled", "in-progress"].includes(normalizedRequestStatus(status));

const AIServiceModal = ({
  isOpen,
  onClose,
  onSuccess,
  existingOnly = false,
  preSelectedFarmer,
  preSelectedAnimal,
  context = "walk-in", // "walk-in" | "task" | "admin"
  taskData,
  workflowId,
  taskId,
  requestContext,
}) => {
  // ==========================================
  // CONFIGURATION & CAPABILITIES
  // ==========================================
  const capabilities = {
    showFarmerSearch: context === "walk-in",
    showAnimalSelector: context === "walk-in",
    showRegistration: context === "walk-in" && !existingOnly,
    showServiceContext: context === "walk-in" || context === "admin",
    fetchContext: context === "walk-in" || context === "admin",
  };

  // ==========================================
  // HOOKS & STATE
  // ==========================================
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const submittingRef = useRef(false);
  const [selectedFarmerId, setSelectedFarmerId] = useState("");
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [searchFarmer, setSearchFarmer] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRegisterFarmerOpen, setIsRegisterFarmerOpen] = useState(false);
  const [isRegisterAnimalOpen, setIsRegisterAnimalOpen] = useState(false);
  const [createdFarmer, setCreatedFarmer] = useState(null);
  const [createdAnimal, setCreatedAnimal] = useState(null);
  const [procedure, setProcedure] = useState(initialProcedure);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submissionError, setSubmissionError] = useState("");

  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: async () => (await axiosInstance.get("/config")).data,
    enabled: isOpen && context !== "task",
  });

  const {
    data: farmers = [],
    error: farmersError,
    isError: isFarmersError,
    isLoading: isLoadingFarmers,
    refetch: refetchFarmers,
  } = useQuery({
    queryKey: ["farmers", "list"],
    queryFn: async () => {
      const response = await axiosInstance.get("/user?role=farmer");
      return Array.isArray(response.data)
        ? response.data
        : response.data.data || [];
    },
    enabled: isOpen && capabilities.showFarmerSearch,
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
      const response = await axiosInstance.get(
        `/animals/farmer/${selectedFarmerId}`,
      );
      return Array.isArray(response.data)
        ? response.data
        : response.data.data || [];
    },
    enabled: Boolean(selectedFarmerId && capabilities.showAnimalSelector),
  });

  const matchingFarmers = useMemo(() => {
    const query = searchFarmer.trim().toLowerCase();
    return farmers.filter((farmer) =>
      [farmer.name, farmer.phoneNumber, farmerAddress(farmer)].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [farmers, searchFarmer]);

  const selectedFarmer =
    farmers.find((farmer) => idOf(farmer) === selectedFarmerId) ||
    (idOf(createdFarmer) === selectedFarmerId ? createdFarmer : null) ||
    (idOf(preSelectedFarmer) === selectedFarmerId ? preSelectedFarmer : null);

  const availableAnimals = useMemo(
    () =>
      createdAnimal?._id &&
      !animals.some((animal) => animal._id === createdAnimal._id)
        ? [...animals, createdAnimal]
        : animals,
    [animals, createdAnimal],
  );

  const selectedAnimal =
    availableAnimals.find((animal) => idOf(animal) === selectedAnimalId) ||
    (idOf(preSelectedAnimal) === selectedAnimalId ? preSelectedAnimal : null);

  const {
    data: serviceContext,
    error: contextError,
    isError: isContextError,
    isLoading: isLoadingContext,
    refetch: refetchContext,
  } = useQuery({
    queryKey: [
      "technician",
      "ai-service-context",
      selectedFarmerId,
      selectedAnimalId,
    ],
    queryFn: async () =>
      (
        await axiosInstance.get("/technician/ai-service-context", {
          params: {
            farmerId: selectedFarmerId,
            animalId: selectedAnimalId,
          },
        })
      ).data,
    enabled: Boolean(
      isOpen &&
      capabilities.fetchContext &&
      selectedFarmerId &&
      selectedAnimalId,
    ),
    retry: false,
  });

  // ==========================================
  // MUTATIONS
  // ==========================================
  const recordMutation = useMutation({
    mutationFn: async (payload) =>
      (await axiosInstance.post("/technician/walk-in-insemination", payload))
        .data,
    onSuccess: async (_result, variables) => {
      submittingRef.current = false;
      toast.success("AI service recorded successfully.");
      const completedFarmerId = variables?.farmerId || selectedFarmerId;
      const completedAnimalId = variables?.animalId || selectedAnimalId;
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: ["technician", "work-queue", "mine"],
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: ["technician", "requests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["technician", "inseminations-list"],
        }),
      ];
      if (completedFarmerId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: ["farmer-animals", completedFarmerId],
            exact: true,
          }),
        );
      }
      if (completedAnimalId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: ["animal", completedAnimalId],
            exact: true,
          }),
          queryClient.invalidateQueries({
            queryKey: ["animal-history", completedAnimalId],
            exact: true,
          }),
        );
      }
      await Promise.allSettled(invalidations);
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      submittingRef.current = false;
      const code = error?.response?.data?.code;
      if (["SIRE_BREED_REQUIRED", "SIRE_BREED_TOO_LONG"].includes(code)) {
        setFieldErrors({ sireBreed: error.response.data.message });
        return;
      }
      if (["SIRE_CODE_REQUIRED", "SIRE_CODE_TOO_LONG"].includes(code)) {
        setFieldErrors({ sireCode: error.response.data.message });
        return;
      }
      if (code === "INVALID_SEMEN_DOSES_USED") {
        setFieldErrors({ semenDosesUsed: error.response.data.message });
        return;
      }
      if ([401, 403].includes(error?.response?.status)) {
        setSubmissionError(
          "You are not authorized to record this AI workflow.",
        );
        return;
      }
      if (
        [
          "CONCURRENCY_CONFLICT",
          "TASK_ALREADY_LINKED",
          "AI_REQUEST_NOT_FOUND",
          "REQUEST_ALREADY_COMPLETED",
        ].includes(code)
      ) {
        setSubmissionError(
          error?.response?.data?.message ||
            "This workflow changed while you were recording it. Refresh My Work and try again.",
        );
        return;
      }
      setSubmissionError(
        getAIRequestErrorMessage(
          error,
          "The AI service could not be recorded.",
        ),
      );
      if (capabilities.fetchContext) refetchContext();
    },
  });

  const claimMutation = useMutation({
    mutationFn: async (requestId) =>
      (await axiosInstance.patch(`/technician/requests/ai/${requestId}/claim`))
        .data,
    onSuccess: (_result, requestId) => {
      toast.success("Request claimed. Choose the visit date and time.");
      queryClient.invalidateQueries({ queryKey: ["technician"] });
      onClose();
      navigate(
        `/technician/requests?requestId=${encodeURIComponent(requestId)}&status=approved`,
      );
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "The request could not be claimed.",
      );
      refetchContext();
    },
  });

  useEffect(() => {
    if (!isOpen) {
      Promise.resolve().then(() => {
        setSelectedFarmerId("");
        setSelectedAnimalId("");
        setSearchFarmer("");
        setIsDropdownOpen(false);
        setIsRegisterFarmerOpen(false);
        setIsRegisterAnimalOpen(false);
        setCreatedFarmer(null);
        setCreatedAnimal(null);
        setProcedure(initialProcedure());
        setFieldErrors({});
        setSubmissionError("");
        submittingRef.current = false;
      });
      return;
    }

    Promise.resolve().then(() => {
      if (preSelectedFarmer) {
        setSelectedFarmerId(idOf(preSelectedFarmer));
        setSearchFarmer(preSelectedFarmer.name || "");
      }
      if (preSelectedAnimal) setSelectedAnimalId(idOf(preSelectedAnimal));
    });
  }, [isOpen, preSelectedAnimal, preSelectedFarmer]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.key === "Escape" &&
        !isRegisterFarmerOpen &&
        !isRegisterAnimalOpen
      ) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRegisterAnimalOpen, isRegisterFarmerOpen, onClose]);

  if (!isOpen) return null;

  const selectFarmer = (farmer) => {
    setSelectedFarmerId(farmer._id);
    setSelectedAnimalId("");
    setCreatedAnimal(null);
    setSearchFarmer(farmer.name || "");
    setIsDropdownOpen(false);
    setProcedure(initialProcedure());
  };

  const openRequest = (request) => {
    onClose();
    if (isWorkQueueStatus(request.status) && request.taskId) {
      navigate(
        `/technician/work-queue?scope=mine&statusFilter=all&taskId=${encodeURIComponent(request.taskId)}`,
      );
      return;
    }

    const status = isWorkQueueStatus(request.status) ? "scheduled" : "approved";
    navigate(
      `/technician/requests?requestId=${encodeURIComponent(request.requestId)}&status=${status}`,
    );
  };

  const saveService = () => {
    if (submittingRef.current) return;
    setFieldErrors({});
    setSubmissionError("");

    if (context !== "task" && serviceContext?.mode !== "walk_in") {
      toast.error("Resolve the active request or eligibility notice first.");
      return;
    }

    if (context === "task" && !isMongoId(workflowId)) {
      setSubmissionError("This AI work item has an invalid workflow identifier.");
      return;
    }
    if (taskId && !isMongoId(taskId)) {
      setSubmissionError("The linked execution task identifier is invalid.");
      return;
    }

    const resolvedFarmerId =
      selectedFarmerId || idOf(preSelectedFarmer) || requestContext?.farmer?.id;
    const resolvedAnimalId =
      selectedAnimalId || idOf(preSelectedAnimal) || requestContext?.animal?.id;
    if (!resolvedFarmerId || !resolvedAnimalId) {
      setSubmissionError(
        "This AI work item is missing its farmer or animal identifier.",
      );
      return;
    }

    const sireBreed = procedure.sireBreed.trim();
    const sireCode = procedure.sireCode.trim();
    const semenDosesUsed = Number(procedure.semenDosesUsed);
    const nextErrors = {};
    if (!sireBreed) nextErrors.sireBreed = "Enter the sire breed.";
    if (!sireCode) nextErrors.sireCode = "Enter the sire code.";
    if (!Number.isSafeInteger(semenDosesUsed) || semenDosesUsed < 1) {
      nextErrors.semenDosesUsed =
        "Number of semen doses must be a whole number of at least 1.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    const performed = validatePerformedAt(procedure);
    if (performed.error) {
      setFieldErrors({ inseminationDate: performed.error });
      return;
    }

    const inseminationDetails = {
      inseminationDate: procedure.inseminationDate,
      time: procedure.time,
      estrus: procedure.estrus,
      sireBreed,
      sireCode,
      semenDosesUsed,
      technicianNote: procedure.technicianNote.trim(),
    };

    submittingRef.current = true;
    recordMutation.mutate({
      farmerId: resolvedFarmerId,
      animalId: resolvedAnimalId,
      animalDetails: null,
      inseminationDetails,
      ...(context === "task" ? { requestId: workflowId } : {}),
      ...(taskId ? { taskId } : {}),
    });
  };

  const activeRequest = serviceContext?.activeRequest;
  const isWalkIn = serviceContext?.mode === "walk_in";
  const showProcedureForm = context === "walk-in" || context === "task";
  const hasDirectSelection = Boolean(selectedFarmerId && selectedAnimalId);
  const procedureDisabled =
    context !== "task" &&
    (!hasDirectSelection ||
      isLoadingContext ||
      isContextError ||
      serviceContext?.mode !== "walk_in");
  const taskFarmer = requestContext?.farmer || preSelectedFarmer || {};
  const taskAnimal = requestContext?.animal || preSelectedAnimal || {};
  const taskHeatSigns = Array.isArray(taskData?.heatSigns)
    ? taskData.heatSigns
    : [];
  const taskAttachments = [
    taskData?.imageUrl,
    ...(Array.isArray(taskData?.evidencePhotos)
      ? taskData.evidencePhotos
      : []),
  ].filter(Boolean);
  const opensInWorkQueue = Boolean(
    activeRequest &&
    isWorkQueueStatus(activeRequest.status) &&
    activeRequest.taskId,
  );

  return (
    <>
      <div
        className="modal modal-open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-ai-title"
      >
        <div className="modal-box flex h-[88vh] w-11/12 max-w-3xl flex-col overflow-hidden p-0">
          <header className="flex items-center justify-between border-b border-base-300 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-box bg-primary/10 text-primary">
                <Syringe size={20} />
              </div>
              <div className="min-w-0">
                <h2
                  id="record-ai-title"
                  className="truncate text-lg font-bold text-base-content"
                >
                  Record AI Service
                </h2>
                <p className="truncate text-sm text-base-content/55">
                  {selectedAnimalId
                    ? "Confirm the service path before entering procedure details."
                    : selectedFarmerId
                      ? "Select the animal receiving the service."
                      : "Find the farmer to begin."}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Close Record AI"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto bg-base-100 px-5 py-5">
            {config?.isHoliday && (
              <div role="alert" className="alert alert-warning alert-soft">
                <AlertCircle size={18} />
                <div>
                  <div className="font-bold">Office schedule notice</div>
                  <div className="text-sm">
                    Office operations are closed, but a technician may still
                    record a verified field service.
                  </div>
                </div>
              </div>
            )}

            {/* ========================================== */}
            {/* FARMER SELECTION */}
            {/* ========================================== */}
            {capabilities.showFarmerSearch && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <User size={16} className="text-primary" />
                  <h3 className="font-bold text-base-content">
                    Farmer and animal
                  </h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">Farmer</legend>
                    {preSelectedFarmer ? (
                      <div className="flex h-12 items-center gap-3 rounded-field border border-base-300 bg-base-200 px-4">
                        <User size={16} className="text-primary" />
                        <span className="truncate font-semibold">
                          {preSelectedFarmer.name}
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <label className="input w-full">
                          <Search size={16} className="text-base-content/40" />
                          <input
                            value={searchFarmer}
                            onChange={(event) => {
                              setSearchFarmer(event.target.value);
                              setSelectedFarmerId("");
                              setSelectedAnimalId("");
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
                                  className="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left hover:bg-base-200"
                                  onMouseDown={(event) =>
                                    event.preventDefault()
                                  }
                                  onClick={() => selectFarmer(farmer)}
                                >
                                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                    {(farmer.name || "F")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
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
                                    {capabilities.showRegistration
                                      ? "Register the farmer before adding an animal."
                                      : "No matching registered farmer is available for this service."}
                                  </div>
                                </div>
                                {capabilities.showRegistration && (
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    onMouseDown={(event) =>
                                      event.preventDefault()
                                    }
                                    onClick={() =>
                                      setIsRegisterFarmerOpen(true)
                                    }
                                  >
                                    <UserPlus size={15} /> Register farmer
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </fieldset>

                  {/* ========================================== */}
                  {/* ANIMAL SELECTION */}
                  {/* ========================================== */}
                  {capabilities.showAnimalSelector && (
                    <fieldset className="fieldset">
                      <legend className="fieldset-legend">Animal</legend>
                      {preSelectedAnimal ? (
                        <div className="flex h-12 items-center gap-3 rounded-field border border-base-300 bg-base-200 px-4">
                          <Activity size={16} className="text-primary" />
                          <span className="truncate font-semibold">
                            Tag #{preSelectedAnimal.earTag} ·{" "}
                            {preSelectedAnimal.breed || "Breed not recorded"}
                          </span>
                        </div>
                      ) : selectedFarmerId &&
                        !isLoadingAnimals &&
                        !isAnimalsError &&
                        availableAnimals.length === 0 ? (
                        <div className="space-y-3 rounded-field border border-base-300 bg-base-200 p-4 text-center">
                          <div>
                            <div className="font-semibold">
                              No animals found
                            </div>
                            <div className="text-sm text-base-content/55">
                              This farmer has no registered animals.
                            </div>
                          </div>
                          {capabilities.showRegistration && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setIsRegisterAnimalOpen(true)}
                            >
                              <Plus size={15} /> Register animal
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          <select
                            className="select w-full"
                            disabled={!selectedFarmerId || isLoadingAnimals || isAnimalsError}
                            value={selectedAnimalId}
                            onChange={(event) => {
                              setSelectedAnimalId(event.target.value);
                              setProcedure(initialProcedure());
                            }}
                          >
                            <option value="">
                              {isLoadingAnimals
                                ? "Loading registered animals…"
                                : selectedFarmerId
                                  ? "Select animal"
                                  : "Select a farmer first"}
                            </option>
                            {availableAnimals.map((animal) => (
                              <option
                                key={animal._id}
                                value={animal._id}
                                disabled={
                                  String(animal.gender || "").toLowerCase() ===
                                  "male"
                                }
                              >
                                Tag #{animal.earTag} ·{" "}
                                {animal.breed || animal.species}
                                {String(animal.gender || "").toLowerCase() ===
                                "male"
                                  ? " · Male"
                                  : ""}
                              </option>
                            ))}
                          </select>
                          {isAnimalsError && (
                            <div className="alert alert-error mt-2 text-sm" role="alert">
                              <AlertCircle size={16} />
                              <span>{animalsError?.response?.data?.message || "Registered animals could not be loaded."}</span>
                              <button type="button" className="btn btn-ghost btn-xs" onClick={() => refetchAnimals()}>Try again</button>
                            </div>
                          )}
                        </>
                      )}
                    </fieldset>
                  )}
                </div>
              </section>
            )}

            {/* ========================================== */}
            {/* TASK SUMMARY (Read-Only) */}
            {/* ========================================== */}
            {context === "task" && preSelectedFarmer && preSelectedAnimal && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-base-300 pb-3">
                  <ClipboardList size={16} className="text-primary" />
                  <h3 className="font-bold text-base-content">Task Summary</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-base-content/70">
                      Farmer
                    </div>
                    <div className="font-medium text-base-content">
                      {taskFarmer.name || "Unknown farmer"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-base-content/70">
                      Animal
                    </div>
                    <div className="font-medium text-base-content">
                      {taskAnimal.name || "Animal"}
                      {taskAnimal.earTag ? ` · Tag ${taskAnimal.earTag}` : ""}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-base-content/70">
                      Phone
                    </div>
                    <div className="font-medium text-base-content">
                      {taskFarmer.phone ||
                        taskFarmer.phoneNumber ||
                        "Not provided"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-base-content/70">
                      Location
                    </div>
                    <div className="font-medium text-base-content">
                      {requestContext?.location ||
                        taskFarmer.location ||
                        "Not recorded"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-base-content/70">
                      Request submitted
                    </div>
                    <div className="font-medium text-base-content">
                      {requestContext?.requestedAt
                        ? new Date(requestContext.requestedAt).toLocaleDateString(
                            "en-US",
                            {
                              timeZone: "Asia/Manila",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )
                        : "Not recorded"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-base-content/70">
                      Scheduled visit
                    </div>
                    <div className="font-medium text-base-content">
                      {formatCanonicalSchedule(requestContext?.schedule)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-base-content/70">
                      Submitted heat signs
                    </div>
                    <div className="font-medium text-base-content">
                      {taskHeatSigns.length
                        ? taskHeatSigns.join(", ")
                        : "None submitted"}
                    </div>
                  </div>
                </div>
                {taskAttachments.length > 0 && (
                  <p className="text-sm font-medium text-base-content/70">
                    {taskAttachments.length} attachment
                    {taskAttachments.length === 1 ? "" : "s"} submitted
                  </p>
                )}
              </section>
            )}

            {/* ========================================== */}
            {/* SERVICE CONTEXT */}
            {/* ========================================== */}
            {capabilities.showServiceContext &&
              selectedFarmerId &&
              selectedAnimalId && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-primary" />
                    <h3 className="font-bold text-base-content">
                      Service context
                    </h3>
                  </div>

                  {isLoadingContext && (
                    <div role="status" className="alert">
                      <span className="loading loading-spinner loading-sm" />
                      <span>Checking requests and AI eligibility…</span>
                    </div>
                  )}

                  {isContextError && (
                    <div role="alert" className="alert alert-error alert-soft">
                      <AlertCircle size={18} />
                      <div className="flex-1">
                        <div className="font-bold">
                          Context could not be loaded
                        </div>
                        <div className="text-sm">
                          {contextError?.response?.data?.message ||
                            "Check the connection and try again."}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => refetchContext()}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {serviceContext?.mode === "walk_in" && (
                    <div role="alert" className="alert alert-info alert-soft">
                      <BadgeCheck size={19} />
                      <div>
                        <div className="font-bold">
                          Walk-in service available
                        </div>
                        <div className="text-sm">
                          No active AI request was found. Record this as a
                          service performed during today&apos;s field visit.
                        </div>
                      </div>
                    </div>
                  )}

                  {activeRequest && (
                    <div
                      role="alert"
                      className={`alert alert-vertical sm:alert-horizontal ${
                        serviceContext.mode === "blocked"
                          ? "alert-error alert-soft"
                          : "alert-info alert-soft"
                      }`}
                    >
                      <CalendarClock size={20} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">
                            Active AI request found
                          </span>
                          <span className="badge badge-sm badge-info badge-soft">
                            {requestStatusLabel(activeRequest.status)}
                          </span>
                          {serviceContext.timing?.isEarly && (
                            <span className="badge badge-sm badge-warning badge-soft">
                              Scheduled later
                            </span>
                          )}
                          {serviceContext.timing?.isOverdue && (
                            <span className="badge badge-sm badge-warning badge-soft">
                              Overdue
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm">
                          Visit: {formatVisit(activeRequest.scheduledDate)}
                          {activeRequest.assignedTechnician?.name
                            ? ` · ${activeRequest.assignedTechnician.name}`
                            : " · Not yet claimed"}
                        </div>
                        {activeRequest.assignment === "unclaimed" ? (
                          <div className="mt-1 text-sm">
                            Claim this request, then choose its visit schedule.
                          </div>
                        ) : opensInWorkQueue ? (
                          <div className="mt-1 text-sm">
                            This visit is already scheduled and is managed in My
                            Work.
                          </div>
                        ) : (
                          <div className="mt-1 text-sm">
                            Continue to the request details to choose a visit
                            date and time.
                          </div>
                        )}
                        {serviceContext.blockedReason && (
                          <div className="mt-1 text-sm font-medium">
                            {serviceContext.blockedReason}
                          </div>
                        )}
                      </div>
                      {activeRequest.assignment === "unclaimed" &&
                      serviceContext.allowedActions?.includes(
                        "claim_request",
                      ) ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={claimMutation.isPending}
                          onClick={() =>
                            claimMutation.mutate(activeRequest.requestId)
                          }
                        >
                          {claimMutation.isPending && (
                            <span className="loading loading-spinner loading-xs" />
                          )}
                          Claim and schedule
                        </button>
                      ) : serviceContext.allowedActions?.includes(
                          "open_request",
                        ) ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => openRequest(activeRequest)}
                        >
                          {opensInWorkQueue
                            ? "Open in My Work"
                            : "Schedule request"}
                        </button>
                      ) : null}
                    </div>
                  )}

                  {serviceContext?.mode === "blocked" && !activeRequest && (
                    <div
                      role="alert"
                      className="alert alert-warning alert-soft"
                    >
                      <AlertCircle size={19} />
                      <div>
                        <div className="font-bold">
                          AI service cannot continue
                        </div>
                        <div className="text-sm">
                          {serviceContext.blockedReason}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )}

            {/* ========================================== */}
            {/* PROCEDURE FORM */}
            {/* ========================================== */}
            {showProcedureForm && (
              <fieldset disabled={procedureDisabled} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-base-300 pb-3">
                  <History size={16} className="text-primary" />
                  <h3 className="font-bold text-base-content">
                    AI procedure details
                  </h3>
                </div>

                {context === "walk-in" && !hasDirectSelection && (
                  <div role="status" className="alert alert-info alert-soft">
                    <Activity size={18} />
                    <span>
                      Select a registered farmer and animal to enable the AI
                      service fields.
                    </span>
                  </div>
                )}

                {submissionError && (
                  <div role="alert" className="alert alert-error alert-soft">
                    <AlertCircle size={18} />
                    <span>{submissionError}</span>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">Sire breed</legend>
                    <input
                      type="text"
                      aria-label="Sire breed"
                      className={`input w-full ${fieldErrors.sireBreed ? "input-error" : ""}`}
                      value={procedure.sireBreed}
                      placeholder="Enter the recorded sire breed"
                      maxLength={100}
                      onChange={(event) => {
                        setProcedure((current) => ({
                          ...current,
                          sireBreed: event.target.value,
                        }));
                        setFieldErrors((current) => ({
                          ...current,
                          sireBreed: null,
                        }));
                      }}
                    />
                    {fieldErrors.sireBreed && (
                      <p role="alert" className="label text-error">
                        {fieldErrors.sireBreed}
                      </p>
                    )}
                  </fieldset>

                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">Sire code</legend>
                    <label
                      className={`input w-full ${fieldErrors.sireCode ? "input-error" : ""}`}
                    >
                      <BadgeCheck size={16} className="text-base-content/40" />
                      <input
                        aria-label="Sire code"
                        value={procedure.sireCode}
                        placeholder="Enter the sire or semen code"
                        maxLength={64}
                        onChange={(event) => {
                          setProcedure((current) => ({
                            ...current,
                            sireCode: event.target.value,
                          }));
                          setFieldErrors((current) => ({
                            ...current,
                            sireCode: null,
                          }));
                        }}
                      />
                    </label>
                    {fieldErrors.sireCode && (
                      <p role="alert" className="label text-error">
                        {fieldErrors.sireCode}
                      </p>
                    )}
                  </fieldset>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">Service date</legend>
                    <input
                      type="date"
                      aria-label="Actual insemination date"
                      className={`input w-full ${fieldErrors.inseminationDate ? "input-error" : ""}`}
                      max={localDate()}
                      value={procedure.inseminationDate}
                      onChange={(event) => {
                        setProcedure((current) => ({
                          ...current,
                          inseminationDate: event.target.value,
                        }));
                        setFieldErrors((current) => ({
                          ...current,
                          inseminationDate: null,
                        }));
                      }}
                    />
                    {fieldErrors.inseminationDate && (
                      <p role="alert" className="label text-error">
                        {fieldErrors.inseminationDate}
                      </p>
                    )}
                  </fieldset>
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">Service time</legend>
                    <input
                      type="time"
                      aria-label="Actual insemination time"
                      className="input w-full"
                      value={procedure.time}
                      onChange={(event) =>
                        setProcedure((current) => ({
                          ...current,
                          time: event.target.value,
                        }))
                      }
                    />
                  </fieldset>
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">Estrus type</legend>
                    <select
                      className="select w-full"
                      aria-label="Estrus observations"
                      value={procedure.estrus}
                      onChange={(event) =>
                        setProcedure((current) => ({
                          ...current,
                          estrus: event.target.value,
                        }))
                      }
                    >
                      <option value="Natural">Natural</option>
                      <option value="Synchronized">Synchronized</option>
                      <option value="Induced">Induced</option>
                    </select>
                  </fieldset>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <fieldset className="fieldset">
                      <legend className="fieldset-legend">
                        Number of semen doses used
                      </legend>
                      <input
                        type="number"
                        aria-label="Number of semen doses used"
                        min="1"
                        step="1"
                        className={`input w-full ${fieldErrors.semenDosesUsed ? "input-error" : ""}`}
                        value={procedure.semenDosesUsed}
                        onChange={(event) => {
                          setProcedure((current) => ({
                            ...current,
                            semenDosesUsed: event.target.value,
                          }));
                          setFieldErrors((current) => ({
                            ...current,
                            semenDosesUsed: null,
                          }));
                        }}
                      />
                      {fieldErrors.semenDosesUsed && (
                        <p role="alert" className="label text-error">
                          {fieldErrors.semenDosesUsed}
                        </p>
                      )}
                    </fieldset>
                    <fieldset className="fieldset">
                      <legend className="fieldset-legend">
                        Technician notes (optional)
                      </legend>
                      <textarea
                        className="textarea w-full"
                        aria-label="Technician notes"
                        rows={3}
                        maxLength={2000}
                        value={procedure.technicianNote}
                        placeholder="Add service observations"
                        onChange={(event) =>
                          setProcedure((current) => ({
                            ...current,
                            technicianNote: event.target.value,
                          }))
                        }
                      />
                    </fieldset>
                  </div>
              </fieldset>
            )}
          </div>

          {/* ========================================== */}
          {/* FOOTER */}
          {/* ========================================== */}
          <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-base-300 bg-base-100 px-5 py-4">
            <button type="button" className="btn" onClick={onClose}>
              {context === "walk-in" ? "Cancel" : "Close"}
            </button>
            {showProcedureForm && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={recordMutation.isPending || procedureDisabled}
                onClick={saveService}
              >
                {recordMutation.isPending && (
                  <span className="loading loading-spinner loading-sm" />
                )}
                Save AI service
              </button>
            )}
          </footer>
        </div>
        <button
          type="button"
          className="modal-backdrop"
          aria-label="Close Record AI"
          onClick={onClose}
        />
      </div>

      <RegisterFarmerModal
        isOpen={isRegisterFarmerOpen}
        onClose={() => setIsRegisterFarmerOpen(false)}
        onSuccess={(farmer) => {
          if (farmer?._id) {
            setCreatedFarmer(farmer);
            selectFarmer(farmer);
          }
        }}
      />

      <RegisterLivestockModal
        isOpen={isRegisterAnimalOpen}
        onClose={() => setIsRegisterAnimalOpen(false)}
        preSelectedFarmer={selectedFarmer}
        onSuccess={(animal) => {
          if (animal?._id) {
            setCreatedAnimal(animal);
            setSelectedAnimalId(animal._id);
            setProcedure(initialProcedure());
            refetchAnimals();
          }
        }}
      />
    </>
  );
};

export default AIServiceModal;
