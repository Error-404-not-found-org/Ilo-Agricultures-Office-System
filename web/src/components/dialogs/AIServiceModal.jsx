import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  BadgeCheck,
  Calendar,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  History,
  Info,
  Phone,
  Plus,
  Search,
  Syringe,
  UserPlus,
  X,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import { getAIRequestErrorMessage } from "../../utils/aiRequestErrors";
import { extractFarmerNote, formatHeatSignLabel } from "../../utils/aiRequestNote";
import Modal from "../ui/Modal";
import ImagePreviewModal from "../ui/ImagePreviewModal";
import { imagePreviewUrl } from "../ui/imagePreviewUrl";
import RegisterFarmerModal from "./RegisterFarmerModal";
import RegisterLivestockModal from "./RegisterLivestockModal";
import UserAvatar from "../ui/UserAvatar";
import { CATTLE_BREEDS, BREED_OPTIONS_BY_SPECIES } from "../../constants/breeds";

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

const validatePerformedAt = (
  procedure,
  { allowEarlierServiceDate = false } = {},
) => {
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
  if (
    !allowEarlierServiceDate &&
    performedAt.getTime() < now - 24 * 60 * 60 * 1000
  ) {
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
    "in-progress": "In Progress",
    in_progress: "In Progress",
  })[String(status || "").toLowerCase()] || "Active request";

