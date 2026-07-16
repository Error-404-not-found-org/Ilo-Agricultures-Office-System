import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Download,
  Phone,
  MapPin,
  User,
  Activity,
  Syringe,
  Stethoscope,
  Info,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Tag,
  Heart,
  Calendar,
  ChevronRight,
  Search,
  Plus,
  FileText,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import EditInseminationModal from "../../components/EditInseminationModal";
import AddMedicalRecordModal from "../../components/modals/AddMedicalRecordModal";
import ActivityDetailsModal from "../../components/modals/ActivityDetailsModal";
import WalkInAIModal from "../../components/modals/WalkInAIModal";
import PregnancyDiagnosisModal from "../../components/modals/PregnancyDiagnosisModal";
import RecordCalfDropModal from "../../components/modals/RecordCalvingModal";

// ── Helpers ────────────────────────────────────────────────────────────────

function statusChip(status) {
  const s = status?.toLowerCase() || "";
  if (s === "pregnant")
    return "badge-success";
  if (s === "inseminated" || s === "likely pregnant")
    return "badge-info";
  if (s === "in heat" || s === "post-partum" || s === "postpartum")
    return "badge-warning";
  if (s === "dry") return "badge-ghost";
  if (s === "open" || s === "normal")
    return "badge-primary";
  return "badge-ghost";
}

function outcomeChip(status) {
  const s = status?.toLowerCase() || "";
  if (s === "pending")
    return "badge-warning";
  if (s.startsWith("failed") || s === "negative") return "badge-error";
  return "badge-success";
}

function cleanLocationPart(value) {
  const text = String(value || "").trim();
  return ["", "n/a", "na", "unknown", "not provided"].includes(text.toLowerCase()) ? "" : text;
}

function getOwnerLocation(address) {
  const value = Array.isArray(address) ? address[0] || {} : address || {};
  return [cleanLocationPart(value.barangay), cleanLocationPart(value.city || value.municipality)]
    .filter(Boolean)
    .join(", ") || "Location not provided";
}

function getRecordMeta(kind) {
  switch (kind) {
    case "AI":
      return {
        bg: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 border-blue-100 dark:border-blue-900",
        icon: <Syringe size={17} />,
        label: "AI Record",
      };
    case "Health":
      return {
        bg: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border-rose-100 dark:border-rose-900",
        icon: <Stethoscope size={17} />,
        label: "Health Record",
      };
    case "Pregnancy Check":
      return {
        bg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900",
        icon: <ShieldCheck size={17} />,
        label: "Pregnancy Check",
      };
    case "Calving":
      return {
        bg: "bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400 border-purple-100 dark:border-purple-900",
        icon: <Heart size={17} />,
        label: "Calving Event",
      };
    default:
      return {
        bg: "bg-slate-50 text-slate-600 dark:bg-slate-900/50 dark:text-slate-400 border-slate-100 dark:border-slate-800",
        icon: <FileText size={17} />,
        label: "Record",
      };
  }
}

function fmtDate(d, style = "medium") {
  if (!d) return "Not recorded";
  return new Date(d).toLocaleDateString(undefined, { dateStyle: style });
}

function fmtTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAge(birthDate) {
  if (!birthDate) return "Unknown";
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return "Unknown";
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

// ── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, accent = false }) {
  return (
    <div className="rounded-box border border-base-300 bg-base-200 p-4 flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-base-content/50 uppercase tracking-wider">
        {icon}
        {label}
      </span>
      <p
        className={`text-lg font-bold leading-tight truncate ${
          accent
            ? "text-primary"
            : "text-base-content"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-base-content/50 font-medium">
          {sub}
        </p>
      )}
    </div>
  );
}

function InfoCell({ label, value, mono = false, accent = false }) {
  return (
    <div className="rounded-box border border-base-300 bg-base-200 p-3">
      <p className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className={`text-sm font-semibold truncate ${
          mono ? "font-mono" : ""
        } ${accent ? "text-primary" : "text-base-content"}`}
      >
        {value || "Not recorded"}
      </p>
    </div>
  );
}



// ── Tabs config ────────────────────────────────────────────────────────────

const TABS = [
  { id: "dashboard", label: "Overview", icon: <Activity size={13} /> },
  { id: "records", label: "Animal Records", icon: <FileText size={13} /> },
  { id: "reproduction", label: "Breeding ledger", icon: <Syringe size={13} /> },
  { id: "clinical", label: "Medical records", icon: <Stethoscope size={13} /> },
  { id: "bio", label: "Technical bio", icon: <Info size={13} /> },
];

// ── Main component ─────────────────────────────────────────────────────────

export default function LivestockProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedInsemination, setSelectedInsemination] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [isAddMedicalModalOpen, setIsAddMedicalModalOpen] = useState(false);
  const [medicalInitialType, setMedicalInitialType] = useState("Vaccination");
  const [isAddRecordDropdownOpen, setIsAddRecordDropdownOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isPDModalOpen, setIsPDModalOpen] = useState(false);
  const [isCalvingModalOpen, setIsCalvingModalOpen] = useState(false);
  const [recordSearch, setRecordSearch] = useState("");
  const [recordTypeFilter, setRecordTypeFilter] = useState("All");
  const [recordFromDate, setRecordFromDate] = useState("");
  const [recordToDate, setRecordToDate] = useState("");
  const [recordDateBasis, setRecordDateBasis] = useState("service");
  const [recordRecentDays, setRecordRecentDays] = useState("All");
  const [recentReferenceTime] = useState(() => Date.now());
  const isAdminPath = window.location.pathname.startsWith("/admin");

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
      recordSummary: [record.sireBreed, record.sireCode]
        .filter(Boolean)
        .join(" · ") || "Artificial insemination service",
      recordStatus: record.status || record.outcome || "Completed",
      recordedBy: record.technicianId?.name || record.approvedBy?.name,
      dateEntered: record.createdAt,
      originId: record._id,
      originLabel: "AI service request",
    }));

    const health = (medicalHistory || []).map((record) => ({
      ...record,
      recordKind: "Health",
      recordDate: record.date || record.createdAt,
      recordTitle: record.type || "Health Record",
      recordSummary:
        record.details?.diagnosis ||
        record.details?.medicineName ||
        record.note ||
        "Routine health service",
      recordStatus: "Completed",
      recordedBy: record.technicianId?.name,
      isHistoricalEntry: record.isHistoricalEntry,
      dateEntered: record.createdAt,
      originId: record.healthRequestId?._id || record.healthRequestId,
      originLabel: record.healthRequestId ? "Health assistance request" : null,
    }));

    const pdEvents = (animal?.inseminations || [])
      .filter(ins => ins.pregnancy)
      .map(ins => {
        const preg = ins.pregnancy;
        return {
          ...preg,
          recordKind: "Pregnancy Check",
          recordDate: preg.pregnancyDiagnosis?.date || preg.diagnosisDate || preg.createdAt,
          recordTitle: "Pregnancy Diagnosis",
          recordSummary: `Result: ${preg.pregnancyDiagnosis?.result || preg.result || preg.status || "Not recorded"}`,
          recordStatus: preg.pregnancyDiagnosis?.result || preg.result || preg.status || "Completed",
          recordedBy: preg.diagnosedBy || preg.technicianId?.name,
          dateEntered: preg.createdAt,
        };
      });

    const calvingEvents = (animal?.calvings || []).map((calving) => ({
      ...calving,
      recordKind: "Calving",
      recordDate: calving.date || calving.createdAt,
      recordTitle: "Calving Record",
      recordSummary: `Calving ease: ${calving.calvingEase || "Not recorded"}. Calves: ${calving.calves?.length || calving.numberOfCalves || 0}`,
      recordStatus: "Completed",
      recordedBy: calving.recordedBy || calving.technicianId?.name,
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
      const selectedDate = recordDateBasis === "entry" ? record.dateEntered : record.recordDate;
      const recordTime = new Date(selectedDate || 0).getTime();
      const matchesFrom = !recordFromDate || recordTime >= new Date(`${recordFromDate}T00:00:00`).getTime();
      const matchesTo = !recordToDate || recordTime <= new Date(`${recordToDate}T23:59:59`).getTime();
      const recentCutoff = recordRecentDays === "All"
        ? null
        : recentReferenceTime - Number(recordRecentDays) * 24 * 60 * 60 * 1000;
      const matchesRecent = recentCutoff === null || recordTime >= recentCutoff;
      const searchable = [
        record.recordTitle,
        record.recordSummary,
        record.recordStatus,
        record.recordedBy,
        record.sireCode,
        record.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesType && matchesFrom && matchesTo && matchesRecent && (!query || searchable.includes(query));
    });
  }, [combinedRecords, recordSearch, recordTypeFilter, recordFromDate, recordToDate, recordDateBasis, recordRecentDays, recentReferenceTime]);

  const isLoading = isLoadingAnimal || isLoadingMedical;

  const handleExportCSV = () => {
    if (!animal) return;
    const summaryRows = [
      ["Animal tag", animal.earTag || animal.animalId || "Not recorded"],
      ["Species", animal.species || "Not recorded"],
      ["Breed", animal.breed || "Not recorded"],
      ["Sex", animal.gender || "Not recorded"],
      ["Reproductive status", animal.reproductiveStatus || "Normal"],
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
    ].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
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
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="skeleton h-14 w-full" />
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-4"><div className="skeleton h-72 w-full" /><div className="skeleton h-64 w-full" /></div>
            <div className="space-y-4"><div className="skeleton h-14 w-full" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="skeleton h-28" />)}</div><div className="skeleton h-80 w-full" /></div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error || !animal) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-base-200 p-6">
        <div role="alert" className="alert alert-error max-w-xl">
          <AlertCircle size={20} />
          <div><div className="font-bold">Animal profile could not be loaded.</div><div className="text-sm">{error?.response?.data?.message || error?.message || "The animal may no longer be available."}</div></div>
          <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ["animal", id] })} className="btn btn-sm">Retry</button>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-sm btn-ghost"><ChevronLeft size={14} /> Back</button>
        </div>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const latestInsemination =
    animal.inseminations
      ?.slice()
      .sort(
        (a, b) => new Date(b.inseminationDate) - new Date(a.inseminationDate),
      )[0] || null;

  const activeWithdrawalRecord = (medicalHistory || []).find((record) => {
    if (!record.details?.withdrawalEndDate) return false;
    const endDate = new Date(record.details.withdrawalEndDate);
    return endDate > new Date();
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex-1 overflow-y-auto bg-base-200 text-base-content">
      {/* ── Top header ── */}
      <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between border-b border-base-300 bg-base-100/95 px-4 backdrop-blur sm:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="btn btn-ghost btn-sm btn-square text-base-content/60"
            aria-label="Back to animal registry"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="flex items-center gap-1.5 truncate text-base font-bold text-base-content">
                <Tag size={14} className="text-base-content/45 shrink-0" />
                Animal #{animal.earTag || animal.animalId}
              </h1>
              <span
                className={`badge badge-sm badge-soft ${statusChip(
                  animal.reproductiveStatus,
                )}`}
              >
                {animal.reproductiveStatus || "Normal"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-base-content/50">
              Animal record · ID ending 
              {animal._id?.slice(-8).toUpperCase()}
            </p>
          </div>
        </div>
        <button type="button" onClick={handleExportCSV} className="btn btn-sm">
          <Download size={12} /> Export
        </button>
      </header>

      {/* ── Page body ── */}
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
        {activeWithdrawalRecord && (
          <div role="alert" className="alert alert-error mb-6 items-start">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                Active Medication Withdrawal Warning
              </h4>
              <p className="mt-1 text-xs leading-relaxed">
                Meat and milk from this animal are unsafe for consumption or sale until{" "}
                <span className="font-bold">
                  {fmtDate(activeWithdrawalRecord.details?.withdrawalEndDate, "long")}
                </span>{" "}
                due to recent treatment with{" "}
                <span className="font-bold">
                  {activeWithdrawalRecord.details?.medicineName || "medicine"}
                </span>.
              </p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* ── Left sidebar ── */}
          <aside className="space-y-4">
            {/* Identity card */}
            <div className="card card-border overflow-hidden bg-base-100 shadow-sm">
              {/* Photo */}
              <div className="h-44 bg-base-200 relative">
                <img
                  src={
                    animal.imageUrl ||
                    `https://ui-avatars.com/api/?name=${animal.earTag}&size=200&background=074033&color=fff`
                  }
                  alt={animal.earTag}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/30 to-transparent pointer-events-none" />
                {/* Floating tag */}
                <div className="absolute bottom-3 left-3 flex gap-1.5">
                  <span className="text-[10px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-md backdrop-blur-sm">
                    {animal.species || "Bovine"}
                  </span>
                  <span className="text-[10px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-md backdrop-blur-sm">
                    {animal.breed || "Crossbreed"}
                  </span>
                </div>
              </div>

              {/* Owner block */}
              <div className="p-4 space-y-3">
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Ownership details
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-base-content">
                      {animal.farmerId?.name || "Unknown farmer"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-base-content/50">
                      <MapPin size={10} />
                      {getOwnerLocation(animal.farmerId?.address)}
                    </p>
                  </div>
                </div>

                {animal.farmerId?.phoneNumber && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <Phone size={12} className="text-slate-400 shrink-0" />
                    <a
                      href={`tel:${animal.farmerId.phoneNumber}`}
                      className="font-mono font-semibold text-primary hover:underline"
                    >
                      {animal.farmerId.phoneNumber}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Quick vitals */}
            <div className="card card-border space-y-3 bg-base-100 p-4 shadow-sm">
              <p className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wider">
                Quick vitals
              </p>
              <div className="grid grid-cols-2 gap-2">
                <InfoCell label="Ear tag" value={animal.earTag} mono />
                <InfoCell label="Gender" value={animal.gender || "Female"} />
                <InfoCell label="Age" value={formatAge(animal.birthDate)} />
                <InfoCell label="Birth Date" value={fmtDate(animal.birthDate, "medium")} />
                <InfoCell label="Color" value={animal.color || "—"} />
                <InfoCell
                  label="Repro. status"
                  value={animal.reproductiveStatus || "Normal"}
                  accent
                />
              </div>
            </div>
          </aside>

          {/* ── Right panel ── */}
          <div className="space-y-4">
            {/* Tab bar */}
            <div className="flex max-w-full flex-wrap gap-1 rounded-box border border-base-300 bg-base-100 p-1 shadow-sm">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`btn btn-sm h-auto min-h-9 flex-1 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "btn-primary"
                      : "btn-ghost text-base-content/65"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Tab: Overview ── */}
            {activeTab === "dashboard" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Metric strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricCard
                    icon={<Heart size={11} />}
                    label="Repro. status"
                    value={animal.reproductiveStatus || "Normal"}
                    sub={
                      latestInsemination
                        ? `Attempt #${latestInsemination.attemptNumber}`
                        : "No records"
                    }
                    accent
                  />
                  <MetricCard
                    icon={<Calendar size={11} />}
                    label="Last insemination"
                    value={
                      latestInsemination
                        ? fmtDate(latestInsemination.inseminationDate, "short")
                        : "—"
                    }
                    sub={latestInsemination?.sireBreed || "—"}
                  />
                  <MetricCard
                    icon={<ShieldCheck size={11} />}
                    label="Medical records"
                    value={medicalHistory.length}
                    sub="Total logged"
                  />
                </div>

                {/* Breeding timeline */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <Syringe size={12} /> Breeding timeline
                  </h3>

                  {!animal.inseminations?.length ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6 italic">
                      No insemination records logged yet.
                    </p>
                  ) : (
                    <div className="space-y-0">
                      {animal.inseminations
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.inseminationDate) -
                            new Date(a.inseminationDate),
                        )
                        .map((ins, i, arr) => (
                          <div
                            key={ins._id}
                            className="flex gap-3 cursor-pointer group"
                            onClick={() => {
                              setSelectedActivity({
                                ...ins,
                                type: "Insemination",
                                title: `AI Service — ${ins.sireBreed || "N/A"}`,
                                description:
                                  ins.technicianNote ||
                                  "Artificial insemination recorded.",
                                date: ins.inseminationDate,
                                status: ins.status || "Done",
                                iconType: "Syringe",
                                details: {
                                  sireBreed: ins.sireBreed,
                                  sireCode: ins.sireCode,
                                  attemptNumber: ins.attemptNumber,
                                },
                              });
                            }}
                          >
                            {/* Timeline spine */}
                            <div className="flex flex-col items-center w-5 shrink-0 pt-1">
                              <div
                                className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 ${
                                  i === 0
                                    ? "bg-emerald-500 border-emerald-500"
                                    : "bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                                }`}
                              />
                              {i < arr.length - 1 && (
                                <div className="w-px flex-1 bg-slate-200 dark:bg-slate-800 my-1" />
                              )}
                            </div>

                            {/* Event card */}
                            <div
                              className={`flex-1 mb-3 p-3 rounded-xl border transition-colors group-hover:border-emerald-200 dark:group-hover:border-emerald-800 ${
                                i === 0
                                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900"
                                  : "bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                    Attempt #{ins.attemptNumber} —{" "}
                                    {ins.sireBreed || "Crossbreed"}
                                  </p>
                                  <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                    {ins.sireCode || "—"}
                                  </p>
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${outcomeChip(
                                    ins.status,
                                  )}`}
                                >
                                  {ins.status || "Done"}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-2">
                                {fmtDate(ins.inseminationDate)}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Notifications */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle size={12} /> Active notifications
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {animal.reproductiveStatus === "Pregnant" && (
                      <div className="flex gap-2.5 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl">
                        <CheckCircle2
                          size={14}
                          className="text-emerald-500 shrink-0 mt-0.5"
                        />
                        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 leading-relaxed">
                          Confirmed pregnant. Switch to high-protein feed and
                          schedule prenatal check.
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2.5 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl">
                      <ShieldCheck
                        size={14}
                        className="text-blue-500 shrink-0 mt-0.5"
                      />
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-300 leading-relaxed">
                        Vaccination schedule is current. Local records up to
                        date.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Animal Records ── */}
            {activeTab === "records" && (
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden animate-in fade-in duration-150">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        Complete Animal History
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Health and breeding records for this animal, newest first.
                      </p>
                    </div>
                    {!isAdminPath && (
                      <div className="relative">
                        <button
                          onClick={() => setIsAddRecordDropdownOpen(!isAddRecordDropdownOpen)}
                          className="inline-flex items-center justify-center gap-1.5 h-9 px-4 bg-[#00643b] hover:bg-[#004d2e] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                          <Plus size={14} /> Add Record
                        </button>
                        {isAddRecordDropdownOpen && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setIsAddRecordDropdownOpen(false)} 
                            />
                            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 shadow-xl z-50 space-y-1">
                              <button
                                onClick={() => {
                                  setIsAddRecordDropdownOpen(false);
                                  setIsAIModalOpen(true);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg flex items-center gap-2 cursor-pointer"
                              >
                                <Syringe size={14} className="text-blue-500" />
                                Artificial Insemination (AI)
                              </button>
                              <button
                                onClick={() => {
                                  setIsAddRecordDropdownOpen(false);
                                  setIsPDModalOpen(true);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg flex items-center gap-2 cursor-pointer"
                              >
                                <ShieldCheck size={14} className="text-emerald-500" />
                                Pregnancy Diagnosis (PD)
                              </button>
                              <button
                                onClick={() => {
                                  setIsAddRecordDropdownOpen(false);
                                  setIsCalvingModalOpen(true);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg flex items-center gap-2 cursor-pointer"
                              >
                                <Heart size={14} className="text-purple-500" />
                                Calving Record
                              </button>
                              <button
                                onClick={() => {
                                  setIsAddRecordDropdownOpen(false);
                                  setMedicalInitialType("Check-up");
                                  setIsAddMedicalModalOpen(true);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg flex items-center gap-2 cursor-pointer"
                              >
                                <Stethoscope size={14} className="text-rose-500" />
                                Health / Medical Log
                              </button>
                              <button
                                onClick={() => {
                                  setIsAddRecordDropdownOpen(false);
                                  setMedicalInitialType("General Note");
                                  setIsAddMedicalModalOpen(true);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg flex items-center gap-2 cursor-pointer"
                              >
                                <FileText size={14} className="text-slate-500" />
                                General Note
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <label className="relative flex-1">
                      <span className="sr-only">Search animal records</span>
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        value={recordSearch}
                        onChange={(event) => setRecordSearch(event.target.value)}
                        placeholder="Search diagnosis, medicine, sire code, technician, or notes"
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                      />
                    </label>
                    <label>
                      <span className="sr-only">Filter animal records by type</span>
                      <select
                        value={recordTypeFilter}
                        onChange={(event) => setRecordTypeFilter(event.target.value)}
                        className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs outline-none focus:border-emerald-600"
                      >
                        <option value="All">All record types</option>
                        <option value="Health">Health records</option>
                        <option value="AI">AI records</option>
                        <option value="Pregnancy Check">Pregnancy checks</option>
                        <option value="Calving">Calving events</option>
                      </select>
                    </label>
                    <label>
                      <span className="sr-only">Choose which record date to filter</span>
                      <select
                        value={recordDateBasis}
                        onChange={(event) => setRecordDateBasis(event.target.value)}
                        className="h-10 w-full sm:w-auto px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs outline-none focus:border-emerald-600"
                      >
                        <option value="service">Service date</option>
                        <option value="entry">Entry date</option>
                      </select>
                    </label>
                    <label>
                      <span className="sr-only">Show recent animal records</span>
                      <select
                        value={recordRecentDays}
                        onChange={(event) => setRecordRecentDays(event.target.value)}
                        className="h-10 w-full sm:w-auto px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs outline-none focus:border-emerald-600"
                      >
                        <option value="All">All activity</option>
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-slate-500">From</span>
                      <input
                        type="date"
                        value={recordFromDate}
                        max={recordToDate || new Date().toISOString().slice(0, 10)}
                        onChange={(event) => setRecordFromDate(event.target.value)}
                        className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs outline-none focus:border-emerald-600"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-slate-500">To</span>
                      <input
                        type="date"
                        value={recordToDate}
                        min={recordFromDate || undefined}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(event) => setRecordToDate(event.target.value)}
                        className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs outline-none focus:border-emerald-600"
                      />
                    </label>
                  </div>
                </div>

                {visibleRecords.length === 0 ? (
                  <div className="px-6 py-14 text-center">
                    <FileText size={28} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {combinedRecords.length === 0
                        ? "No animal records have been entered yet."
                        : "No records match your search or filter."}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {combinedRecords.length === 0
                        ? "Add a health record or record a breeding service to begin the history."
                        : "Try a different term or select all record types."}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleRecords.map((record) => {
                      const meta = getRecordMeta(record.recordKind);
                      return (
                        <button
                          type="button"
                          key={`${record.recordKind}-${record._id}`}
                          onClick={() => {
                            const kind = record.recordKind;
                            let iconType = "FileText";
                            let details = {};
                            if (kind === "AI") {
                              iconType = "Syringe";
                              details = {
                                sireBreed: record.sireBreed,
                                sireCode: record.sireCode,
                                attemptNumber: record.attemptNumber,
                              };
                            } else if (kind === "Health") {
                              iconType = "Stethoscope";
                              details = {
                                diagnosis: record.details?.diagnosis,
                                medicine: record.details?.medicineName,
                                requestType: record.type,
                              };
                            } else if (kind === "Pregnancy Check") {
                              iconType = "ShieldCheck";
                              details = {
                                result: record.result || record.status,
                                method: record.method,
                              };
                            } else if (kind === "Calving") {
                              iconType = "Heart";
                              details = {
                                status: record.status,
                                outcome: record.outcome,
                                calvesCount: record.calves?.length || 0,
                              };
                            }
                            setSelectedActivity({
                              ...record,
                              type: kind,
                              title: record.recordTitle,
                              description: record.recordSummary,
                              date: record.recordDate,
                              status: record.recordStatus,
                              iconType,
                              technicianName: record.recordedBy,
                              details,
                            });
                          }}
                          className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors cursor-pointer border-none"
                        >
                          <span
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`}
                          >
                            {meta.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {record.recordTitle}
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                                {meta.label}
                              </span>
                              {record.isHistoricalEntry && (
                                <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                                  Past Record
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                              {record.recordSummary}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-1">
                              Service date: {fmtDate(record.recordDate)}
                              {record.recordedBy ? `, recorded by ${record.recordedBy}` : ""}
                            </span>
                            {record.dateEntered && (
                              <span className="block text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                                Entered in BreedSmart: {fmtDate(record.dateEntered)}
                              </span>
                            )}
                          </span>
                          <span className="text-right shrink-0 hidden sm:block">
                            <span className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              {record.recordStatus}
                            </span>
                            <ChevronRight size={14} className="ml-auto mt-1 text-slate-300" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Reproduction ── */}
            {activeTab === "reproduction" && (
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden animate-in fade-in duration-150">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Syringe size={12} /> Historical breeding records
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <th className="px-5 py-3">Attempt</th>
                        <th className="px-4 py-3">Sire lineage</th>
                        <th className="px-4 py-3">Outcome</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {!animal.inseminations?.length ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-5 py-10 text-center text-slate-400 dark:text-slate-500 italic"
                          >
                            No breeding records logged yet.
                          </td>
                        </tr>
                      ) : (
                        animal.inseminations.map((ins) => (
                          <tr
                            key={ins._id}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-colors"
                          >
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                Attempt #{ins.attemptNumber}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {fmtDate(ins.inseminationDate)}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="font-semibold text-slate-700 dark:text-slate-300">
                                {ins.sireBreed || "Crossbreed"}
                              </p>
                              <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                                {ins.sireCode || "—"}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${outcomeChip(
                                  ins.status,
                                )}`}
                              >
                                {ins.status || "Completed"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() => {
                                  if (isAdminPath) {
                                    setSelectedActivity({
                                      ...ins,
                                      type: "Insemination",
                                      title: `AI Service — ${ins.sireBreed || "N/A"}`,
                                      description: ins.technicianNote || "Artificial insemination recorded.",
                                      date: ins.inseminationDate,
                                      status: ins.status || "Done",
                                      iconType: "Syringe",
                                      technicianName: ins.technicianId?.name,
                                      details: {
                                        sireBreed: ins.sireBreed,
                                        sireCode: ins.sireCode,
                                        attemptNumber: ins.attemptNumber,
                                      },
                                    });
                                  } else {
                                    setSelectedInsemination(ins);
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                              >
                                <ChevronRight size={13} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Tab: Clinical ── */}
            {activeTab === "clinical" && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 animate-in fade-in duration-150">
                {/* Treatment table */}
                <div className="xl:col-span-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Stethoscope size={12} /> Treatment ledger
                    </h3>
                    {!isAdminPath && (
                      <button
                        onClick={() => setIsAddMedicalModalOpen(true)}
                        className="btn btn-xs bg-[#00643b] hover:bg-[#004d2e] border-none text-white text-[10px] font-bold rounded-lg cursor-pointer transition-all active:scale-95 shadow-xs"
                      >
                        + Add Record
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/60 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                          <th className="px-5 py-3">Date</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Diagnosis / medicine</th>
                          <th className="px-4 py-3 text-right">Officer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {!medicalHistory.length ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-5 py-10 text-center text-slate-400 dark:text-slate-500 italic"
                            >
                              No clinical records found.
                            </td>
                          </tr>
                        ) : (
                          medicalHistory.map((rec) => (
                            <tr
                              key={rec._id}
                              onClick={() =>
                                setSelectedActivity({
                                  ...rec,
                                  type: "Health",
                                  title: `Medical: ${rec.type?.toUpperCase()}`,
                                  description:
                                    rec.note ||
                                    rec.details?.diagnosis ||
                                    "Procedure logged.",
                                  date: rec.date,
                                  status: "Done",
                                  iconType: "HeartPulse",
                                  technicianName: rec.technicianId?.name,
                                  details: {
                                    diagnosis: rec.details?.diagnosis,
                                    medicine: rec.details?.medicineName,
                                    requestType: rec.type,
                                  },
                                })
                              }
                              className="hover:bg-slate-50/60 dark:hover:bg-slate-900/30 cursor-pointer transition-colors"
                            >
                              <td className="px-5 py-3.5">
                                <p className="font-semibold text-slate-800 dark:text-slate-200">
                                  {fmtDate(rec.date, "short")}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {fmtTime(rec.date)}
                                </p>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800">
                                  {rec.type || "Checkup"}
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                <p className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                                  {rec.details?.diagnosis ||
                                    rec.details?.medicineName ||
                                    "Routine treatment"}
                                </p>
                              </td>
                              <td className="px-4 py-3.5 text-right text-slate-500 dark:text-slate-400">
                                {rec.technicianId?.name || "System"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Bio ── */}
            {activeTab === "bio" && (
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animate-in fade-in duration-150">
                <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Info size={12} /> Technical biological record
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <InfoCell
                    label="Registry gender"
                    value={animal.gender || "Female"}
                  />
                  <InfoCell
                    label="Species"
                    value={animal.species || "Bovine"}
                  />
                  <InfoCell
                    label="Breed"
                    value={animal.breed || "Crossbreed"}
                  />
                  <InfoCell label="Coat color" value={animal.color || "—"} />
                  <InfoCell label="Ear tag ID" value={animal.earTag} mono />
                  <InfoCell
                    label="Age"
                    value={formatAge(animal.birthDate)}
                  />
                  <InfoCell
                    label="Birth Date"
                    value={fmtDate(animal.birthDate, "medium")}
                  />
                  <InfoCell
                    label="Ownership"
                    value={animal.farmerId?.name || "—"}
                  />
                  <InfoCell
                    label="Barangay"
                    value={getOwnerLocation(animal.farmerId?.address)}
                  />
                  <InfoCell
                    label="Repro. status"
                    value={animal.reproductiveStatus || "Normal"}
                    accent
                  />
                  <InfoCell
                    label="UID"
                    value={animal._id?.slice(-8).toUpperCase()}
                    mono
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Modals ── */}
      <EditInseminationModal
        isOpen={!!selectedInsemination}
        onClose={() => setSelectedInsemination(null)}
        insemination={selectedInsemination}
        animalId={id}
      />
      <ActivityDetailsModal
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        activity={selectedActivity}
        onOpenSource={(activity) => {
          if (!activity?.originId || isAdminPath) return;
          navigate(`/technician/requests?requestId=${activity.originId}&status=completed`);
        }}
      />
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
      <WalkInAIModal
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
    </div>
  );
}
