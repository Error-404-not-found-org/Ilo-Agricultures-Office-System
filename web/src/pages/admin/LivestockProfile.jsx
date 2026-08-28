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
  Calendar,
  Search,
  PlusCircle,
  FileText,
  Beef,
  Dna,
  Edit3,
  HeartPulse,
  Baby,
  ClipboardList,
  Eye,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import AddMedicalRecordModal from "../../components/dialogs/AddMedicalRecordModal";
import ActivityDetailsModal from "../../components/dialogs/ActivityDetailsModal";
import AIServiceModal from "../../components/dialogs/AIServiceModal";
import PregnancyDiagnosisModal from "../../components/dialogs/PregnancyDiagnosisModal";
import RecordCalfDropModal from "../../components/dialogs/RecordCalvingModal";
import RegisterLivestockModal from "../../components/dialogs/RegisterLivestockModal";
import AnimalImageFallback from "../../components/technician/AnimalImageFallback";
import { WEB_ROLES, normalizeWebRole } from "../../constants/webRoles";

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
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [isAddMedicalModalOpen, setIsAddMedicalModalOpen] = useState(false);
  const [medicalInitialType] = useState("Vaccination");
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isPDModalOpen, setIsPDModalOpen] = useState(false);
  const [isCalvingModalOpen, setIsCalvingModalOpen] = useState(false);
  const [isRegisterLivestockOpen, setIsRegisterLivestockOpen] = useState(false);
  const [isAddRecordMenuOpen, setIsAddRecordMenuOpen] = useState(false);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [recordSearch, setRecordSearch] = useState("");
  const [recordTypeFilter, setRecordTypeFilter] = useState("All");
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
          recordedBy: preg.diagnosedBy || preg.technicianId?.name || "Not recorded",
          dateEntered: preg.createdAt,
        };
      });

    const calvingEvents = (animal?.calvings || []).map((calving) => ({
      ...calving,
      recordKind: "Calving",
      recordDate: calving.date || calving.createdAt,
      recordTitle: "Calving Record",
      recordSummary: `Calving ease: ${calving.calvingEase || "Not recorded"}. Calves: ${calving.calves?.length ?? calving.numberOfCalves ?? "Not recorded"}`,
      recordStatus: "Completed",
      recordedBy:
        calving.recordedBy || calving.technicianId?.name || "Not recorded",
      dateEntered: calving.createdAt,
    }));

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

  const latestInsemination =
    animal.inseminations
      ?.slice()
      .sort(
        (a, b) => new Date(b.inseminationDate) - new Date(a.inseminationDate),
      )[0] || null;

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
      <main className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 w-full">
        {/* Medication Withdrawal Warning Alert if active */}
        {activeWithdrawalRecord && (
          <div role="alert" className="alert alert-error rounded-2xl shadow-sm items-start">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                Active Medication Withdrawal Warning
              </h4>
              <p className="mt-1 text-xs leading-relaxed">
                Meat and milk from this animal are unsafe for consumption or sale until{" "}
                <span className="font-bold">
                  {fmtDate(activeWithdrawalRecord.details?.withdrawalEndDate)}
                </span>{" "}
                due to recent treatment with{" "}
                <span className="font-bold">
                  {activeWithdrawalRecord.details?.medicineName || "medicine"}
                </span>.
              </p>
            </div>
          </div>
        )}

        {/* ── SECTION 1: ProfileHeader ── */}
        <div className="bg-base-100 rounded-3xl border border-base-300 p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center gap-6">
          {/* AnimalImage */}
          <div className="w-full lg:w-72 h-52 lg:h-48 rounded-2xl overflow-hidden shrink-0 bg-base-200 relative border border-base-300">
            <AnimalImageFallback
              imageUrl={animal.imageUrl || animal.photoUrl}
              tag={animal.earTag || animal.animalId || "Not recorded"}
              className="w-full h-full object-cover"
              iconSize={48}
            />
          </div>

          {/* AnimalInfo & StatusBadge */}
          <div className="flex-1 min-w-0 space-y-4 w-full">
            {/* Title + StatusBadge */}
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-black text-base-content tracking-tight">
                {animal.name || animal.earTag || "Unnamed animal"}
              </h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-success/20 bg-success/15 text-xs font-extrabold text-success">
                <CheckCircle2 size={14} />
                {animal.reproductiveStatus || "Not recorded"}
              </span>
            </div>

            {/* Metadata Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 pt-1">
              {/* Ear Tag */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-success/10 text-success shrink-0">
                  <Tag size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-base-content/60 font-medium">Ear Tag</p>
                  <p className="text-sm font-bold text-base-content truncate">
                    {animal.earTag || animal.animalId || "Not recorded"}
                  </p>
                </div>
              </div>

              {/* Age */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-success/10 text-success shrink-0">
                  <Calendar size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-base-content/60 font-medium">Age</p>
                  <p className="text-sm font-bold text-base-content truncate">
                    {formatAge(animal.dateOfBirth || animal.birthDate)}
                  </p>
                </div>
              </div>

              {/* Species */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-success/10 text-success shrink-0">
                  <Beef size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-base-content/60 font-medium">Species</p>
                  <p className="text-sm font-bold text-base-content truncate">
                    {animal.species || "Not recorded"}
                  </p>
                </div>
              </div>

              {/* Owner */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-success/10 text-success shrink-0">
                  <User size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-base-content/60 font-medium">Owner</p>
                  <p className="text-sm font-bold text-base-content truncate">
                    {animal.farmerId?.name || "Not recorded"}
                  </p>
                </div>
              </div>

              {/* Breed */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-success/10 text-success shrink-0">
                  <Dna size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-base-content/60 font-medium">Breed</p>
                  <p className="text-sm font-bold text-base-content truncate">
                    {animal.breed || "Not recorded"}
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-success/10 text-success shrink-0">
                  <MapPin size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-base-content/60 font-medium">Location</p>
                  <p className="text-sm font-bold text-base-content truncate">
                    {getOwnerLocation(animal.farmerId?.address)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ActionButtons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 justify-center w-full lg:w-48 lg:ml-auto">
            {/* Edit Profile */}
            <button
              type="button"
              onClick={() => setIsRegisterLivestockOpen(true)}
              className="btn btn-primary font-bold rounded-xl gap-2 px-5 py-2.5 w-full shadow-sm"
            >
              <Edit3 size={15} /> Edit Profile
            </button>

            {!isAdmin && (
              <>
            {/* Add Record Dropdown */}
            <div
              className={`dropdown dropdown-end w-full ${isAddRecordMenuOpen ? "dropdown-open" : ""}`}
            >
              <button
                type="button"
                tabIndex={0}
                aria-expanded={isAddRecordMenuOpen}
                onClick={() => setIsAddRecordMenuOpen((isOpen) => !isOpen)}
                className="btn btn-outline btn-primary font-bold rounded-xl gap-2 px-5 py-2.5 w-full"
              >
                <PlusCircle size={15} /> Add Record
              </button>
              {isAddRecordMenuOpen && (
                <ul
                  tabIndex={0}
                  className="dropdown-content z-30 menu p-2 shadow-xl bg-base-100 rounded-2xl w-56 mt-2 border border-base-300 text-base-content"
                >
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAIModalOpen(true);
                      setIsAddRecordMenuOpen(false);
                    }}
                    className="text-xs font-bold py-2.5 flex items-center gap-2"
                  >
                    <Syringe size={15} className="text-info" /> Artificial Insemination (AI)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddMedicalModalOpen(true);
                      setIsAddRecordMenuOpen(false);
                    }}
                    className="text-xs font-bold py-2.5 flex items-center gap-2"
                  >
                    <Stethoscope size={15} className="text-error" /> Health / Medical Log
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPDModalOpen(true);
                      setIsAddRecordMenuOpen(false);
                    }}
                    className="text-xs font-bold py-2.5 flex items-center gap-2"
                  >
                    <ShieldCheck size={15} className="text-success" /> Pregnancy Diagnosis (PD)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCalvingModalOpen(true);
                      setIsAddRecordMenuOpen(false);
                    }}
                    className="text-xs font-bold py-2.5 flex items-center gap-2"
                  >
                    <Heart size={15} className="text-secondary" /> Calving Record
                  </button>
                </li>
                </ul>
              )}
            </div>
              </>
            )}
          </div>
        </div>

        {/* ── SECTION 2: SummaryCards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* LastServiceCard */}
          <div className="bg-base-100 rounded-3xl border border-base-300 p-5 shadow-sm flex items-center gap-4">
            <div className="size-14 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
              <Calendar size={22} className="stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-base-content/60 uppercase tracking-wide">
                Last AI Service
              </p>
              <p className="text-lg font-black text-base-content truncate mt-0.5">
                {latestInsemination
                  ? fmtDate(latestInsemination.inseminationDate)
                  : "Not recorded"}
              </p>
              <p className="text-xs font-medium text-base-content/60">
                {daysAgoInsemination != null
                  ? `${daysAgoInsemination} days ago`
                  : "No AI service date recorded"}
              </p>
            </div>
          </div>

          {/* PregnancyCard with next page navigation arrow */}
          <div
            onClick={() => {
              if (!isAdmin) navigate("/technician/ledger");
            }}
            className={`bg-base-100 rounded-3xl border border-base-300 p-5 shadow-sm flex items-center justify-between gap-4 group ${
              isAdmin
                ? ""
                : "cursor-pointer hover:border-primary/60 hover:shadow-md transition-all"
            }`}
            role={isAdmin ? undefined : "button"}
            tabIndex={isAdmin ? undefined : 0}
            onKeyDown={(event) => {
              if (
                !isAdmin &&
                (event.key === "Enter" || event.key === " ")
              ) {
                navigate("/technician/ledger");
              }
            }}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="size-14 rounded-full bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                <Baby size={22} className="stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-base-content/60 uppercase tracking-wide">
                  Pregnancy Stage
                </p>
                <p className="text-lg font-black text-base-content truncate mt-0.5">
                  {animal.reproductiveStatus || "Not recorded"}
                </p>
                <p className="text-xs font-medium text-base-content/60">
                  {latestInsemination?.pregnancy?.targetCalvingDate
                    ? `Expected ${fmtDate(latestInsemination.pregnancy.targetCalvingDate)}`
                    : "Pregnancy stage not recorded"}
                </p>
              </div>
            </div>
            <div className="size-9 rounded-full bg-base-200 text-base-content/60 group-hover:bg-primary group-hover:text-primary-content flex items-center justify-center transition-colors shrink-0">
              <ChevronRight size={18} />
            </div>
          </div>

          {/* HealthCard */}
          <div className="bg-base-100 rounded-3xl border border-base-300 p-5 shadow-sm flex items-center gap-4">
            <div className="size-14 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
              <HeartPulse size={22} className="stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-base-content/60 uppercase tracking-wide">
                Health Status
              </p>
              <p className="text-lg font-black text-base-content truncate mt-0.5">
                {activeWithdrawalRecord
                  ? "Under Withdrawal"
                  : animal.healthStatus || "Not recorded"}
              </p>
              <p className="text-xs font-medium text-base-content/60">
                {activeWithdrawalRecord
                  ? `Active until ${fmtDate(activeWithdrawalRecord.details.withdrawalEndDate)}`
                  : "No active withdrawal warning"}
              </p>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: DetailsGrid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* AnimalDetailsCard */}
          <div className="bg-base-100 rounded-3xl border border-base-300 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-primary font-extrabold text-base border-b border-base-300 pb-3">
              <Beef size={18} />
              <span>Animal Details</span>
            </div>

            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between items-center py-1">
                <span className="text-base-content/60 font-medium">Date of Birth</span>
                <span className="font-bold text-base-content">
                  {fmtDate(animal.dateOfBirth || animal.birthDate)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-base-200">
                <span className="text-base-content/60 font-medium">Color / Markings</span>
                <span className="font-bold text-base-content">
                  {animal.colorMarkings || animal.color || "Not recorded"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-base-200">
                <span className="text-base-content/60 font-medium">Weight</span>
                <span className="font-bold text-base-content">
                  {animal.weight ? `${animal.weight} kg` : "Not recorded"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-base-200">
                <span className="text-base-content/60 font-medium">Milk Production</span>
                <span className="font-bold text-base-content">
                  {animal.milkProduction
                    ? `${animal.milkProduction} L / day`
                    : "Not recorded"}
                </span>
              </div>
            </div>
          </div>

          {/* OwnerInformationCard */}
          <div className="bg-base-100 rounded-3xl border border-base-300 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-primary font-extrabold text-base border-b border-base-300 pb-3">
              <User size={18} />
              <span>Owner Information</span>
            </div>

            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between items-center py-1">
                <span className="text-base-content/60 font-medium">Name</span>
                <span className="font-bold text-base-content">
                  {animal.farmerId?.name || "Not recorded"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-base-200">
                <span className="text-base-content/60 font-medium">Contact Number</span>
                <span className="font-bold text-base-content font-mono">
                  {animal.farmerId?.phoneNumber ||
                    animal.farmerId?.phone ||
                    "Not recorded"}
                </span>
              </div>

              <div className="flex justify-between items-start py-1 border-t border-base-200 gap-4">
                <span className="text-base-content/60 font-medium shrink-0">Address</span>
                <span className="font-bold text-base-content text-right leading-snug">
                  {getOwnerLocation(animal.farmerId?.address)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 4: RecentRecordsTable ── */}
        <div className="bg-base-100 rounded-3xl border border-base-300 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-base-300 pb-4">
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
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50 z-10"
                />
                <input
                  type="text"
                  aria-label="Search animal records"
                  placeholder="Search records..."
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                  className="input input-sm border border-base-300 bg-base-200/80 text-base-content placeholder:text-base-content/50 pl-9 rounded-xl text-xs w-full focus:outline-none focus:border-primary focus:bg-base-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all"
                />
              </div>

              <select
                aria-label="Filter animal records by type"
                value={recordTypeFilter}
                onChange={(e) => setRecordTypeFilter(e.target.value)}
                className="select select-sm border border-base-300 bg-base-200/80 text-base-content rounded-xl text-xs font-semibold focus:outline-none focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                <FileText size={36} className="mx-auto text-base-content/30" />
                <p className="text-sm font-semibold">No records match your search.</p>
              </div>
            ) : (
              <table className="table table-zebra w-full text-left">
                <thead>
                  <tr className="border-b border-base-200 text-xs text-base-content/60 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Record Type</th>
                    <th className="py-3 px-4">Details</th>
                    <th className="py-3 px-4">Technician</th>
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
                          <button
                            type="button"
                            onClick={() => setSelectedActivity(record)}
                            className="btn btn-xs btn-ghost text-success font-bold"
                          >
                            <Eye size={13} className="mr-1" /> View
                          </button>
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
                {showAllRecords ? "Show recent records only" : "View all records"}
              </button>
            </div>
          )}
        </div>
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
