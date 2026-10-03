import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Baby,
  Calendar,
  ClipboardCheck,
  Search,
  AlertCircle,
  Sparkles,
  ImagePlus,
  Info,
  Phone,
  Clock,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { toast } from "sonner";
import { getManilaDateKey } from "../../utils/healthRequestWorkflow";
import { formatFarmerLocation } from "./PregnancyLossReviewModal";

const inputClass = `input input-bordered w-full text-xs font-semibold bg-base-100 hover:border-primary/50 focus:border-primary focus:outline-none transition-colors rounded-xl h-10`;
const selectClass = `select select-bordered w-full text-xs font-semibold bg-base-100 hover:border-primary/50 focus:border-primary focus:outline-none transition-colors rounded-xl h-10 cursor-pointer`;
const labelClass = `label-text text-xs font-semibold text-base-content/80 block mb-1`;

const formatDate = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getInitialCalvingForm = (pregnancyData = null) => ({
  pregnancyId: pregnancyData?._id || pregnancyData?.id || "",
  animalId:
    (typeof pregnancyData?.animalId === "string"
      ? pregnancyData.animalId
      : pregnancyData?.animalId?._id || pregnancyData?.animalId?.id) || "",
  date: getManilaDateKey(),
  calvingEase: "Natural",
  outcome: "live_birth",
  numberOfCalves: 1,
  calves: [
    {
      sex: "F",
      earTag: "",
      color: "",
      brand: "",
      imageUrl: "",
      isLiving: true,
    },
  ],
  technicianNote: "",
});