const formatVisit = (value, visitPeriod) => {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  const normalizedPeriod = String(visitPeriod || "")
    .trim()
    .toLowerCase();
  const periodLabel = ["morning", "afternoon"].includes(normalizedPeriod)
    ? normalizedPeriod === "morning"
      ? "Morning"
      : "Afternoon"
    : parseInt(
          new Intl.DateTimeFormat("en-PH", {
            timeZone: "Asia/Manila",
            hour: "numeric",
            hour12: false,
          }).format(date),
          10,
        ) < 12
      ? "Morning"
      : "Afternoon";

  return [dateLabel, periodLabel].filter(Boolean).join(" · ");
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
  const workflowIdentity = [
    context,
    workflowId || "",
    taskId || "",
    idOf(preSelectedFarmer) || "",
    idOf(preSelectedAnimal) || "",
  ].join(":");
  const submittingRef = useRef(false);
  const activeWorkflowIdentityRef = useRef(isOpen ? workflowIdentity : null);
  const [selectedFarmerId, setSelectedFarmerId] = useState(
    () => idOf(preSelectedFarmer) || "",
  );
  const [selectedAnimalId, setSelectedAnimalId] = useState(
    () => idOf(preSelectedAnimal) || "",
  );
  const [isAnimalDropdownOpen, setIsAnimalDropdownOpen] = useState(false);
  const animalDropdownRef = useRef(null);
  const [searchFarmer, setSearchFarmer] = useState(
    () => preSelectedFarmer?.name || "",
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRegisterFarmerOpen, setIsRegisterFarmerOpen] = useState(false);
  const [isRegisterAnimalOpen, setIsRegisterAnimalOpen] = useState(false);
  const [createdFarmer, setCreatedFarmer] = useState(null);
  const [createdAnimal, setCreatedAnimal] = useState(null);
  const [procedure, setProcedure] = useState(initialProcedure);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submissionError, setSubmissionError] = useState("");
  const [recordMode, setRecordMode] = useState("now");
  const [previousEntryMode, setPreviousEntryMode] = useState("history_only");
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [isSireBreedDropdownOpen, setIsSireBreedDropdownOpen] = useState(false);
  const [showAllBreeds, setShowAllBreeds] = useState(false);
  const sireBreedDropdownRef = useRef(null);

  const isPastRecord = context === "walk-in" && recordMode === "past";

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
    (idOf(createdAnimal) === selectedAnimalId ? createdAnimal : null) ||
    (idOf(preSelectedAnimal) === selectedAnimalId ? preSelectedAnimal : null);

  const availableBreeds = useMemo(() => {
    const species =
      selectedAnimal?.species ||
      requestContext?.animal?.species ||
      preSelectedAnimal?.species ||
      "";
    if (BREED_OPTIONS_BY_SPECIES[species]) {
      return BREED_OPTIONS_BY_SPECIES[species];
    }
    return CATTLE_BREEDS;
  }, [
    selectedAnimal?.species,
    requestContext?.animal?.species,
    preSelectedAnimal?.species,
  ]);

  const matchingBreeds = useMemo(() => {
    const search = procedure.sireBreed.trim().toLowerCase();
    if (!search) return availableBreeds;
    return availableBreeds.filter((b) => b.toLowerCase().includes(search));
  }, [availableBreeds, procedure.sireBreed]);

  const displayBreeds = useMemo(() => {
    if (showAllBreeds) return availableBreeds;
    return matchingBreeds.length > 0 ? matchingBreeds : availableBreeds;
  }, [showAllBreeds, availableBreeds, matchingBreeds]);

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
      !isPastRecord &&
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
      (
        await axiosInstance.post(
          isPastRecord
            ? "/technician/previous-insemination"
            : "/technician/walk-in-insemination",
          payload,
        )
      ).data,
    onSuccess: async (_result, variables) => {
      submittingRef.current = false;
      const successMessage = isPastRecord
        ? previousEntryMode === "history_only"
          ? "Past AI record added to history."
          : "Past AI record added and tracking continued."
        : "AI service recorded successfully.";
      const completedFarmerId = variables?.farmerId || selectedFarmerId;
      const completedAnimalId = variables?.animalId || selectedAnimalId;
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: ["technician", "work-queue", "mine"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["technician", "requests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["technician", "inseminations-list"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["technician", "schedule"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["technician", "official-records"],
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
      toast.success(successMessage);
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
      queryClient.invalidateQueries({ queryKey: ["technician"] });
      onClose();
      toast.success("Request claimed. Choose the visit date and time.");
      navigate(
        `/technician/requests?section=myWork&requestId=${encodeURIComponent(requestId)}`,
      );
    },
    onError: (error) => {
      setSubmissionError(
        error.response?.data?.message || "The request could not be claimed.",
      );
      refetchContext();
    },
  });

  useEffect(() => {
    if (!isOpen) {
      activeWorkflowIdentityRef.current = null;
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
        setRecordMode("now");
        setPreviousEntryMode("history_only");
        submittingRef.current = false;
      });
      return;
    }

    if (activeWorkflowIdentityRef.current === workflowIdentity) return;
    activeWorkflowIdentityRef.current = workflowIdentity;
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
      setRecordMode("now");
      setPreviousEntryMode("history_only");
      submittingRef.current = false;
      if (preSelectedFarmer) {
        setSelectedFarmerId(idOf(preSelectedFarmer));
        setSearchFarmer(preSelectedFarmer.name || "");
      }
      if (preSelectedAnimal) setSelectedAnimalId(idOf(preSelectedAnimal));
    });
  }, [isOpen, workflowIdentity, preSelectedAnimal, preSelectedFarmer]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (
        event.key === "Escape" &&
        !submittingRef.current &&
        !recordMutation.isPending &&
        !isRegisterFarmerOpen &&
        !isRegisterAnimalOpen
      ) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    isRegisterAnimalOpen,
    isRegisterFarmerOpen,
    onClose,
    recordMutation.isPending,
  ]);

  useEffect(() => {
    if (!isAnimalDropdownOpen) return undefined;
    const handleClickOutside = (event) => {
      if (
        animalDropdownRef.current &&
        !animalDropdownRef.current.contains(event.target)
      ) {
        setIsAnimalDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAnimalDropdownOpen]);

  useEffect(() => {
    if (!isSireBreedDropdownOpen) return undefined;
    const handleClickOutside = (event) => {
      if (
        sireBreedDropdownRef.current &&
        !sireBreedDropdownRef.current.contains(event.target)
      ) {
        setIsSireBreedDropdownOpen(false);
        setShowAllBreeds(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSireBreedDropdownOpen]);

  if (!isOpen) return null;

  const selectFarmer = (farmer) => {
    setSelectedFarmerId(farmer._id);
    setSelectedAnimalId("");
    setIsAnimalDropdownOpen(false);
    setCreatedAnimal(null);
    setSearchFarmer(farmer.name || "");
    setIsDropdownOpen(false);
    setProcedure(initialProcedure());
  };

  const clearFarmer = () => {
    setSelectedFarmerId("");
    setSelectedAnimalId("");
    setIsAnimalDropdownOpen(false);
    setCreatedFarmer(null);
    setCreatedAnimal(null);
    setSearchFarmer("");
    setIsDropdownOpen(false);
    setProcedure(initialProcedure());
  };

  const openRequest = (request) => {
    onClose();
    if (isWorkQueueStatus(request.status) && request.taskId) {
      navigate(
        `/technician/requests?section=myWork&taskId=${encodeURIComponent(request.taskId)}`,
      );
      return;
    }

    navigate(
      `/technician/requests?section=myWork&requestId=${encodeURIComponent(request.requestId)}`,
    );
  };

  const saveService = () => {
    if (submittingRef.current) return;
    setFieldErrors({});
    setSubmissionError("");

    if (
      context !== "task" &&
      !isPastRecord &&
      serviceContext?.mode !== "walk_in"
    ) {
      setSubmissionError(
        "Resolve the active request or eligibility notice first.",
      );
      return;
    }

    if (context === "task" && !isMongoId(workflowId)) {
      setSubmissionError(
        "This AI work item has an invalid workflow identifier.",
      );
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

    const performed = validatePerformedAt(procedure, {
      // Earlier actual service dates are valid for an existing request-linked
      // workflow. They are historical entries only when no active workflow
      // exists, which remains the dedicated Previous AI path.
      allowEarlierServiceDate: isPastRecord || context === "task",
    });
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
      ...(isPastRecord ? { entryMode: previousEntryMode } : {}),
      ...(context === "task" ? { requestId: workflowId } : {}),
      ...(taskId ? { taskId } : {}),
    });
  };

  const activeRequest = serviceContext?.activeRequest;

  const showProcedureForm = context === "walk-in" || context === "task";
  const hasDirectSelection = Boolean(selectedFarmerId && selectedAnimalId);
  const procedureDisabled =
    context !== "task" &&
    (!hasDirectSelection ||
      (!isPastRecord &&
        (isLoadingContext ||
          isContextError ||
          serviceContext?.mode !== "walk_in")));
  const taskFarmer = requestContext?.farmer || preSelectedFarmer || {};
  const taskAnimal = requestContext?.animal || preSelectedAnimal || {};
  const taskHeatSigns = Array.isArray(taskData?.heatSigns)
    ? taskData.heatSigns
    : [];
  const rawAttachments = [
    taskData?.imageUrl,
    ...(Array.isArray(taskData?.evidencePhotos) ? taskData.evidencePhotos : []),
    ...(Array.isArray(taskData?.attachments) ? taskData.attachments : []),
    ...(Array.isArray(taskData?.photos) ? taskData.photos : []),
    requestContext?.imageUrl,
    ...(Array.isArray(requestContext?.evidencePhotos) ? requestContext.evidencePhotos : []),
    ...(Array.isArray(requestContext?.attachments) ? requestContext.attachments : []),
    ...(Array.isArray(requestContext?.photos) ? requestContext.photos : []),
  ];
  const seenAttachmentUrls = new Set();
  const taskAttachments = [];
  for (const item of rawAttachments) {
    const url = imagePreviewUrl(item);
    if (url && !seenAttachmentUrls.has(url)) {
      seenAttachmentUrls.add(url);
      taskAttachments.push(item);
    }
  }

  const rawNotesCandidates = [
    taskData?.farmerNotes,
    taskData?.comment,
    taskData?.farmerDescription,
    taskData?.notes,
    requestContext?.farmerNotes,
    requestContext?.comment,
    requestContext?.notes,
    requestContext?.taskNotes,
    requestContext?.taskDetails,
    requestContext?.raw?.farmerNotes,
    requestContext?.raw?.comment,
    requestContext?.raw?.farmerDescription,
    requestContext?.raw?.notes,
  ];
  const cleanedNotes = [];
  const seenNotes = new Set();
  for (const candidate of rawNotesCandidates) {
    if (!candidate) continue;
    const list = Array.isArray(candidate) ? candidate : [candidate];
    for (const item of list) {
      const extracted = extractFarmerNote(item);
      if (extracted && !seenNotes.has(extracted)) {
        seenNotes.add(extracted);
        cleanedNotes.push(extracted);
      }
    }
  }
  const taskFarmerNote = cleanedNotes.join("\n\n");

  const isScheduled = Boolean(
    activeRequest &&
    (Boolean(activeRequest.scheduledDate) ||
      isWorkQueueStatus(activeRequest.status)),
  );
  const isOverdue = Boolean(serviceContext?.timing?.isOverdue);
  const opensInWorkQueue = Boolean(
    activeRequest &&
    isWorkQueueStatus(activeRequest.status) &&
    activeRequest.taskId,
  );

  const handleClose = () => {
    if (recordMutation.isPending) return;
    setSelectedAttachment(null);
    setIsSireBreedDropdownOpen(false);
    setShowAllBreeds(false);
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Record Insemination Service"
        subtitle={
          selectedAnimalId
            ? "Confirm the service path before entering procedure details."
            : selectedFarmerId
              ? "Select the animal receiving the service."
              : "Find the farmer to begin."
        }
        size="xl"
        icon={<Syringe className="text-primary h-5 w-5" />}
        actions={
          <>
            <button
              type="button"
              className="btn btn-sm btn-ghost text-base-content/70"
              disabled={recordMutation.isPending}
              onClick={handleClose}
            >
              {context === "walk-in" ? "Cancel" : "Close"}
            </button>
            {showProcedureForm && (
              <button
                type="button"
                className="btn btn-sm btn-primary font-bold gap-1.5"
                disabled={recordMutation.isPending || procedureDisabled}
                onClick={saveService}
              >
                {recordMutation.isPending && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                {isPastRecord ? "Add past record" : "Save AI service"}
              </button>
            )}
          </>
        }
      >
        <div className="space-y-5 py-1">
          {config?.isHoliday && (
            <div
              role="alert"
              className="alert alert-warning/15 border-warning/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
              <div>
                <div className="font-bold text-base-content">
                  Office schedule notice
                </div>
                <div className="mt-0.5 leading-relaxed text-base-content/75">
                  Office operations are closed, but a technician may still
                  record a verified field service.
                </div>
              </div>
            </div>
          )}

          {context === "walk-in" && (
            <section
              className="space-y-3"
              aria-labelledby="ai-record-mode-title"
            >
              <div>
                <h3
                  id="ai-record-mode-title"
                  className="font-bold text-sm text-base-content"
                >
                  Recording method
                </h3>
                <p className="mt-1 text-xs text-base-content/60">
                  Record today&apos;s service or add an AI service that
                  happened earlier.
                </p>
              </div>

              <div
                role="tablist"
                aria-label="AI recording method"
                className="tabs tabs-box relative grid grid-cols-2 w-full bg-base-200/60 border border-base-300 rounded-xl p-1 select-none"
              >
                {/* Smooth sliding indicator pill */}
                <div
                  className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-primary/15 transition-transform duration-300 ease-in-out pointer-events-none ${
                    recordMode === "now"
                      ? "left-1 translate-x-0"
                      : "left-1 translate-x-full"
                  }`}
                />

                <button
                  type="button"
                  role="tab"
                  aria-selected={recordMode === "now"}
                  className={`tab relative z-10 w-full rounded-lg text-xs sm:text-sm transition-colors duration-200 ${
                    recordMode === "now"
                      ? "font-bold! text-primary! bg-transparent!"
                      : "text-base-content/70 hover:text-base-content bg-transparent!"
                  }`}
                  onClick={() => {
                    setRecordMode("now");
                    setFieldErrors({});
                    setSubmissionError("");
                  }}
                >
                  Record Insemination
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={recordMode === "past"}
                  className={`tab relative z-10 w-full rounded-lg text-xs sm:text-sm transition-colors duration-200 ${
                    recordMode === "past"
                      ? "font-bold! text-primary! bg-transparent!"
                      : "text-base-content/70 hover:text-base-content bg-transparent!"
                  }`}
                  onClick={() => {
                    setRecordMode("past");
                    setFieldErrors({});
                    setSubmissionError("");
                  }}
                >
                  Add Past Record
                </button>
              </div>

              {isPastRecord && (
                <div className="space-y-3 rounded-2xl border border-base-300 bg-base-200/50 p-4">
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-bold text-base-content">
                      After saving
                    </legend>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-base-200 bg-base-100 p-3 hover:border-primary/40 transition-colors">
                      <input
                        type="radio"
                        name="previous-ai-entry-mode"
                        className="radio radio-primary radio-sm mt-0.5"
                        checked={previousEntryMode === "history_only"}
                        onChange={() => setPreviousEntryMode("history_only")}
                      />
                      <span>
                        <span className="block font-semibold text-sm text-base-content">
                          Add to history only
                        </span>
                        <span className="block text-xs text-base-content/60 mt-0.5 leading-relaxed">
                          Keep the record in the animal&apos;s history without
                          changing the current breeding cycle.
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-base-200 bg-base-100 p-3 hover:border-primary/40 transition-colors">
                      <input
                        type="radio"
                        name="previous-ai-entry-mode"
                        className="radio radio-primary radio-sm mt-0.5"
                        checked={previousEntryMode === "continue_tracking"}
                        onChange={() =>
                          setPreviousEntryMode("continue_tracking")
                        }
                      />
                      <span>
                        <span className="block font-semibold text-sm text-base-content">
                          Continue tracking
                        </span>
                        <span className="block text-xs text-base-content/60 mt-0.5 leading-relaxed">
                          Start the current breeding follow-up cycle from the
                          actual historical service date.
                        </span>
                      </span>
                    </label>
                  </fieldset>
                </div>
              )}
            </section>
          )}

          {/* ========================================== */}
          {/* FARMER SELECTION */}
          {/* ========================================== */}
          {capabilities.showFarmerSearch && (
            <div className="border border-base-300 rounded-2xl p-4 space-y-4">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                Farmer and Animal
              </span>

              {context === "walk-in" && !hasDirectSelection && (
                <div
                  role="status"
                  className="alert alert-info/15 border-info/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4"
                >
                  <Info className="h-4 w-4 shrink-0 text-info mt-0.5" />
                  <span>Select a registered farmer and animal.</span>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <fieldset className="fieldset">
                  <legend className="fieldset-legend text-xs font-semibold text-base-content/80">
                    Farmer
                  </legend>
                  {preSelectedFarmer ? (
                    <div className="flex h-12 items-center gap-3 rounded-xl border border-base-300 bg-base-200/50 px-4">
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
                      <span className="truncate font-semibold text-sm text-base-content">
                        {preSelectedFarmer.name}
                      </span>
                    </div>
                  ) : (
                    <div className="relative">
                      <label className="input input-bordered w-full rounded-xl flex items-center gap-2 focus-within:outline-primary">
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
                          className="grow min-w-0 text-sm font-medium"
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
                          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-1 shadow-lg"
                        >
                          {isLoadingFarmers ? (
                            <div
                              className="space-y-3 p-4"
                              role="status"
                              aria-live="polite"
                            >
                              <div className="skeleton h-10 w-full rounded-xl" />
                              <div className="skeleton h-10 w-full rounded-xl" />
                              <span className="sr-only">
                                Loading registered farmers
                              </span>
                            </div>
                          ) : isFarmersError ? (
                            <div className="space-y-3 p-4">
                              <div
                                role="alert"
                                className="alert alert-error alert-soft rounded-xl text-xs"
                              >
                                <AlertCircle size={16} />
                                <span className="text-xs">
                                  {farmersError?.response?.data?.message ||
                                    "Registered farmers could not be loaded."}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm btn-ghost text-primary w-full"
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
                                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-base-200"
                                onMouseDown={(event) =>
                                  event.preventDefault()
                                }
                                onClick={() => selectFarmer(farmer)}
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
                                  <span className="block truncate font-semibold text-sm text-base-content">
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
                                <div className="font-semibold text-sm text-base-content">
                                  Farmer not found
                                </div>
                                <div className="text-xs text-base-content/55 mt-0.5">
                                  {capabilities.showRegistration
                                    ? "Register the farmer before adding an animal."
                                    : "No matching registered farmer is available for this service."}
                                </div>
                              </div>
                              {capabilities.showRegistration && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-ghost text-primary font-bold"
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
                    <legend className="fieldset-legend text-xs font-semibold text-base-content/80">
                      Animal
                    </legend>
                    {preSelectedAnimal ? (
                      <div className="flex h-12 items-center gap-3 rounded-xl border border-base-300 bg-base-200/50 px-4">
                        <Activity size={16} className="text-primary" />
                        <span className="truncate font-semibold text-sm text-base-content">
                          Tag #{preSelectedAnimal.earTag} ·{" "}
                          {preSelectedAnimal.breed || "Breed not recorded"}
                        </span>
                      </div>
                    ) : selectedFarmerId &&
                      !isLoadingAnimals &&
                      !isAnimalsError &&
                      availableAnimals.length === 0 ? (
                      <div className="space-y-3 rounded-xl border border-base-300 bg-base-200/50 p-4 text-center">
                        <div>
                          <div className="font-semibold text-sm text-base-content">
                            No animals found
                          </div>
                          <div className="text-xs text-base-content/55 mt-0.5">
                            This farmer has no registered animals.
                          </div>
                        </div>
                        {capabilities.showRegistration && (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost text-primary font-bold"
                            onClick={() => setIsRegisterAnimalOpen(true)}
                          >
                            <Plus size={15} /> Register animal
                          </button>
                        )}
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
                          className={`input input-bordered w-full rounded-xl flex items-center justify-between gap-2 text-left focus:outline-primary ${
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
                                  setProcedure(initialProcedure());
                                }}
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.stopPropagation();
                                    setSelectedAnimalId("");
                                    setProcedure(initialProcedure());
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
                            className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-1.5 shadow-xl space-y-1"
                          >
                            <button
                              type="button"
                              role="option"
                              aria-selected={!selectedAnimalId}
                              onClick={() => {
                                setSelectedAnimalId("");
                                setIsAnimalDropdownOpen(false);
                                setProcedure(initialProcedure());
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-left transition-colors ${
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

                            {availableAnimals.map((animal) => {
                              const isSelected =
                                String(animal._id) ===
                                String(selectedAnimalId);
                              const isMale =
                                String(animal.gender || "").toLowerCase() ===
                                "male";
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
                                  disabled={isMale}
                                  onClick={() => {
                                    if (!isMale) {
                                      setSelectedAnimalId(animal._id);
                                      setIsAnimalDropdownOpen(false);
                                      setProcedure(initialProcedure());
                                    }
                                  }}
                                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                                    isSelected
                                      ? "bg-primary/10 text-primary font-semibold"
                                      : isMale
                                        ? "opacity-40 cursor-not-allowed bg-base-200/40"
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
                                          className={`badge badge-xs font-semibold shrink-0 ${
                                            isMale
                                              ? "badge-error badge-soft"
                                              : "badge-success badge-soft"
                                          }`}
                                        >
                                          {isMale
                                            ? "Male"
                                            : animal.gender || "Female"}
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
                                    ) : isMale ? (
                                      <span className="text-[10px] font-bold text-error/80 uppercase tracking-wide">
                                        Ineligible
                                      </span>
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })}

                            {capabilities.showRegistration && (
                              <>
                                <div className="divider my-0.5" />
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs w-full justify-start text-primary gap-1.5 font-semibold hover:bg-primary/10"
                                  onClick={() => {
                                    setIsAnimalDropdownOpen(false);
                                    setIsRegisterAnimalOpen(true);
                                  }}
                                >
                                  <Plus size={14} /> Register animal
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {isAnimalsError && (
                          <div
                            className="alert alert-error rounded-xl mt-2 text-xs"
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
                )}
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TASK SUMMARY (Read-Only) */}
          {/* ========================================== */}
          {context === "task" && preSelectedFarmer && preSelectedAnimal && (
            <section className="space-y-4">
              {/* Animal & Farmer Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Target Animal */}
                <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block mb-2">
                    Target Animal
                  </span>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-base-content">
                        {taskAnimal.name || "Animal"}
                        {taskAnimal.earTag ? ` · Tag ${taskAnimal.earTag}` : ""}
                      </h4>
                      <p className="text-xs text-base-content/70 mt-0.5">
                        {taskAnimal.breed || taskAnimal.species || "Livestock"}
                      </p>
                    </div>
                    {taskAnimal.reproductiveStatus && (
                      <span className="badge badge-success badge-sm font-semibold">
                        {taskAnimal.reproductiveStatus}
                      </span>
                    )}
                  </div>
                </div>

                {/* Farmer Info */}
                <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block mb-2">
                    Farmer Details
                  </span>
                  <h4 className="font-bold text-sm text-base-content">
                    {taskFarmer.name || "Unknown farmer"}
                  </h4>
                  <p className="text-xs text-base-content/70 mt-0.5">
                    {requestContext?.location ||
                      taskFarmer.location ||
                      "Location not recorded"}
                  </p>
                  {taskFarmer.phone || taskFarmer.phoneNumber ? (
                    <a
                      href={`tel:${taskFarmer.phone || taskFarmer.phoneNumber}`}
                      className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold mt-2 hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      {taskFarmer.phone || taskFarmer.phoneNumber}
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Visit & Request Details Section */}
              <div className="border border-base-300 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
                    Visit & Request Details
                  </span>
                  <span className="text-[11px] text-base-content/60 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Request submitted:{" "}
                    {requestContext?.requestedAt
                      ? new Date(
                          requestContext.requestedAt,
                        ).toLocaleDateString("en-US", {
                          timeZone: "Asia/Manila",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "Not recorded"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-base-100 border border-base-200 rounded-xl p-3 flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-base-content/60 block">
                        Scheduled visit
                      </span>
                      <span className="text-xs font-bold text-base-content">
                        {formatCanonicalSchedule(requestContext?.schedule)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-base-100 border border-base-200 rounded-xl p-3 flex items-center gap-3">
                    <Activity className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-base-content/60 block">
                        Submitted heat signs
                      </span>
                      <span className="text-xs font-bold text-base-content">
                        {taskHeatSigns.length
                          ? taskHeatSigns
                              .map((sign) => formatHeatSignLabel(sign))
                              .filter(Boolean)
                              .join(", ")
                          : "None submitted"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Farmer Note */}
                <div>
                  <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1">
                    Farmer Note
                  </span>
                  {taskFarmerNote ? (
                    <p className="bg-base-100 border border-base-200 rounded-xl p-3 text-xs leading-relaxed text-base-content font-medium whitespace-pre-wrap">
                      {taskFarmerNote}
                    </p>
                  ) : (
                    <p className="text-xs text-base-content/50 italic">
                      No farmer note provided.
                    </p>
                  )}
                </div>

                {/* Submitted Attachments */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold uppercase text-base-content/60 block">
                      Submitted Attachments ({taskAttachments.length})
                    </span>
                    {taskAttachments.length > 0 && (
                      <p className="text-xs font-medium text-base-content/70">
                        {taskAttachments.length} attachment
                        {taskAttachments.length === 1 ? "" : "s"} submitted
                      </p>
                    )}
                  </div>

                  {taskAttachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2.5 pt-1">
                      {taskAttachments.map((photo, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedAttachment(photo)}
                          className="group relative h-20 w-20 rounded-xl overflow-hidden border border-base-300 hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
                          aria-label={`Enlarge attachment ${idx + 1}`}
                        >
                          <img
                            src={imagePreviewUrl(photo)}
                            alt={`Submitted attachment ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-base-content/50 italic">
                      No attachments submitted with this request.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ========================================== */}
          {/* SERVICE CONTEXT */}
          {/* ========================================== */}
          {capabilities.showServiceContext &&
            !isPastRecord &&
            selectedFarmerId &&
            selectedAnimalId && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <ClipboardList size={16} className="text-primary" />
                  <h3 className="font-bold text-sm text-base-content">
                    Service context
                  </h3>
                </div>

                {isLoadingContext && (
                  <div
                    role="status"
                    className="flex items-center gap-3 rounded-2xl border border-base-300 bg-base-200/50 p-4 text-xs text-base-content/70 shadow-2xs"
                  >
                    <span className="loading loading-spinner loading-sm text-primary" />
                    <span>
                      Checking requests and insemination eligibility…
                    </span>
                  </div>
                )}

                {isContextError && (
                  <div
                    role="alert"
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 rounded-2xl border border-error/30 bg-error/5 p-4 text-base-content shadow-2xs"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-error/15 text-error mt-0.5 sm:mt-0">
                        <AlertCircle size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-error">
                          Context could not be loaded
                        </div>
                        <div className="text-xs text-base-content/70 mt-0.5">
                          {contextError?.response?.data?.message ||
                            "Check the connection and try again."}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline btn-error self-end sm:self-center shrink-0"
                      onClick={() => refetchContext()}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {serviceContext?.mode === "walk_in" && (
                  <div
                    role="alert"
                    className="flex items-start gap-3.5 rounded-2xl border border-success/30 bg-success/5 p-4 text-base-content shadow-2xs"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success mt-0.5">
                      <BadgeCheck size={18} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-base-content">
                          Direct service available
                        </span>
                        <span className="badge badge-xs badge-success badge-soft font-semibold">
                          Eligible
                        </span>
                      </div>
                      <p className="text-xs text-base-content/70 leading-relaxed">
                        No active AI request was found. Record the current
                        service directly for this farmer and animal.
                      </p>
                    </div>
                  </div>
                )}

                {activeRequest &&
                  (() => {
                    const isBlocked = serviceContext.mode === "blocked";
                    const tone = isBlocked
                      ? "error"
                      : isOverdue
                        ? "warning"
                        : "info";

                    const toneStyles = {
                      error: {
                        card: "border-error/30 bg-error/5",
                        iconBox: "bg-error/15 text-error",
                        button: "btn-outline btn-error",
                      },
                      warning: {
                        card: "border-warning/35 bg-warning/5",
                        iconBox: "bg-warning/15 text-warning",
                        button: "btn-warning",
                      },
                      info: {
                        card: "border-info/25 bg-info/5",
                        iconBox: "bg-info/15 text-info",
                        button: "btn-primary",
                      },
                    }[tone];

                    return (
                      <div
                        role="alert"
                        className={`flex flex-col sm:flex-row items-start justify-between gap-4 rounded-2xl border p-4 text-base-content shadow-2xs transition-all ${toneStyles.card}`}
                      >
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          <div
                            className={`flex size-9 shrink-0 items-center justify-center rounded-xl mt-0.5 ${toneStyles.iconBox}`}
                          >
                            <CalendarClock size={18} />
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-base-content">
                                Active Insemination request found
                              </span>
                              <span className="badge badge-sm badge-info badge-soft font-semibold">
                                {requestStatusLabel(activeRequest.status)}
                              </span>
                              {serviceContext.timing?.isEarly && (
                                <span className="badge badge-sm badge-warning badge-soft font-semibold">
                                  Scheduled later
                                </span>
                              )}
                              {serviceContext.timing?.isOverdue && (
                                <span className="badge badge-sm badge-warning badge-soft font-semibold">
                                  Overdue
                                </span>
                              )}
                              {isBlocked && (
                                <span className="badge badge-sm badge-error badge-soft font-semibold">
                                  Blocked
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-base-content/80">
                              <span className="font-semibold text-base-content">
                                Visit:{" "}
                                {formatVisit(
                                  activeRequest.scheduledDate,
                                  activeRequest.visitPeriod,
                                )}
                              </span>
                              <span className="text-base-content/40">·</span>
                              <span>
                                {activeRequest.assignedTechnician?.name
                                  ? activeRequest.assignedTechnician.name
                                  : "Not yet claimed"}
                              </span>
                            </div>

                            <div className="text-xs text-base-content/70 pt-0.5 leading-relaxed">
                              {activeRequest.assignment === "unclaimed" ? (
                                "Claim this request, then choose its visit schedule."
                              ) : isOverdue ? (
                                <span className="font-medium text-warning-content dark:text-warning">
                                  This service already passed its scheduled
                                  date. <br />
                                  Please record the necessary details if this
                                  service is completed.
                                </span>
                              ) : isScheduled || opensInWorkQueue ? (
                                "This visit is already scheduled and is managed in My Work."
                              ) : (
                                "Continue to the request details to choose a visit date and time."
                              )}
                            </div>

                            {serviceContext.blockedReason && (
                              <div className="text-xs font-semibold text-error pt-1">
                                {serviceContext.blockedReason}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 sm:self-center w-full sm:w-auto pt-2 sm:pt-0">
                          {activeRequest.assignment === "unclaimed" &&
                          serviceContext.allowedActions?.includes(
                            "claim_request",
                          ) ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm w-full sm:w-auto shadow-xs font-bold gap-1.5"
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
                              className={`btn btn-sm w-full sm:w-auto shadow-xs font-bold ${toneStyles.button}`}
                              onClick={() => openRequest(activeRequest)}
                            >
                              {isScheduled || opensInWorkQueue
                                ? "Open in My Work"
                                : "Schedule request"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}

                {serviceContext?.mode === "blocked" && !activeRequest && (
                  <div
                    role="alert"
                    className="flex items-start gap-3.5 rounded-2xl border border-error/30 bg-error/5 p-4 text-base-content shadow-2xs"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-error/15 text-error mt-0.5">
                      <AlertCircle size={18} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-error">
                          AI service cannot continue
                        </span>
                        <span className="badge badge-xs badge-error badge-soft font-semibold">
                          Blocked
                        </span>
                      </div>
                      <p className="text-xs text-base-content/75 leading-relaxed">
                        {serviceContext.blockedReason ||
                          "This animal is currently not eligible for artificial insemination."}
                      </p>
                    </div>
                  </div>
                )}
              </section>
            )}

          {/* ========================================== */}
          {/* PROCEDURE FORM */}
          {/* ========================================== */}
          {showProcedureForm && (
            <fieldset
              disabled={procedureDisabled}
              className="border border-base-300 rounded-2xl p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                  {isPastRecord
                    ? "Past Insemination Details"
                    : "Insemination Procedure Details"}
                </span>
              </div>

              {submissionError ? (
                <div
                  role="alert"
                  className="alert alert-error/15 border-error/40 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-error mt-0.5" />
                  <span>{submissionError}</span>
                </div>
              ) : isPastRecord ? (
                <div
                  role="alert"
                  className="alert alert-info/15 border-info/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4"
                >
                  <History className="h-4 w-4 shrink-0 text-info mt-0.5" />
                  <span>
                    Enter the actual date and time of the earlier Insemination
                    service.
                  </span>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label-text text-xs font-semibold text-base-content/80 block mb-1">
                    Sire breed
                  </label>
                  <div className="relative" ref={sireBreedDropdownRef}>
                    <label
                      className={`input input-bordered w-full rounded-xl text-sm font-medium flex items-center gap-2 focus-within:outline-primary ${fieldErrors.sireBreed ? "input-error" : ""}`}
                    >
                      <input
                        aria-label="Sire breed"
                        className="grow min-w-0 text-sm font-medium"
                        value={procedure.sireBreed}
                        placeholder="Type or select sire breed"
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
                          setShowAllBreeds(false);
                          setIsSireBreedDropdownOpen(true);
                        }}
                        onFocus={() => setIsSireBreedDropdownOpen(true)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setIsSireBreedDropdownOpen(false);
                            setShowAllBreeds(false);
                          }
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Toggle sire breed options"
                        tabIndex={-1}
                        className="btn btn-ghost btn-circle btn-xs shrink-0 text-base-content/50 hover:text-base-content"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setIsSireBreedDropdownOpen((prev) => {
                            const next = !prev;
                            if (next) setShowAllBreeds(true);
                            return next;
                          });
                        }}
                      >
                        <ChevronDown
                          size={15}
                          className={`transition-transform duration-150 ${isSireBreedDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                    </label>

                    {isSireBreedDropdownOpen && (
                      <div
                        role="listbox"
                        aria-label="Sire breed suggestions"
                        className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-1 shadow-lg"
                      >
                        {displayBreeds.length > 0 ? (
                          displayBreeds.map((breed) => {
                            const isSelected =
                              procedure.sireBreed.trim().toLowerCase() ===
                              breed.toLowerCase();
                            return (
                              <button
                                key={breed}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                                  isSelected
                                    ? "bg-primary/10 text-primary font-semibold"
                                    : "hover:bg-base-200 text-base-content"
                                }`}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  setProcedure((current) => ({
                                    ...current,
                                    sireBreed: breed,
                                  }));
                                  setFieldErrors((current) => ({
                                    ...current,
                                    sireBreed: null,
                                  }));
                                  setIsSireBreedDropdownOpen(false);
                                  setShowAllBreeds(false);
                                }}
                              >
                                <span>{breed}</span>
                                {isSelected && (
                                  <Check
                                    size={15}
                                    className="text-primary shrink-0"
                                  />
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-2.5 text-xs text-base-content/60 italic">
                            No matching standard breed. &ldquo;{procedure.sireBreed}&rdquo; will be used.
                          </div>
                        )}

                        {!showAllBreeds &&
                          matchingBreeds.length < availableBreeds.length && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs w-full text-xs text-primary font-semibold mt-1"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                setShowAllBreeds(true);
                              }}
                            >
                              View all breeds ({availableBreeds.length})
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                  {fieldErrors.sireBreed && (
                    <p role="alert" className="text-xs text-error font-medium mt-1">
                      {fieldErrors.sireBreed}
                    </p>
                  )}
                </div>

                <div>
                  <label className="label-text text-xs font-semibold text-base-content/80 block mb-1">
                    Sire code
                  </label>
                  <label
                    className={`input input-bordered w-full rounded-xl text-sm font-medium flex items-center gap-2 focus-within:outline-primary ${fieldErrors.sireCode ? "input-error" : ""}`}
                  >
                    <BadgeCheck size={16} className="text-base-content/40 shrink-0" />
                    <input
                      aria-label="Sire code"
                      className="grow min-w-0"
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
                    <p role="alert" className="text-xs text-error font-medium mt-1">
                      {fieldErrors.sireCode}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="label-text text-xs font-semibold text-base-content/80 block mb-1">
                    Service date
                  </label>
                  <input
                    type="date"
                    aria-label="Actual insemination date"
                    className={`input input-bordered w-full rounded-xl text-sm font-medium focus:outline-primary ${fieldErrors.inseminationDate ? "input-error" : ""}`}
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
                    <p role="alert" className="text-xs text-error font-medium mt-1">
                      {fieldErrors.inseminationDate}
                    </p>
                  )}
                </div>

                <div>
                  <label className="label-text text-xs font-semibold text-base-content/80 block mb-1">
                    Service time
                  </label>
                  <input
                    type="time"
                    aria-label="Actual insemination time"
                    className="input input-bordered w-full rounded-xl text-sm font-medium focus:outline-primary"
                    value={procedure.time}
                    onChange={(event) =>
                      setProcedure((current) => ({
                        ...current,
                        time: event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="label-text text-xs font-semibold text-base-content/80 block mb-1">
                    Estrus type
                  </label>
                  <select
                    className="select select-bordered w-full rounded-xl text-sm font-medium focus:outline-primary"
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
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label-text text-xs font-semibold text-base-content/80 block mb-1">
                    Number of semen doses used
                  </label>
                  <input
                    type="number"
                    aria-label="Number of semen doses used"
                    min="1"
                    step="1"
                    className={`input input-bordered w-full rounded-xl text-sm font-medium focus:outline-primary ${fieldErrors.semenDosesUsed ? "input-error" : ""}`}
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
                    <p role="alert" className="text-xs text-error font-medium mt-1">
                      {fieldErrors.semenDosesUsed}
                    </p>
                  )}
                </div>
              </div>
            </fieldset>
          )}
        </div>
      </Modal>

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

      {/* Image Preview Modal */}
      {selectedAttachment ? (
        <ImagePreviewModal
          images={taskAttachments}
          selectedImage={selectedAttachment}
          onSelectImage={setSelectedAttachment}
          onClose={() => setSelectedAttachment(null)}
          title="Submitted Attachment Preview"
        />
      ) : null}
    </>
  );
};

export default AIServiceModal;
