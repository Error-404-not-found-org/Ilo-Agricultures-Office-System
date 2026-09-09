import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  User,
  Syringe,
  Stethoscope,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Tag,
  Heart,
  Search,
  FileText,
  Beef,
  Edit3,
  HeartPulse,
  ClipboardList,
  Info,
  History,
  Activity,
  Eye,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import AIServiceModal from "../../components/dialogs/AIServiceModal";
import PregnancyDiagnosisModal from "../../components/dialogs/PregnancyDiagnosisModal";
import RecordCalfDropModal from "../../components/dialogs/RecordCalvingModal";
import RegisterLivestockModal from "../../components/dialogs/RegisterLivestockModal";
import WalkInHealthModal from "../../components/dialogs/WalkInHealthModal";
import AnimalImageFallback from "../../components/technician/AnimalImageFallback";
import OfficialRecordDetailModal from "../../components/technician/OfficialRecordDetailModal";
import { WEB_ROLES, normalizeWebRole } from "../../constants/webRoles";
import { getAIEligibility } from "../../utils/aiEligibility";
import {
  getAnimalReproductivePresentation,
  hasEligibleBreedingAttemptForPD,
  isPregnancyLossCalving,
} from "../../utils/animalReproductivePresentation";

// ── Helpers ────────────────────────────────────────────────────────────────

function cleanLocationPart(value) {
  const text = String(value || "").trim();
  return ["", "n/a", "na", "unknown", "not provided"].includes(
    text.toLowerCase(),
  )
    ? ""
    : text;
}

function getOwnerLocation(address) {
  const value = Array.isArray(address) ? address[0] || {} : address || {};
  return (
    [
      cleanLocationPart(value.barangay),
      cleanLocationPart(value.city || value.municipality),
    ]
      .filter(Boolean)
      .join(", ") || "Not recorded"
  );
}

function getRecordMeta(kind) {
  switch (kind) {
    case "AI":
      return {
        bg: "bg-info/10 text-info border-info/20",
        icon: <Syringe size={14} />,
        label: "AI Service",
      };
    case "Health":
      return {
        bg: "bg-error/10 text-error border-error/20",
        icon: <Stethoscope size={14} />,
        label: "Health Record",
      };
    case "Pregnancy Check":
      return {
        bg: "bg-success/10 text-success border-success/20",
        icon: <ShieldCheck size={14} />,
        label: "Pregnancy Check",
      };
    case "Calving":
      return {
        bg: "bg-secondary/10 text-secondary border-secondary/20",
        icon: <Heart size={14} />,
        label: "Calving Event",
      };
    default:
      return {
        bg: "bg-base-200 text-base-content/60 border-base-300",
        icon: <FileText size={14} />,
        label: "Record",
      };
  }
}