const RecordCalfDropModal = ({
  isOpen,
  onClose,
  pregnancyData,
  onSuccess,
  preSelectedFarmer,
  preSelectedAnimal,
  taskId,
  task,
}) => {
  const queryClient = useQueryClient();
  const workflowIdentity = String(
    taskId ||
      pregnancyData?._id ||
      pregnancyData?.id ||
      preSelectedAnimal?._id ||
      preSelectedAnimal?.id ||
      (typeof preSelectedAnimal === "string" ? preSelectedAnimal : "") ||
      preSelectedFarmer?._id ||
      preSelectedFarmer?.id ||
      (typeof preSelectedFarmer === "string" ? preSelectedFarmer : "") ||
      "standalone-calving",
  );
  const submitInFlightRef = useRef(false);
  const activeWorkflowIdentityRef = useRef(isOpen ? workflowIdentity : null);

  const toTitleCase = (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Standalone selectors state (used when pregnancyData is not provided)
  const [selectedFarmerId, setSelectedFarmerId] = useState("");
  const [searchFarmer, setSearchFarmer] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [, setFieldErrors] = useState({});
  const [submissionError, setSubmissionError] = useState("");

  const [formData, setFormData] = useState(() =>
    getInitialCalvingForm(pregnancyData),
  );
  const isMixedInvalid =
    formData.outcome === "mixed" &&
    (formData.calves.filter((c) => c.isLiving).length < 1 ||
      formData.calves.filter((c) => !c.isLiving).length < 1);

  // Reset state for a new workflow and handle Escape while idle.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !submitInFlightRef.current) {
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
        setSelectedFarmerId("");
        setSearchFarmer("");
        setIsDropdownOpen(false);
        setSelectedAnimalId("");
        setFieldErrors({});
        setSubmissionError("");
        submitInFlightRef.current = false;
        setFormData(getInitialCalvingForm(pregnancyData));
        if (preSelectedFarmer) {
          setSelectedFarmerId(
            preSelectedFarmer._id ||
              preSelectedFarmer.id ||
              (typeof preSelectedFarmer === "string" ? preSelectedFarmer : ""),
          );
          setSearchFarmer(preSelectedFarmer.name || "");
        }
        const initialAnimalId =
          preSelectedAnimal?._id ||
          preSelectedAnimal?.id ||
          (typeof preSelectedAnimal === "string" ? preSelectedAnimal : "") ||
          (typeof pregnancyData?.animalId === "string"
            ? pregnancyData.animalId
            : pregnancyData?.animalId?._id ||
              pregnancyData?.animalId?.id ||
              "");
        if (initialAnimalId) {
          setSelectedAnimalId(initialAnimalId);
        }
      });
    } else {
      activeWorkflowIdentityRef.current = null;
      Promise.resolve().then(() => {
        setSelectedFarmerId("");
        setSearchFarmer("");
        setIsDropdownOpen(false);
        setSelectedAnimalId("");
        setFieldErrors({});
        setSubmissionError("");
        submitInFlightRef.current = false;
        setFormData(getInitialCalvingForm());
      });
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isOpen,
    onClose,
    preSelectedFarmer,
    preSelectedAnimal,
    pregnancyData,
    workflowIdentity,
  ]);

  // Queries for standalone mode
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
    enabled: isOpen && !pregnancyData,
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
    enabled: Boolean(selectedFarmerId && isOpen && !pregnancyData),
  });

  const resolvedAnimalId =
    (typeof pregnancyData?.animalId === "string"
      ? pregnancyData.animalId
      : pregnancyData?.animalId?._id || pregnancyData?.animalId?.id) ||
    preSelectedAnimal?._id ||
    preSelectedAnimal?.id ||
    (typeof preSelectedAnimal === "string" ? preSelectedAnimal : "") ||
    task?.animal?.id ||
    task?.animal?._id ||
    selectedAnimalId;

  const {
    data: animalHistory = {},
    error: historyError,
    isError: isHistoryError,
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["animal-history", resolvedAnimalId],
    queryFn: async () => {
      if (!resolvedAnimalId) return {};
      try {
        const res = await axiosInstance.get(
          `/technician/animal-history/${resolvedAnimalId}`,
        );
        return res?.data || {};
      } catch {
        return {};
      }
    },
    enabled: Boolean(resolvedAnimalId && isOpen),
  });

  // Filter to pregnant cows for calving selection in standalone mode
  const pregnantAnimals = pregnancyData
    ? []
    : animals.filter((a) => a.reproductiveStatus === "Pregnant");

  const activePregnancy = useMemo(() => {
    const calvedPregnancyIds = new Set(
      (animalHistory.calvings || []).map((item) =>
        String(item.pregnancyId?._id || item.pregnancyId),
      ),
    );
    const activePregnancyRecord = (animalHistory.pregnancies || []).find(
      (item) =>
        item.pregnancyDiagnosis?.result === "Pregnant" &&
        !["lost", "completed"].includes(item.cycleStatus) &&
        !calvedPregnancyIds.has(String(item._id || item.id)),
    );
    return pregnancyData || activePregnancyRecord || null;
  }, [animalHistory.calvings, animalHistory.pregnancies, pregnancyData]);

  // Sync active pregnancy details with form data
  useEffect(() => {
    if (activePregnancy) {
      Promise.resolve().then(() => {
        setFormData((prev) => ({
          ...prev,
          pregnancyId: activePregnancy._id || activePregnancy.id,
          animalId:
            activePregnancy.animalId?._id ||
            activePregnancy.animalId ||
            selectedAnimalId,
        }));
      });
    } else if (!pregnancyData) {
      Promise.resolve().then(() => {
        setFormData((prev) => ({
          ...prev,
          pregnancyId: "",
          animalId: "",
        }));
      });
    }
  }, [activePregnancy, selectedAnimalId, isOpen, pregnancyData]);

  const handleNumCalvesChange = (num) => {
    const count = parseInt(num);
    if (isNaN(count) || count < 1) return;

    let newCalves = [...formData.calves];
    if (count > newCalves.length) {
      for (let i = newCalves.length; i < count; i++) {
        newCalves.push({
          sex: "F",
          earTag: "",
          color: "",
          brand: "",
          imageUrl: "",
          isLiving: true,
        });
      }
    } else {
      newCalves = newCalves.slice(0, count);
    }

    setFormData({ ...formData, numberOfCalves: count, calves: newCalves });
    setFieldErrors((current) => ({ ...current, calves: null }));
  };

  const updateCalf = (index, field, value) => {
    const newCalves = [...formData.calves];
    newCalves[index][field] = value;
    setFormData({ ...formData, calves: newCalves });
  };

  const handleImageUpload = (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSubmissionError("Select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSubmissionError("Image size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSubmissionError("");
      updateCalf(index, "imageUrl", reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAutoGenerateTag = (index) => {
    const generated = `CF-${Date.now().toString().slice(-4)}-${index + 1}`;
    updateCalf(index, "earTag", generated);
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.post(
        "/technician/record-calving",
        data,
      );
      return res.data;
    },
    onSuccess: async (result) => {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["technician"] }),
        queryClient.invalidateQueries({ queryKey: ["farmer-animals"] }),
        queryClient.invalidateQueries({ queryKey: ["animal-history"] }),
        queryClient.invalidateQueries({
          queryKey: ["animal", formData.animalId],
        }),
      ]);
      if (onSuccess) onSuccess(result);
      onClose();
      toast.success("Calf Drop and offspring successfully recorded!");
    },
    onError: (error) => {
      setSubmissionError(
        "Failed to record Calf Drop: " +
          (error.response?.data?.message || error.message),
      );
    },
    onSettled: () => {
      submitInFlightRef.current = false;
    },
  });

  const handleSave = () => {
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setSubmissionError("");
    const rejectSubmission = (message) => {
      setSubmissionError(message);
      submitInFlightRef.current = false;
    };
    if (!formData.animalId || !formData.pregnancyId) {
      rejectSubmission(
        "Please select a mother with an active pregnancy record.",
      );
      return;
    }

    const livingCalves =
      formData.outcome === "mixed"
        ? formData.calves.filter((calf) => calf.isLiving)
        : formData.outcome === "live_birth"
          ? formData.calves
          : [];
    const nonLivingCalves =
      formData.outcome === "mixed"
        ? formData.calves.filter((calf) => !calf.isLiving)
        : formData.outcome === "stillbirth"
          ? formData.calves
          : [];

    if (
      formData.outcome === "mixed" &&
      (livingCalves.length === 0 || nonLivingCalves.length === 0)
    ) {
      rejectSubmission(
        "Mixed delivery must include at least one living and one stillborn calf.",
      );
      return;
    }

    // Living offspring become registered animals and require unique identifiers.
    for (let i = 0; i < livingCalves.length; i++) {
      if (!livingCalves[i].earTag.trim()) {
        rejectSubmission(`Please provide an Ear Tag ID for Calf #${i + 1}`);
        return;
      }
    }
    const normalizedLivingTags = livingCalves.map((calf) =>
      calf.earTag.trim().toLowerCase(),
    );
    if (new Set(normalizedLivingTags).size !== normalizedLivingTags.length) {
      rejectSubmission(
        "Living calf ear tags must be unique within this record.",
      );
      return;
    }

    const { calvingEase, ...basePayload } = formData;
    let payload = {
      ...basePayload,
      ...(formData.outcome === "abortion" ? {} : { calvingEase }),
      taskId,
    };

    // Handle Mixed outcome logic
    if (formData.outcome === "mixed") {
      payload.calves = livingCalves;
      payload.nonLivingCalves = nonLivingCalves;
    } else if (formData.outcome === "stillbirth") {
      payload.nonLivingCalves = formData.calves;
      payload.calves = [];
    } else if (formData.outcome === "abortion") {
      payload.numberOfCalves = 0;
      payload.nonLivingCalves = [];
      payload.calves = [];
    }

    mutation.mutate(payload);
  };

  const animalFromList = animals.find(
    (a) => a._id === resolvedAnimalId || a.id === resolvedAnimalId,
  );

  const motherEarTag =
    (preSelectedAnimal && typeof preSelectedAnimal === "object"
      ? preSelectedAnimal.earTag || preSelectedAnimal.name
      : null) ||
    (pregnancyData?.animalId && typeof pregnancyData.animalId === "object"
      ? pregnancyData.animalId.earTag || pregnancyData.animalId.name
      : null) ||
    animalHistory?.animal?.earTag ||
    animalHistory?.animal?.name ||
    animalFromList?.earTag ||
    animalFromList?.name ||
    (typeof preSelectedAnimal === "string" && preSelectedAnimal.trim()
      ? preSelectedAnimal.trim()
      : null) ||
    "Selected Animal";

  const motherAnimal =
    (preSelectedAnimal && typeof preSelectedAnimal === "object"
      ? preSelectedAnimal
      : null) ||
    (pregnancyData?.animalId && typeof pregnancyData.animalId === "object"
      ? pregnancyData.animalId
      : null) ||
    animalHistory?.animal ||
    animalFromList ||
    task?.animal ||
    null;

  const motherName = motherAnimal?.name || "";
  const motherDisplayName =
    motherName && motherEarTag && motherEarTag !== "Selected Animal"
      ? `${motherName} (${motherEarTag})`
      : motherEarTag !== "Selected Animal"
        ? `Tag #${motherEarTag}`
        : motherName || "Selected Animal";

  const motherBreed = motherAnimal?.breed || "Crossbreed";
  const motherSpecies = motherAnimal?.species || "Cattle";
  const motherStatus = motherAnimal?.reproductiveStatus || "Pregnant";

  // Farmer resolution
  const resolvedFarmer =
    (preSelectedFarmer && typeof preSelectedFarmer === "object"
      ? preSelectedFarmer
      : null) ||
    animalHistory?.animal?.farmerId ||
    task?.farmer ||
    farmers.find((f) => f._id === selectedFarmerId) ||
    null;

  const farmerName =
    resolvedFarmer?.name ||
    resolvedFarmer?.fullName ||
    [resolvedFarmer?.firstName, resolvedFarmer?.lastName]
      .filter(Boolean)
      .join(" ") ||
    "Farmer";

  const farmerPhone =
    resolvedFarmer?.phoneNumber ||
    resolvedFarmer?.phone ||
    resolvedFarmer?.contactNumber ||
    null;

  const farmerLocation = formatFarmerLocation(
    resolvedFarmer,
    "Location not provided",
  );

  // Breeding & Expected Calving details
  const expectedCalvingDate =
    pregnancyData?.targetCalvingDate ||
    pregnancyData?.expectedCalvingDate ||
    activePregnancy?.targetCalvingDate ||
    activePregnancy?.expectedCalvingDate ||
    task?.dueDate ||
    task?.timing?.date ||
    task?.schedule?.date ||
    task?.context?.targetCalvingDate ||
    task?.context?.expectedCalvingDate ||
    animalHistory?.pregnancies?.[0]?.targetCalvingDate ||
    animalHistory?.pregnancies?.[0]?.expectedCalvingDate ||
    null;

  const inseminationRecord =
    (animalHistory.inseminations || []).find(
      (ins) =>
        String(ins.pregnancyId?._id || ins.pregnancyId) ===
          String(
            activePregnancy?._id ||
              activePregnancy?.id ||
              pregnancyData?._id,
          ) ||
        String(ins._id) ===
          String(
            activePregnancy?.inseminationId?._id ||
              activePregnancy?.inseminationId,
          ),
    ) || animalHistory.inseminations?.[0];

  const inseminationDate =
    pregnancyData?.inseminationDate ||
    activePregnancy?.inseminationDate ||
    inseminationRecord?.inseminationDate ||
    task?.context?.inseminationDate ||
    null;

  const sireDisplay =
    pregnancyData?.sireCode ||
    pregnancyData?.sireBreed ||
    activePregnancy?.sireCode ||
    activePregnancy?.sireBreed ||
    inseminationRecord?.sireCode ||
    inseminationRecord?.sireBreed ||
    task?.context?.sireCode ||
    task?.context?.sireBreed ||
    "—";

  const pdConfirmationDate =
    activePregnancy?.pregnancyDiagnosis?.date ||
    pregnancyData?.pregnancyDiagnosis?.date ||
    task?.context?.diagnosisDate ||
    activePregnancy?.createdAt ||
    null;

  const calvingStatusInfo = useMemo(() => {
    if (!expectedCalvingDate) return null;
    const target = new Date(expectedCalvingDate);
    if (Number.isNaN(target.getTime())) return null;

    const now = new Date();
    const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return {
        label: "Expected Today",
        className: "badge-warning font-bold",
      };
    } else if (diffDays < 0) {
      const daysPast = Math.abs(diffDays);
      return {
        label: `${daysPast} day${daysPast > 1 ? "s" : ""} past expected date`,
        className: "badge-error font-bold text-white",
      };
    } else {
      return {
        label: `Due in ${diffDays} day${diffDays > 1 ? "s" : ""}`,
        className: "badge-info font-bold text-white",
      };
    }
  }, [expectedCalvingDate]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="modal modal-open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-calving-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="modal-box relative flex max-h-[90vh] w-11/12 max-w-2xl flex-col overflow-hidden border border-base-300 p-0 bg-base-100 rounded-3xl shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-base-300 bg-base-100 px-5 py-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                <Baby className="h-5 w-5" />
              </div>
              <div>
                <h2
                  id="record-calving-title"
                  className="text-base md:text-lg font-bold text-base-content leading-tight"
                >
                  Record Calving
                </h2>
                <p className="mt-0.5 text-xs text-base-content/70">
                  Link birth details and offspring to Mother #{motherEarTag}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !mutation.isPending && onClose()}
              disabled={mutation.isPending}
              className="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:text-base-content"
              aria-label="Close calving form"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 md:px-6 py-5 space-y-5 custom-scrollbar bg-base-100">
            {submissionError && (
              <div role="alert" className="alert alert-error alert-soft rounded-2xl text-xs">
                <AlertCircle size={18} aria-hidden="true" />
                <span>{submissionError}</span>
              </div>
            )}

            {/* Guidance Banner (matching PregnancyLossReviewModal) */}
            <div className="alert alert-info/15 border-info/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4">
              <Info className="h-4 w-4 shrink-0 text-info mt-0.5" />
              <div>
                <p className="font-bold text-base-content">
                  Calving Delivery & Offspring Registration
                </p>
                <p className="mt-0.5 leading-relaxed text-base-content/75">
                  Record delivery details and register offspring. Recording live birth will register new calves and update the mother's reproductive cycle to postpartum recovery.
                </p>
              </div>
            </div>

            {/* Animal & Farmer Cards Grid (2-Column Responsive Layout) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mother Animal (Dam) Card */}
              <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block mb-2">
                  Mother Animal (Dam)
                </span>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-base-content">
                      {motherDisplayName}
                    </h4>
                    <p className="text-xs text-base-content/70 mt-0.5">
                      {motherBreed} · {motherSpecies}
                    </p>
                  </div>
                  <span className="badge badge-success badge-sm font-semibold">
                    {motherStatus}
                  </span>
                </div>
                {expectedCalvingDate ? (
                  <p className="text-[11px] text-base-content/60 mt-2">
                    Expected Calving: <strong>{formatDate(expectedCalvingDate)}</strong>
                  </p>
                ) : null}
              </div>

              {/* Farmer Info Card */}
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
            </div>

            {/* Expected Calving Date & Gestation Details Card */}
            <div className="border border-base-300 rounded-2xl p-4 space-y-3 bg-base-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
                  Breeding & Gestation Record
                </span>
                {calvingStatusInfo ? (
                  <span className={`badge ${calvingStatusInfo.className} badge-sm gap-1`}>
                    <Clock className="h-3 w-3" />
                    {calvingStatusInfo.label}
                  </span>
                ) : null}
              </div>

              {/* Expected Calving Date Highlight Card */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-base-content/60 block">
                      Expected Calving Date
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {formatDate(expectedCalvingDate)}
                    </span>
                  </div>
                </div>
                {expectedCalvingDate ? (
                  <span className="text-[11px] font-semibold text-base-content/70">
                    Standard ~283 days gestation
                  </span>
                ) : (
                  <span className="text-[11px] text-base-content/50 italic">
                    No date recorded
                  </span>
                )}
              </div>

              {/* Other Important Details 3-Column Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="bg-base-200/40 border border-base-200 rounded-xl p-2.5">
                  <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-0.5">
                    Insemination Date
                  </span>
                  <span className="text-xs font-bold text-base-content">
                    {formatDate(inseminationDate)}
                  </span>
                </div>

                <div className="bg-base-200/40 border border-base-200 rounded-xl p-2.5">
                  <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-0.5">
                    Sire / Semen Straw
                  </span>
                  <span className="text-xs font-bold text-base-content truncate block">
                    {sireDisplay}
                  </span>
                </div>

                <div className="bg-base-200/40 border border-base-200 rounded-xl p-2.5">
                  <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-0.5">
                    PD Confirmation
                  </span>
                  <span className="text-xs font-bold text-base-content">
                    {formatDate(pdConfirmationDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Standalone selectors (only when pregnancyData is not pre-provided) */}
            {!pregnancyData && (
              <div className="bg-base-200/30 border border-base-300 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Farmer Search */}
                <div className="space-y-1 relative">
                  <label className={labelClass}>Farmer Owner</label>
                  {preSelectedFarmer ? (
                    <div className="flex items-center gap-3 h-10 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content/65 select-none">
                      <span className="truncate">{preSelectedFarmer.name}</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/30"
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
                        onBlur={() =>
                          setTimeout(() => setIsDropdownOpen(false), 200)
                        }
                        placeholder="Type farmer name..."
                        className={`${inputClass} pl-10`}
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
                            {isLoadingFarmers ? (
                              <div
                                className="space-y-2 p-3"
                                role="status"
                                aria-label="Loading farmers"
                              >
                                <div className="skeleton h-10 w-full" />
                                <div className="skeleton h-10 w-full" />
                              </div>
                            ) : isFarmersError ? (
                              <div
                                className="alert alert-error m-2 w-auto text-sm"
                                role="alert"
                              >
                                <span>
                                  {farmersError?.response?.data?.message ||
                                    "Unable to load farmers."}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onMouseDown={(event) =>
                                    event.preventDefault()
                                  }
                                  onClick={() => refetchFarmers()}
                                >
                                  Try again
                                </button>
                              </div>
                            ) : farmers.filter(
                                (f) =>
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
                                .filter(
                                  (f) =>
                                    (f.name || "")
                                      .toLowerCase()
                                      .includes(
                                        searchFarmer.toLowerCase(),
                                      ) ||
                                    (f.phoneNumber || "")
                                      .toLowerCase()
                                      .includes(
                                        searchFarmer.toLowerCase(),
                                      ) ||
                                    (typeof f.address === "string"
                                      ? f.address
                                      : f.address?.barangay || ""
                                    )
                                      .toLowerCase()
                                      .includes(
                                        searchFarmer.toLowerCase(),
                                      ),
                                )
                                .map((farmer) => (
                                  <button
                                    key={farmer._id}
                                    type="button"
                                    role="option"
                                    aria-selected={
                                      selectedFarmerId === farmer._id
                                    }
                                    onClick={() => {
                                      setSelectedFarmerId(farmer._id);
                                      setSelectedAnimalId("");
                                      setSearchFarmer(farmer.name);
                                      setIsDropdownOpen(false);
                                    }}
                                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left hover:bg-base-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary cursor-pointer"
                                  >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                      {(farmer.name || "Farmer")
                                        .substring(0, 2)
                                        .toUpperCase()}
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate text-sm font-bold text-base-content">
                                        {farmer.name}
                                      </span>
                                      <span className="block text-xs font-medium text-base-content/60">
                                        {farmer.phoneNumber || "No Contact"} •{" "}
                                        {typeof farmer.address === "string"
                                          ? toTitleCase(farmer.address)
                                          : farmer.address?.barangay
                                            ? toTitleCase(
                                                farmer.address.barangay,
                                              )
                                            : "No Barangay"}
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

                {/* Animal selector */}
                <div className="space-y-1">
                  <label className={labelClass}>Pregnant Cow</label>
                  {preSelectedAnimal ? (
                    <div className="flex items-center gap-3 h-10 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content/65 select-none">
                      <span className="truncate">
                        Tag #{preSelectedAnimal.earTag} (
                        {preSelectedAnimal.breed || "Crossbreed"})
                      </span>
                    </div>
                  ) : (
                    <select
                      disabled={
                        !selectedFarmerId ||
                        isLoadingAnimals ||
                        isAnimalsError
                      }
                      value={selectedAnimalId}
                      onChange={(e) => setSelectedAnimalId(e.target.value)}
                      className={`${selectClass} disabled:opacity-50`}
                    >
                      <option value="">
                        {isLoadingAnimals
                          ? "Synchronizing..."
                          : "Select pregnant cow..."}
                      </option>
                      {pregnantAnimals.map((a) => (
                        <option key={a._id} value={a._id}>
                          Tag #{a.earTag} ({a.breed}) -{" "}
                          {a.reproductiveStatus || "Normal"}
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedFarmerId && isAnimalsError && (
                    <div className="alert alert-error text-sm" role="alert">
                      <span>
                        {animalsError?.response?.data?.message ||
                          "Unable to load this farmer's animals."}
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
                  {selectedFarmerId &&
                    !isLoadingAnimals &&
                    !isAnimalsError &&
                    pregnantAnimals.length === 0 && (
                      <p className="text-xs text-base-content/60">
                        No pregnant cows are available for this farmer.
                      </p>
                    )}
                </div>

                {/* Insemination/pregnancy check info */}
                {selectedAnimalId && (
                  <div className="col-span-2">
                    {isLoadingHistory ? (
                      <div
                        className="skeleton h-14 w-full rounded-xl"
                        role="status"
                        aria-label="Loading pregnancy references"
                      />
                    ) : isHistoryError ? (
                      <div
                        className="alert alert-error text-xs rounded-xl"
                        role="alert"
                      >
                        <span>
                          {historyError?.response?.data?.message ||
                            "Unable to load pregnancy records."}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => refetchHistory()}
                        >
                          Try again
                        </button>
                      </div>
                    ) : activePregnancy ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
                        <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <h5 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">
                            Active Pregnancy Connected
                          </h5>
                          <p className="text-[10px] font-semibold text-base-content/70 uppercase mt-1 leading-tight">
                            Diagnosis Date:{" "}
                            {formatDate(
                              activePregnancy.pregnancyDiagnosis?.date ||
                                activePregnancy.createdAt,
                            )}{" "}
                            • Expected calving:{" "}
                            {formatDate(activePregnancy.targetCalvingDate)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-3">
                        <AlertCircle
                          size={16}
                          className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                        />
                        <div>
                          <h5 className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest leading-none">
                            No active pregnancy found
                          </h5>
                          <p className="text-[10px] font-semibold text-base-content/60 uppercase mt-1 leading-tight">
                            A calving record requires a confirmed pregnancy
                            check record for this animal.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Calving Delivery Details Form */}
            {(pregnancyData || activePregnancy) && (
              <>
                <div className="border border-base-300 rounded-2xl p-4 space-y-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                    Calving Delivery Details
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Calving Date */}
                    <div>
                      <label className={labelClass}>Calving Date</label>
                      <div className="relative">
                        <Calendar
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40"
                          size={16}
                        />
                        <input
                          type="date"
                          max={getManilaDateKey()}
                          value={formData.date}
                          onChange={(e) =>
                            setFormData({ ...formData, date: e.target.value })
                          }
                          className={`${inputClass} pl-10 cursor-pointer`}
                        />
                      </div>
                    </div>

                    {/* Outcome */}
                    <div>
                      <label
                        htmlFor="record-calving-outcome"
                        className={labelClass}
                      >
                        Outcome
                      </label>
                      <select
                        id="record-calving-outcome"
                        value={formData.outcome}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            outcome: e.target.value,
                          })
                        }
                        className={selectClass}
                      >
                        <option value="live_birth">Live Birth</option>
                        <option value="mixed">Mixed Vitality</option>
                        <option value="stillbirth">Stillbirth</option>
                        <option value="abortion">
                          Abortion (Pregnancy Loss)
                        </option>
                      </select>
                    </div>

                    {/* Delivery Ease (hidden when abortion) */}
                    {formData.outcome !== "abortion" && (
                      <div>
                        <label
                          htmlFor="record-calving-ease"
                          className={labelClass}
                        >
                          Delivery Method / Ease
                        </label>
                        <select
                          id="record-calving-ease"
                          value={formData.calvingEase}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              calvingEase: e.target.value,
                            })
                          }
                          className={selectClass}
                        >
                          <option value="Natural">Natural</option>
                          <option value="Normal">Normal</option>
                          <option value="Difficult">Difficult</option>
                          <option value="Cesarean">Cesarean</option>
                        </select>
                      </div>
                    )}

                    {/* Number of Calves */}
                    {formData.outcome !== "abortion" && (
                      <div>
                        <label className={labelClass}>Number of Calves</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={formData.numberOfCalves}
                            onChange={(e) =>
                              handleNumCalvesChange(e.target.value)
                            }
                            className={inputClass}
                          />
                          <span className="text-xs font-bold text-base-content/60 uppercase">
                            Head
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Offspring Details Section or Abortion Notice */}
                {formData.outcome === "abortion" ? (
                  <div className="alert alert-error/15 border-error/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4">
                    <AlertCircle
                      size={18}
                      className="text-error shrink-0 mt-0.5"
                    />
                    <div>
                      <h4 className="font-bold text-xs text-error">
                        Pregnancy Loss / Abortion
                      </h4>
                      <p className="text-xs font-medium text-base-content/75 mt-0.5 leading-relaxed">
                        An abortion will be recorded for this pregnancy. The
                        mother's reproductive cycle will be reset to
                        post-pregnancy recovery. No calf records will be
                        generated.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="border border-base-300 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
                        Calf Offspring Registration ({formData.calves.length})
                      </span>
                      <span className="text-[11px] font-semibold text-base-content/60 flex items-center gap-1">
                        <Baby className="h-3.5 w-3.5 text-primary" />
                        Registered to Mother #{motherEarTag}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {formData.calves.map((calf, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-base-200/40 border border-base-300 rounded-2xl p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between border-b border-base-200/80 pb-2.5">
                            <h4 className="font-bold text-xs text-base-content flex items-center gap-1.5">
                              <Baby size={14} className="text-primary" />
                              Calf {index + 1}
                            </h4>
                            {formData.outcome === "mixed" && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-base-content/70">
                                  Living
                                </span>
                                <input
                                  type="checkbox"
                                  className="toggle toggle-sm toggle-success"
                                  checked={calf.isLiving}
                                  onChange={(e) =>
                                    updateCalf(
                                      index,
                                      "isLiving",
                                      e.target.checked,
                                    )
                                  }
                                />
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Sex */}
                            <div>
                              <label className={labelClass}>Sex</label>
                              <div className="flex bg-base-100 rounded-xl p-1 border border-base-300 h-10">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCalf(index, "sex", "F")
                                  }
                                  className={`flex-1 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                    calf.sex === "F"
                                      ? "bg-primary text-primary-content shadow-sm"
                                      : "text-base-content/60 hover:text-base-content"
                                  }`}
                                >
                                  Female
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCalf(index, "sex", "M")
                                  }
                                  className={`flex-1 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                    calf.sex === "M"
                                      ? "bg-primary text-primary-content shadow-sm"
                                      : "text-base-content/60 hover:text-base-content"
                                  }`}
                                >
                                  Male
                                </button>
                              </div>
                            </div>

                            {/* Calf Ear Tag */}
                            <div>
                              <label className={labelClass}>
                                Calf ID / Ear Tag
                              </label>
                              <div className="flex w-full">
                                <input
                                  type="text"
                                  value={calf.earTag}
                                  onChange={(e) =>
                                    updateCalf(
                                      index,
                                      "earTag",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="e.g. 104"
                                  className={`${inputClass} rounded-r-none uppercase`}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAutoGenerateTag(index)
                                  }
                                  className="btn btn-sm h-10 bg-base-100 border-base-300 border-l-0 rounded-l-none hover:bg-primary/10 hover:border-primary/30 hover:text-primary text-base-content/70 shrink-0 text-xs font-semibold transition-colors"
                                >
                                  Auto Generate
                                </button>
                              </div>
                            </div>

                            {/* Color */}
                            <div>
                              <label className={labelClass}>Color</label>
                              <input
                                type="text"
                                value={calf.color || ""}
                                onChange={(e) =>
                                  updateCalf(index, "color", e.target.value)
                                }
                                placeholder="e.g. Red, Black"
                                className={inputClass}
                              />
                            </div>

                            {/* Brand */}
                            <div>
                              <label className={labelClass}>
                                Brand Mark (Optional)
                              </label>
                              <input
                                type="text"
                                value={calf.brand || ""}
                                onChange={(e) =>
                                  updateCalf(index, "brand", e.target.value)
                                }
                                placeholder="e.g. Left Hip"
                                className={inputClass}
                              />
                            </div>
                          </div>

                          {/* Photo */}
                          {calf.isLiving && (
                            <div className="pt-1">
                              <label className={labelClass}>
                                Calf Photo (Optional)
                              </label>
                              {calf.imageUrl ? (
                                <div className="relative w-full sm:w-56 h-28 rounded-xl overflow-hidden border border-base-300">
                                  <img
                                    src={calf.imageUrl}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCalf(index, "imageUrl", "")
                                    }
                                    className="absolute inset-0 bg-base-content/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                                  >
                                    <X size={20} className="text-base-100" />
                                  </button>
                                </div>
                              ) : (
                                <label className="flex flex-col items-center justify-center w-full sm:w-56 h-24 border-2 border-dashed border-base-300 rounded-xl cursor-pointer bg-base-100 hover:bg-base-200/50 transition-colors">
                                  <div className="flex flex-col items-center justify-center text-base-content/50">
                                    <ImagePlus
                                      size={18}
                                      className="mb-1 text-primary/70"
                                    />
                                    <p className="text-[11px] font-semibold">
                                      Click to upload photo
                                    </p>
                                  </div>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) =>
                                      handleImageUpload(index, e)
                                    }
                                  />
                                </label>
                              )}
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Technical Observations Section */}
                <div className="border border-base-300 rounded-2xl p-4 space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                    Technical Observations & Notes
                  </span>
                  <textarea
                    placeholder="Describe any complications, vaccinations given at birth, or specific observations..."
                    value={formData.technicianNote}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        technicianNote: e.target.value,
                      })
                    }
                    className="textarea textarea-bordered w-full text-xs font-medium placeholder:text-base-content/40 focus:outline-primary rounded-xl min-h-[75px] bg-base-100"
                  />
                </div>
              </>
            )}

            {/* Mixed vitality warning */}
            {formData.outcome === "mixed" && isMixedInvalid && (
              <div className="alert alert-warning/15 border-warning/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-2.5 px-4">
                <AlertCircle
                  size={16}
                  className="shrink-0 text-warning mt-0.5"
                />
                <span className="font-semibold text-xs text-warning">
                  Mixed delivery must include at least one living and one
                  stillborn calf.
                </span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-5 md:px-6 py-4 border-t border-base-300 bg-base-200/40 flex items-center justify-end gap-3 sticky bottom-0 z-10">
            <button
              type="button"
              onClick={() => !mutation.isPending && onClose()}
              disabled={mutation.isPending}
              className="btn btn-ghost btn-sm text-base-content/70"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={
                mutation.isPending ||
                (!pregnancyData && !activePregnancy)
              }
              className={`btn btn-primary btn-sm font-semibold gap-1.5 ${
                isMixedInvalid ? "opacity-60" : ""
              }`}
            >
              {mutation.isPending ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                <>
                  <ClipboardCheck size={16} />
                  <span>Save calving record</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
        <button
          type="button"
          className="modal-backdrop"
          onClick={() => !mutation.isPending && onClose()}
          aria-label="Close calving form"
        />
      </div>
    </AnimatePresence>
  );
};

export default RecordCalfDropModal;
