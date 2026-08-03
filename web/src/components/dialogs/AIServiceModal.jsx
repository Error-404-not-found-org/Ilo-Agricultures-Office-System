import { useEffect, useMemo, useState } from "react";
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
import {
  CATTLE_BREEDS,
  BREED_OPTIONS_BY_SPECIES,
} from "../../constants/breeds";
import { getSireCodeByBreed } from "../../constants/sireRegistry";
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
    estrus: "Natural",
  };
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
  preSelectedFarmer,
  preSelectedAnimal,
  context = "walk-in", // "walk-in" | "task" | "admin"
  taskData,
  taskId,
}) => {
  // ==========================================
  // CONFIGURATION & CAPABILITIES
  // ==========================================
  const capabilities = {
    showFarmerSearch: context === "walk-in",
    showAnimalSelector: context === "walk-in",
    showRegistration: context === "walk-in",
    showServiceContext: context === "walk-in" || context === "admin",
    fetchContext: context === "walk-in" || context === "admin",
  };

  // ==========================================
  // HOOKS & STATE
  // ==========================================
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedFarmerId, setSelectedFarmerId] = useState("");
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [searchFarmer, setSearchFarmer] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRegisterFarmerOpen, setIsRegisterFarmerOpen] = useState(false);
  const [isRegisterAnimalOpen, setIsRegisterAnimalOpen] = useState(false);
  const [createdFarmer, setCreatedFarmer] = useState(null);
  const [createdAnimal, setCreatedAnimal] = useState(null);
  const [procedure, setProcedure] = useState(initialProcedure);

  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: async () => (await axiosInstance.get("/config")).data,
    enabled: isOpen,
  });

  const { data: farmers = [] } = useQuery({
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
    enabled: Boolean(selectedFarmerId),
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
    farmers.find((farmer) => farmer._id === selectedFarmerId) ||
    (createdFarmer?._id === selectedFarmerId ? createdFarmer : null) ||
    (preSelectedFarmer?._id === selectedFarmerId ? preSelectedFarmer : null);

  const availableAnimals = useMemo(
    () =>
      createdAnimal?._id &&
      !animals.some((animal) => animal._id === createdAnimal._id)
        ? [...animals, createdAnimal]
        : animals,
    [animals, createdAnimal],
  );

  const selectedAnimal =
    availableAnimals.find((animal) => animal._id === selectedAnimalId) ||
    (preSelectedAnimal?._id === selectedAnimalId ? preSelectedAnimal : null);

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
    onSuccess: () => {
      toast.success("AI service recorded successfully.");
      queryClient.invalidateQueries({ queryKey: ["technician"] });
      queryClient.invalidateQueries({ queryKey: ["farmer-animals"] });
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(
        getAIRequestErrorMessage(
          error,
          "The AI service could not be recorded.",
        ),
      );
      refetchContext();
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
      });
      return;
    }

    Promise.resolve().then(() => {
      if (preSelectedFarmer) {
        setSelectedFarmerId(preSelectedFarmer._id);
        setSearchFarmer(preSelectedFarmer.name || "");
      }
      if (preSelectedAnimal) setSelectedAnimalId(preSelectedAnimal._id);
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

  useEffect(() => {
    const species = selectedAnimal?.species;
    if (
      species &&
      procedure.sireBreed &&
      !(BREED_OPTIONS_BY_SPECIES[species] || []).includes(procedure.sireBreed)
    ) {
      Promise.resolve().then(() =>
        setProcedure((current) => ({
          ...current,
          sireBreed: "",
          sireCode: "",
        })),
      );
    }
  }, [procedure.sireBreed, selectedAnimal?.species]);

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
    if (context !== "task" && serviceContext?.mode !== "walk_in") {
      toast.error("Resolve the active request or eligibility notice first.");
      return;
    }
    if (!procedure.sireBreed || !procedure.sireCode) {
      toast.error("Select a sire breed before saving the service.");
      return;
    }

    const performedAt = new Date(
      `${procedure.inseminationDate}T${procedure.time}:00+08:00`,
    );
    const now = Date.now();
    if (Number.isNaN(performedAt.getTime())) {
      toast.error("Enter a valid AI service date and time.");
      return;
    }
    if (performedAt.getTime() > now + 5 * 60 * 1000) {
      toast.error("The AI service time cannot be in the future.");
      return;
    }
    if (performedAt.getTime() < now - 24 * 60 * 60 * 1000) {
      toast.error(
        "Use the authorized historical-record workflow for an older AI service.",
      );
      return;
    }

    recordMutation.mutate({
      farmerId: selectedFarmerId,
      animalId: selectedAnimalId,
      animalDetails: null,
      inseminationDetails: procedure,
      taskId: taskId || activeRequest?.taskId,
    });
  };

  const activeRequest = serviceContext?.activeRequest;
  const isWalkIn = serviceContext?.mode === "walk_in";
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
                            {matchingFarmers.length ? (
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
                                    Register the farmer before adding an animal.
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onMouseDown={(event) =>
                                    event.preventDefault()
                                  }
                                  onClick={() => setIsRegisterFarmerOpen(true)}
                                >
                                  <UserPlus size={15} /> Register farmer
                                </button>
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
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setIsRegisterAnimalOpen(true)}
                          >
                            <Plus size={15} /> Register animal
                          </button>
                        </div>
                      ) : (
                        <>
                          <select
                            className="select w-full"
                            disabled={!selectedFarmerId || isLoadingAnimals}
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
                      {preSelectedFarmer.name}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-base-content/70">
                      Animal
                    </div>
                    <div className="font-medium text-base-content">
                      Tag #{preSelectedAnimal.earTag} ·{" "}
                      {preSelectedAnimal.breed || "Breed not recorded"}
                    </div>
                  </div>
                </div>
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
            {(isWalkIn || context === "task") && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-base-300 pb-3">
                  <History size={16} className="text-primary" />
                  <h3 className="font-bold text-base-content">
                    AI procedure details
                  </h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">Sire breed</legend>
                    <select
                      className="select w-full"
                      value={procedure.sireBreed}
                      onChange={(event) => {
                        const breed = event.target.value;
                        setProcedure((current) => ({
                          ...current,
                          sireBreed: breed,
                          sireCode: getSireCodeByBreed(breed),
                        }));
                      }}
                    >
                      <option value="" disabled>
                        Select sire breed
                      </option>
                      {(
                        BREED_OPTIONS_BY_SPECIES[selectedAnimal?.species] ||
                        CATTLE_BREEDS
                      ).map((breed) => (
                        <option key={breed} value={breed}>
                          {breed}
                        </option>
                      ))}
                    </select>
                  </fieldset>

                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">Sire code</legend>
                    <label className="input w-full bg-base-200">
                      <BadgeCheck size={16} className="text-base-content/40" />
                      <input
                        readOnly
                        value={procedure.sireCode}
                        placeholder="Filled from sire breed"
                      />
                    </label>
                  </fieldset>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">Service date</legend>
                    <input
                      type="date"
                      className="input w-full"
                      max={localDate()}
                      value={procedure.inseminationDate}
                      onChange={(event) =>
                        setProcedure((current) => ({
                          ...current,
                          inseminationDate: event.target.value,
                        }))
                      }
                    />
                  </fieldset>
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">Service time</legend>
                    <input
                      type="time"
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
              </section>
            )}
          </div>

          {/* ========================================== */}
          {/* FOOTER */}
          {/* ========================================== */}
          <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-base-300 bg-base-100 px-5 py-4">
            <button type="button" className="btn" onClick={onClose}>
              {isWalkIn ? "Cancel" : "Close"}
            </button>
            {(isWalkIn || context === "task") && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={recordMutation.isPending}
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