function fmtDate(d) {
  if (!d) return "Not recorded";
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return "Not recorded";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAge(birthDate) {
  if (!birthDate) return "Not recorded";
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return "Not recorded";
  const now = new Date();
  let diffMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (diffMonths < 0) diffMonths = 0;

  const years = Math.floor(diffMonths / 12);
  const months = diffMonths % 12;

  if (years > 0) {
    return `${years} year${years > 1 ? "s" : ""}${months > 0 ? `, ${months} month${months > 1 ? "s" : ""}` : ""}`;
  } else {
    return `${months} month${months > 1 ? "s" : ""}`;
  }
}

// ── Main component ─────────────────────────────────────────────────────────

export default function LivestockProfile({ role = WEB_ROLES.TECHNICIAN }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = normalizeWebRole(role) === WEB_ROLES.ADMIN;

  // Top level state hooks (all declared before any conditional returns)
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isPDModalOpen, setIsPDModalOpen] = useState(false);
  const [isCalvingModalOpen, setIsCalvingModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [isRegisterLivestockOpen, setIsRegisterLivestockOpen] = useState(false);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [recordSearch, setRecordSearch] = useState("");
  const [recordTypeFilter, setRecordTypeFilter] = useState("All");
  const [selectedOfficialRecord, setSelectedOfficialRecord] = useState(null);
  const [currentTimestamp] = useState(() => Date.now());

  const { data: medicalHistory = [], isLoading: isLoadingMedical } = useQuery({
    queryKey: ["medical", id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/medical/${id}`);
      return res.data || [];
    },
    enabled: !!id,
  });

  const {
    data: animal,
    isLoading: isLoadingAnimal,
    error,
  } = useQuery({
    queryKey: ["animal", id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/animals/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const combinedRecords = useMemo(() => {
    const breeding = (animal?.inseminations || []).map((record) => ({
      ...record,
      recordKind: "AI",
      recordDate:
        record.inseminationDate || record.dateOfAI || record.createdAt,
      recordTitle: `AI Attempt #${record.attemptNumber || 1}`,
      recordSummary:
        [record.sireBreed, record.sireCode].filter(Boolean).join(" · ") ||
        "Artificial insemination service",
      recordStatus: record.status || record.outcome || "Completed",
      recordedBy:
        record.technicianId?.name || record.approvedBy?.name || "Not recorded",
      dateEntered: record.createdAt,
      originId: record._id,
      originLabel: "AI service request",
    }));

    const health = (medicalHistory || []).map((record) => ({
      ...record,
      recordKind: "Health",
      recordDate: record.date || record.createdAt,
      recordTitle: record.type || "Check-up",
      recordSummary:
        record.details?.diagnosis ||
        record.details?.medicineName ||
        record.note ||
        "Routine health service",
      recordStatus: "Completed",
      recordedBy: record.technicianId?.name || "Not recorded",
      isHistoricalEntry: record.isHistoricalEntry,
      dateEntered: record.createdAt,
      originId: record.healthRequestId?._id || record.healthRequestId,
      originLabel: record.healthRequestId ? "Health assistance request" : null,
    }));

    const pdEvents = (animal?.inseminations || [])
      .filter((ins) => ins.pregnancy)
      .map((ins) => {
        const preg = ins.pregnancy;
        return {
          ...preg,
          recordKind: "Pregnancy Check",
          recordDate:
            preg.pregnancyDiagnosis?.date ||
            preg.diagnosisDate ||
            preg.createdAt,
          recordTitle: "Pregnancy Diagnosis",
          recordSummary: `Pregnancy result: ${preg.pregnancyDiagnosis?.result || preg.result || preg.status || "Not recorded"}`,
          recordStatus:
            preg.pregnancyDiagnosis?.result ||
            preg.result ||
            preg.status ||
            "Completed",
          recordedBy:
            preg.diagnosedBy || preg.technicianId?.name || "Not recorded",
          dateEntered: preg.createdAt,
          officialRecordKind: "pregnancy",
          officialRecordId: preg._id || preg.id,
          officialRecordAvailable: Boolean(
            (preg._id || preg.id) &&
            (preg.pregnancyDiagnosis?.date ||
              preg.pregnancyDiagnosis?.result ||
              preg.diagnosisDate ||
              preg.result),
          ),
        };
      });

    const calvingEvents = (animal?.calvings || []).map((calving) => {
      const isLoss = isPregnancyLossCalving(calving);
      return {
        ...calving,
        recordKind: "Calving",
        recordDate: calving.date || calving.createdAt,
        recordTitle: isLoss ? "Pregnancy Loss Record" : "Calving Record",
        recordSummary: isLoss
          ? "Pregnancy loss recorded"
          : `Calving ease: ${calving.calvingEase || "Not recorded"}. Calves: ${calving.calves?.length ?? calving.numberOfCalves ?? "Not recorded"}`,
        recordStatus: "Completed",
        recordedBy:
          calving.recordedBy || calving.technicianId?.name || "Not recorded",
        dateEntered: calving.createdAt,
        officialRecordKind: "calving",
        officialRecordId: calving._id || calving.id,
        officialRecordAvailable: Boolean(calving._id || calving.id),
      };
    });

    return [...breeding, ...health, ...pdEvents, ...calvingEvents].sort(
      (a, b) => new Date(b.recordDate || 0) - new Date(a.recordDate || 0),
    );
  }, [animal?.inseminations, animal?.calvings, medicalHistory]);

  const visibleRecords = useMemo(() => {
    const query = recordSearch.trim().toLowerCase();
    return combinedRecords.filter((record) => {
      const matchesType =
        recordTypeFilter === "All" || record.recordKind === recordTypeFilter;
      const searchable = [
        record.recordTitle,
        record.recordKind,
        record.recordSummary,
        record.recordStatus,
        record.recordedBy,
        record.sireCode,
        record.note,
        record.type,
        record.details?.diagnosis,
        record.details?.medicineName,
        fmtDate(record.recordDate),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesType && (!query || searchable.includes(query));
    });
  }, [combinedRecords, recordSearch, recordTypeFilter]);

  const isLoading = isLoadingAnimal || isLoadingMedical;

  const handleExportCSV = () => {
    if (!animal) return;
    const summaryRows = [
      ["Animal tag", animal.earTag || animal.animalId || "Not recorded"],
      ["Species", animal.species || "Not recorded"],
      ["Breed", animal.breed || "Not recorded"],
      ["Sex", animal.gender || "Not recorded"],
      ["Reproductive status", animal.reproductiveStatus || "Not recorded"],
      ["Owner", animal.farmerId?.name || "Not recorded"],
      ["Owner location", getOwnerLocation(animal.farmerId?.address)],
    ];
    const recordRows = combinedRecords.map((record) => [
      record.recordKind,
      record.recordTitle,
      fmtDate(record.recordDate),
      record.recordStatus,
      record.recordSummary,
      record.recordedBy || "Not recorded",
    ]);
    const csv = [
      ["ANIMAL PROFILE"],
      ...summaryRows,
      [],
      ["RECORD TYPE", "TITLE", "DATE", "STATUS", "SUMMARY", "RECORDED BY"],
      ...recordRows,
    ]
      .map((row) =>
        row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `BreedSmart_Animal_${animal.earTag || animal.animalId || "record"}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen flex-1 bg-base-200 p-4 md:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="skeleton h-14 w-full rounded-xl" />
          <div className="skeleton h-56 w-full rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="skeleton h-28 w-full rounded-3xl" />
            <div className="skeleton h-28 w-full rounded-3xl" />
            <div className="skeleton h-28 w-full rounded-3xl" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="skeleton h-48 w-full rounded-3xl" />
            <div className="skeleton h-48 w-full rounded-3xl" />
          </div>
          <div className="skeleton h-64 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error || !animal) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-base-200 p-6">
        <div role="alert" className="alert alert-error max-w-xl shadow-lg">
          <AlertCircle size={20} />
          <div>
            <div className="font-bold">Animal profile could not be loaded.</div>
            <div className="text-sm">
              {error?.response?.data?.message ||
                error?.message ||
                "The animal may no longer be available."}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["animal", id] })
            }
            className="btn btn-sm"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-sm btn-ghost"
          >
            <ChevronLeft size={14} /> Back
          </button>
        </div>
      </div>
    );
  }

  // ── Derived Data ─────────────────────────────────────────────────────────

  const reproductive = getAnimalReproductivePresentation(animal);
  const aiEligibility = getAIEligibility({ animal });

  const isPostpartum =
    animal?.reproductiveStatus === "Post-partum" ||
    animal?.effectiveReproductiveStatus === "Post-partum" ||
    Boolean(reproductive.postpartum);

  const hasPregnancyDiagnosisCandidate =
    !isPostpartum && hasEligibleBreedingAttemptForPD(animal);

  const activeWithdrawalRecord = (medicalHistory || []).find((record) => {
    if (!record.details?.withdrawalEndDate) return false;
    const endDate = new Date(record.details.withdrawalEndDate);
    return endDate.getTime() > currentTimestamp;
  });

  const daysAgoInsemination = latestInsemination
    ? Math.floor(
        (currentTimestamp - new Date(latestInsemination.inseminationDate).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  const displayedRecords =
    showAllRecords || recordSearch.trim().length > 0
      ? visibleRecords
      : visibleRecords.slice(0, 5);

  return (
    <div className="min-h-screen flex-1 overflow-y-auto bg-base-200 text-base-content font-sans">
      {/* ── Top Header Bar ── */}
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-base-300 bg-base-100/95 px-4 sm:px-8 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-ghost btn-sm btn-square text-base-content/70 hover:text-base-content"
            aria-label="Back to animals list"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-base font-extrabold text-base-content truncate">
              Animal #{animal.earTag || animal.animalId || "Not recorded"}
            </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          className="btn btn-sm btn-ghost hover:bg-base-200 border border-base-300 rounded-xl gap-1.5 font-bold"
        >
          <Download size={14} /> Export
        </button>
      </header>

      {/* ── Main Layout Body ── */}
      <main className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 w-full max-w-7xl mx-auto">
        {/* Critical Alert */}
        {activeWithdrawalRecord && (
          <div
            role="alert"
            className="alert alert-error rounded-2xl shadow-sm items-start"
          >
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                Active Medication Withdrawal Warning
              </h4>
              <p className="mt-1 text-xs leading-relaxed">
                Meat and milk from this animal are unsafe for consumption or
                sale until{" "}
                <span className="font-bold">
                  {fmtDate(activeWithdrawalRecord.details?.withdrawalEndDate)}
                </span>{" "}
                due to recent treatment with{" "}
                <span className="font-bold">
                  {activeWithdrawalRecord.details?.medicineName || "medicine"}
                </span>
                .
              </p>
            </div>
          </div>
        )}

        {/* Animal Identity Header */}
        <section
          aria-labelledby="animal-profile-name"
          className="overflow-hidden rounded-2xl border border-primary bg-primary text-primary-content shadow-sm"
        >
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[11rem_minmax(0,1fr)_auto] lg:items-center">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-primary-content/20 bg-primary-content/10 sm:aspect-[16/9] lg:aspect-square">
              <AnimalImageFallback
                imageUrl={animal.imageUrl || animal.photoUrl}
                tag={animal.earTag || animal.animalId || "Not recorded"}
                className="h-full w-full object-cover"
                iconSize={46}
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="animal-profile-name"
                  className="text-2xl font-black tracking-tight sm:text-3xl"
                >
                  {animal.name ||
                    animal.breed ||
                    animal.earTag ||
                    "Unnamed animal"}
                </h2>
                {animal.isVerified === true && (
                  <span className="badge h-auto border-primary-content/20 bg-primary-content/15 py-1.5 text-primary-content">
                    <CheckCircle2 size={14} />
                    Verified
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-semibold text-primary-content/80 sm:text-base">
                {[animal.species, animal.breed]
                  .filter(Boolean)
                  .filter(
                    (value, index, values) =>
                      values.findIndex(
                        (candidate) =>
                          String(candidate).toLowerCase() ===
                          String(value).toLowerCase(),
                      ) === index,
                  )
                  .join(" · ") || "Species and breed not recorded"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="badge h-auto border-primary-content/25 bg-primary-content/10 px-3 py-2 font-bold text-primary-content">
                  <Tag size={14} />
                  Ear tag: {animal.earTag || "Not recorded"}
                </span>
                <span className="badge h-auto border-primary-content/25 bg-primary-content/10 px-3 py-2 font-bold text-primary-content">
                  {reproductive.statusLabel}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsRegisterLivestockOpen(true)}
              className="btn border-primary-content/25 bg-primary-content/10 text-primary-content hover:border-primary-content/40 hover:bg-primary-content/20"
            >
              <Edit3 size={15} />
              Edit Profile
            </button>
          </div>
        </section>

        {/* Technician Actions - Properly laid out */}
        {!isAdmin && (
          <section
            aria-labelledby="technician-actions-heading"
            className="rounded-2xl border border-base-300 bg-base-100 shadow-sm"
          >
            <div className="border-b border-base-300 px-5 py-4">
              <h2
                id="technician-actions-heading"
                className="font-extrabold text-base"
              >
                Technician Actions
              </h2>
              <p className="mt-1 text-xs leading-5 text-base-content/60">
                Record clinical services for this animal
              </p>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setIsHealthModalOpen(true)}
                className="btn btn-outline border-base-300 h-auto min-h-14 flex-col gap-1"
              >
                <span className="flex items-center gap-2">
                  <Stethoscope size={17} className="text-primary" />
                  <span className="font-bold">Health Record</span>
                </span>
                <span className="text-[10px] font-medium text-base-content/60">
                  Record medical treatment
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (hasPregnancyDiagnosisCandidate) setIsPDModalOpen(true);
                }}
                disabled={!hasPregnancyDiagnosisCandidate}
                aria-describedby={
                  hasPregnancyDiagnosisCandidate ? undefined : "pd-disabled-reason"
                }
                className="btn btn-outline border-base-300 h-auto min-h-14 flex-col gap-1"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck size={17} className="text-primary" />
                  <span className="font-bold">Pregnancy Check</span>
                </span>
                {!hasPregnancyDiagnosisCandidate ? (
                  <span
                    id="pd-disabled-reason"
                    className="block max-w-64 truncate text-[10px] font-medium opacity-70"
                  >
                    No active AI cycle to diagnose
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-base-content/60">
                    Diagnose pregnancy status
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (aiEligibility.isEligible) setIsAIModalOpen(true);
                }}
                disabled={!aiEligibility.isEligible}
                aria-describedby={
                  aiEligibility.isEligible ? undefined : "ai-disabled-reason"
                }
                className="btn btn-primary h-auto min-h-14 flex-col gap-1"
              >
                <span className="flex items-center gap-2">
                  <Syringe size={17} />
                  <span className="font-bold">Record AI Service</span>
                </span>
                {!aiEligibility.isEligible ? (
                  <span
                    id="ai-disabled-reason"
                    className="block max-w-64 truncate text-[10px] font-medium opacity-70"
                  >
                    {aiEligibility.reason}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium opacity-70">
                    Artificial insemination
                  </span>
                )}
              </button>
            </div>
          </section>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-base-300 overflow-x-auto hide-scrollbar bg-base-100 rounded-t-2xl">
          <button
            type="button"
            onClick={() => setActiveTab("Overview")}
            className={`min-h-12 px-6 flex items-center gap-2 border-b-2 transition-colors font-bold whitespace-nowrap ${
              activeTab === "Overview"
                ? "border-primary text-primary"
                : "border-transparent text-base-content/60 hover:text-base-content/80"
            }`}
          >
            <Info size={16} />
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("Timeline")}
            className={`min-h-12 px-6 flex items-center gap-2 border-b-2 transition-colors font-bold whitespace-nowrap ${
              activeTab === "Timeline"
                ? "border-primary text-primary"
                : "border-transparent text-base-content/60 hover:text-base-content/80"
            }`}
          >
            <History size={16} />
            Reproductive Timeline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("Records")}
            className={`min-h-12 px-6 flex items-center gap-2 border-b-2 transition-colors font-bold whitespace-nowrap ${
              activeTab === "Records"
                ? "border-primary text-primary"
                : "border-transparent text-base-content/60 hover:text-base-content/80"
            }`}
          >
            <ClipboardList size={16} />
            Records
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "Overview" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Reproductive Status Summary */}
            <section
              aria-labelledby="reproductive-status-heading"
              className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm"
            >
              <div className="flex flex-col gap-4 border-b border-base-300 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <HeartPulse size={21} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-base-content/55">
                      Reproductive Status
                    </p>
                    <h3
                      id="reproductive-status-heading"
                      className="mt-0.5 text-lg font-extrabold text-primary"
                    >
                      {reproductive.statusLabel}
                    </h3>
                    <p className="mt-1 text-sm text-base-content/65">
                      {reproductive.context}
                    </p>
                  </div>
                </div>
                {reproductive.currentAttemptNumber && (
                  <span className="badge badge-outline h-auto py-2">
                    Current cycle · Attempt {reproductive.currentAttemptNumber}
                  </span>
                )}
              </div>
              <dl className="grid sm:grid-cols-3">
                <div className="p-4 sm:border-r sm:border-base-300">
                  <dt className="text-xs font-semibold text-base-content/55">
                    Last AI
                  </dt>
                  <dd className="mt-1 text-sm font-bold">
                    {fmtDate(
                      reproductive.currentAttemptDate ||
                        animal.lastInseminationDate,
                    )}
                  </dd>
                </div>
                <div className="border-t border-base-300 p-4 sm:border-r sm:border-t-0">
                  <dt className="text-xs font-semibold text-base-content/55">
                    Next follow-up
                  </dt>
                  <dd className="mt-1 text-sm font-bold">
                    {reproductive.nextFollowUp?.label || "Not scheduled"}
                  </dd>
                  {reproductive.nextFollowUp?.date && (
                    <p className="mt-0.5 text-xs text-base-content/60">
                      {fmtDate(reproductive.nextFollowUp.date)}
                    </p>
                  )}
                </div>
                <div className="border-t border-base-300 p-4 sm:border-t-0">
                  <dt className="text-xs font-semibold text-base-content/55">
                    Expected calving
                  </dt>
                  <dd className="mt-1 text-sm font-bold">
                    {fmtDate(reproductive.expectedCalvingDate)}
                  </dd>
                  {!reproductive.pregnancyConfirmed && (
                    <p className="mt-0.5 text-xs text-base-content/60">
                      Shown only after confirmed pregnancy
                    </p>
                  )}
                </div>
              </dl>
            </section>

            {/* Combined Animal Information and Ownership */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Animal Information */}
              <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden">
                <div className="border-b border-base-300 px-6 py-4">
                  <h2 className="flex items-center gap-2 font-extrabold text-base text-primary">
                    <Beef size={18} />
                    Animal Information
                  </h2>
                </div>
                <div className="p-6 space-y-3.5 text-sm">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-base-content/60 font-medium">
                      Gender
                    </span>
                    <span className="font-bold text-base-content">
                      {animal.gender || animal.sex || "Not recorded"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-base-200">
                    <span className="text-base-content/60 font-medium">
                      Age
                    </span>
                    <span className="font-bold text-base-content">
                      {formatAge(animal.birthDate || animal.dateOfBirth)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-base-200">
                    <span className="text-base-content/60 font-medium">
                      Date of Birth
                    </span>
                    <span className="font-bold text-base-content">
                      {fmtDate(animal.dateOfBirth || animal.birthDate)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-base-200">
                    <span className="text-base-content/60 font-medium">
                      Color / Markings
                    </span>
                    <span className="font-bold text-base-content">
                      {animal.colorMarkings || animal.color || "Not recorded"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-base-200">
                    <span className="text-base-content/60 font-medium">
                      Weight
                    </span>
                    <span className="font-bold text-base-content">
                      {animal.weight ? `${animal.weight} kg` : "Not recorded"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-base-200">
                    <span className="text-base-content/60 font-medium">
                      Milk Production
                    </span>
                    <span className="font-bold text-base-content">
                      {animal.milkProduction
                        ? `${animal.milkProduction} L / day`
                        : "Not recorded"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ownership Information */}
              <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden">
                <div className="border-b border-base-300 px-6 py-4">
                  <h2 className="flex items-center gap-2 font-extrabold text-base text-primary">
                    <UserRound size={18} />
                    Ownership Information
                  </h2>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="avatar placeholder">
                      <div className="size-12 rounded-full bg-primary/10 text-primary">
                        {animal.farmerId?.imageUrl ||
                        animal.farmerId?.avatarUrl ||
                        animal.farmerId?.avatar ? (
                          <img
                            src={
                              animal.farmerId.imageUrl ||
                              animal.farmerId.avatarUrl ||
                              animal.farmerId.avatar
                            }
                            alt=""
                          />
                        ) : (
                          <span className="text-sm font-extrabold">
                            {getInitials(animal.farmerId?.name)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-base-content/55">
                        Registered Farmer
                      </p>
                      <h3 className="truncate text-base font-extrabold">
                        {animal.farmerId?.name || "Not recorded"}
                      </h3>
                    </div>
                  </div>

                  <dl className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <Phone
                        size={16}
                        className="mt-0.5 shrink-0 text-primary"
                      />
                      <div>
                        <dt className="sr-only">Contact number</dt>
                        <dd className="font-semibold">
                          {animal.farmerId?.phoneNumber ||
                            animal.farmerId?.phone ||
                            "Not recorded"}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin
                        size={16}
                        className="mt-0.5 shrink-0 text-primary"
                      />
                      <div>
                        <dt className="sr-only">Address</dt>
                        <dd className="font-semibold leading-snug text-base-content/75">
                          {getOwnerLocation(animal.farmerId?.address)}
                        </dd>
                      </div>
                    </div>
                  </dl>

                  {(animal.farmerId?._id || animal.farmerId?.id) && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          isAdmin
                            ? `/admin/users/${
                                animal.farmerId._id || animal.farmerId.id
                              }`
                            : `/technician/farmers/${
                                animal.farmerId._id || animal.farmerId.id
                              }`,
                        )
                      }
                      className="btn btn-outline btn-sm w-full border-base-300"
                    >
                      <UserRound size={15} className="text-primary" />
                      View farmer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Timeline" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-base-300 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Heart size={19} />
                  </span>
                  <div>
                    <h2 className="font-extrabold text-base-content">
                      Reproductive Timeline
                    </h2>
                    <p className="mt-1 text-sm text-base-content/65">
                      Milestones from the live breeding cycle, readiness,
                      follow-up task, and pregnancy record.
                    </p>
                  </div>
                </div>
                {reproductive.nextFollowUp?.status && (
                  <span className="badge badge-outline">
                    {reproductive.nextFollowUp.status}
                  </span>
                )}
              </div>

              {reproductive.timeline.length ? (
                <ol className="p-5 sm:p-6">
                  {reproductive.timeline.map((milestone, index) => (
                    <li
                      key={milestone.key}
                      className={
                        "relative flex gap-3 pb-6 last:pb-0 " +
                        (milestone.state === "skipped" ? "opacity-55" : "")
                      }
                    >
                      {index < reproductive.timeline.length - 1 && (
                        <span className="absolute bottom-0 left-[11px] top-6 w-px bg-base-300" />
                      )}
                      <span className="relative z-10 shrink-0">
                        <TimelineMarker state={milestone.state} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p
                              className={
                                "text-sm font-bold " +
                                (milestone.state === "current"
                                  ? "text-primary"
                                  : milestone.state === "failed"
                                    ? "text-error"
                                    : "text-base-content")
                              }
                            >
                              {milestone.label}
                            </p>
                            {milestone.startDate && (
                              <p className="text-xs text-base-content/60">
                                Recovery started {fmtDate(milestone.startDate)}
                              </p>
                            )}
                          </div>
                          {milestone.eligibleDate ? (
                            <div className="text-left sm:text-right">
                              <span className="block text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
                                Eligible for AI after
                              </span>
                              <time className="text-xs font-semibold text-base-content/70">
                                {fmtDate(milestone.eligibleDate)}
                              </time>
                            </div>
                          ) : milestone.date ? (
                            <time className="text-xs font-semibold text-base-content/55">
                              {fmtDate(milestone.date)}
                            </time>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-base-content/65">
                          {milestone.detail}
                        </p>
                        {milestone.state === "current" && (
                          <span className="badge badge-primary badge-sm mt-2">
                            {milestone.stageLabel || "Current stage"}
                          </span>
                        )}
                        {milestone.state === "skipped" && (
                          <span className="badge badge-ghost badge-sm mt-2">
                            Not required
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="p-6">
                  <div className="rounded-xl bg-base-200 p-4">
                    <p className="text-sm font-semibold">
                      No active reproductive timeline
                    </p>
                    <p className="mt-1 text-xs leading-5 text-base-content/60">
                      A timeline appears after an AI service or confirmed
                      reproductive event is recorded.
                    </p>
                  </div>
                  {reproductive.latestHistoricalDate && (
                    <p className="mt-4 text-xs text-base-content/60">
                      Most recent historical AI:{" "}
                      <strong>
                        {fmtDate(reproductive.latestHistoricalDate)}
                      </strong>
                      {reproductive.historyOnlyLatest ? " · History only" : ""}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Health Timeline */}
            <section className="overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-sm mt-6">
              <div className="flex items-start gap-3 border-b border-base-300 p-5 sm:p-6">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-error/10 text-error">
                  <Activity size={19} />
                </div>
                <div>
                  <h2 className="font-extrabold text-base-content">
                    Health Timeline
                  </h2>
                  <p className="mt-1 text-sm text-base-content/65">
                    Medical records and health interventions.
                  </p>
                </div>
              </div>

              {medicalHistory.length === 0 ? (
                <p className="p-6 text-sm text-base-content/65">
                  No health history recorded.
                </p>
              ) : (
                <ol className="divide-y divide-base-300">
                  {medicalHistory
                    .sort(
                      (a, b) =>
                        new Date(b.date || b.createdAt) -
                        new Date(a.date || a.createdAt),
                    )
                    .map((event) => (
                      <li
                        key={event._id}
                        className="grid gap-3 p-5 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-center sm:px-6"
                      >
                        <p className="text-sm font-bold text-base-content">
                          {fmtDate(event.date || event.createdAt)}
                        </p>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-extrabold text-base-content">
                              {event.type || "Check-up"}
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-base-content/65">
                            {event.details?.diagnosis ||
                              event.note ||
                              "Routine record"}
                          </p>
                        </div>
                        <p className="text-xs font-semibold text-base-content/60 sm:text-right">
                          {event.technicianId?.name
                            ? `By ${event.technicianId.name}`
                            : "By unknown"}
                        </p>
                      </li>
                    ))}
                </ol>
              )}
            </section>
          </div>
        )}

        {activeTab === "Records" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Records Table */}
            <div className="bg-base-100 rounded-3xl border border-base-300 p-6 shadow-sm space-y-4">
              <div className="flex flex-col gap-4 border-b border-base-300 pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div
                  role="tablist"
                  aria-label="Livestock profile sections"
                  className="tabs tabs-border"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected="true"
                    className="tab tab-active gap-2 font-extrabold text-primary"
                  >
                    <ClipboardList size={18} />
                    Animal Records
                  </button>
                </div>

                {/* Filters */}
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[minmax(16rem,1fr)_minmax(12rem,auto)] lg:max-w-2xl">
                  <div className="relative min-w-0">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50 z-10"
                    />
                    <input
                      type="search"
                      aria-label="Search animal records"
                      placeholder="Search by type, details, Technician, or date..."
                      value={recordSearch}
                      onChange={(e) => setRecordSearch(e.target.value)}
                      className="input input-sm w-full pl-9"
                    />
                  </div>

                  <select
                    aria-label="Filter animal records by type"
                    value={recordTypeFilter}
                    onChange={(e) => setRecordTypeFilter(e.target.value)}
                    className="select select-sm w-full font-semibold sm:min-w-52"
                  >
                    <option value="All">All record types</option>
                    <option value="AI">AI records</option>
                    <option value="Health">Health records</option>
                    <option value="Pregnancy Check">Pregnancy checks</option>
                    <option value="Calving">Calving events</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                {displayedRecords.length === 0 ? (
                  <div className="py-12 text-center text-base-content/50 space-y-2">
                    <FileText
                      size={36}
                      className="mx-auto text-base-content/30"
                    />
                    <p className="text-sm font-semibold">
                      No records match your search.
                    </p>
                  </div>
                ) : (
                  <table className="table table-zebra w-full text-left">
                    <thead>
                      <tr className="border-b border-base-200 text-xs text-base-content/60 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Record Type</th>
                        <th className="py-3 px-4">Details</th>
                        <th className="py-3 px-4">Technician</th>
                        <th className="py-3 px-4 text-right">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {displayedRecords.map((record, index) => {
                        const meta = getRecordMeta(record.recordKind);
                        return (
                          <tr
                            key={record._id || record.id || index}
                            className="hover:bg-base-200/50 transition-colors"
                          >
                            <td className="py-3.5 px-4 font-bold text-base-content/90 whitespace-nowrap">
                              {fmtDate(record.recordDate)}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${meta.bg}`}
                              >
                                {meta.icon}
                                {record.recordTitle}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 max-w-xs truncate text-base-content/80 font-medium">
                              {record.recordSummary || "Routine record entry"}
                            </td>

                            <td className="py-3.5 px-4 font-semibold text-base-content/80 whitespace-nowrap">
                              {record.recordedBy || "Not recorded"}
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <span className="badge badge-outline badge-sm">
                                {record.recordStatus || "Not recorded"}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              {record.officialRecordAvailable ? (
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() =>
                                    setSelectedOfficialRecord({
                                      animalId: animal._id || animal.id || id,
                                      recordKind: record.officialRecordKind,
                                      recordId: record.officialRecordId,
                                    })
                                  }
                                >
                                  <Eye size={15} aria-hidden="true" />
                                  View details
                                </button>
                              ) : (
                                <span className="text-xs font-medium text-base-content/55">
                                  Available after completion
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {visibleRecords.length > 5 && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAllRecords(!showAllRecords)}
                    className="btn btn-ghost btn-sm text-primary font-bold hover:bg-primary/10 rounded-xl"
                  >
                    {showAllRecords
                      ? "Show recent records only"
                      : "View all records"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <RegisterLivestockModal
        isOpen={isRegisterLivestockOpen}
        livestock={animal}
        onClose={() => setIsRegisterLivestockOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["animal", id] });
        }}
      />

      <ActivityDetailsModal
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        activity={selectedActivity}
        onOpenSource={(activity) => {
          if (!activity?.originId) return;
          const requestPath = isAdmin
            ? "/admin/requests"
            : "/technician/requests";
          const status = isAdmin ? "all" : "completed";
          navigate(
            `${requestPath}?requestId=${encodeURIComponent(activity.originId)}&status=${status}`,
          );
        }}
      />

      {!isAdmin && (
        <>
          <AddMedicalRecordModal
        key={medicalInitialType}
        isOpen={isAddMedicalModalOpen}
        onClose={() => setIsAddMedicalModalOpen(false)}
        animalId={id}
        animalTag={animal.earTag}
        initialType={medicalInitialType}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["animal", id] });
          queryClient.invalidateQueries({ queryKey: ["medical", id] });
        }}
      />

      <AIServiceModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        preSelectedFarmer={animal?.farmerId}
        preSelectedAnimal={animal}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["animal", id] });
          queryClient.invalidateQueries({ queryKey: ["medical", id] });
        }}
      />

      <PregnancyDiagnosisModal
        isOpen={isPDModalOpen}
        onClose={() => setIsPDModalOpen(false)}
        preSelectedFarmer={animal?.farmerId}
        preSelectedAnimal={animal}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["animal", id] });
          queryClient.invalidateQueries({ queryKey: ["medical", id] });
        }}
      />

      <RecordCalfDropModal
        isOpen={isCalvingModalOpen}
        onClose={() => setIsCalvingModalOpen(false)}
        preSelectedFarmer={animal?.farmerId}
        preSelectedAnimal={animal}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["animal", id] });
          queryClient.invalidateQueries({ queryKey: ["medical", id] });
        }}
      />
        </>
      )}
    </div>
  );
}
