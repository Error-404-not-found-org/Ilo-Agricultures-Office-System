import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  Download,
  Phone,
  Mail,
  MapPin,
  User,
  Activity,
  Syringe,
  Stethoscope,
  Info,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Tag,
  Heart,
  Scale,
  Calendar,
  ChevronRight,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import EditInseminationModal from "../../components/EditInseminationModal";
import AddMedicalRecordModal from "../../components/modals/AddMedicalRecordModal";
import ActivityDetailsModal from "../../components/modals/ActivityDetailsModal";
import BreedingTimeline from "../../components/BreedingTimeline";

// ── Helpers ────────────────────────────────────────────────────────────────

function statusChip(status) {
  const s = status?.toLowerCase() || "";
  if (s === "pregnant")
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800";
  if (s === "inseminated")
    return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800";
  if (s === "open")
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800";
  return "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700";
}

function outcomeChip(status) {
  const s = status?.toLowerCase() || "";
  if (s === "pending")
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800";
  return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800";
}

function fmtDate(d, style = "medium") {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { dateStyle: style });
}

function fmtTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, accent = false }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        {icon}
        {label}
      </span>
      <p
        className={`text-lg font-bold leading-tight truncate ${
          accent
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-slate-800 dark:text-slate-100"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
          {sub}
        </p>
      )}
    </div>
  );
}

function InfoCell({ label, value, mono = false, accent = false }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3">
      <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className={`text-sm font-semibold truncate ${
          mono ? "font-mono" : ""
        } ${accent ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100"}`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function VaccBar({ label, pct, status }) {
  const barColor =
    status === "due"
      ? "bg-amber-400"
      : status === "overdue"
        ? "bg-rose-400"
        : "bg-emerald-500";
  const chipColor =
    status === "due"
      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800"
      : status === "overdue"
        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800"
        : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800";
  const chipLabel =
    status === "due"
      ? "Due soon"
      : status === "overdue"
        ? "Overdue"
        : "Current";

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 truncate">
          {label}
        </p>
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${chipColor}`}
      >
        {chipLabel}
      </span>
    </div>
  );
}

// ── Tabs config ────────────────────────────────────────────────────────────

const TABS = [
  { id: "dashboard", label: "Overview", icon: <Activity size={13} /> },
  { id: "reproduction", label: "Breeding ledger", icon: <Syringe size={13} /> },
  { id: "clinical", label: "Medical records", icon: <Stethoscope size={13} /> },
  { id: "bio", label: "Technical bio", icon: <Info size={13} /> },
];

// ── Main component ─────────────────────────────────────────────────────────

export default function LivestockProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedInsemination, setSelectedInsemination] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);

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

  const isLoading = isLoadingAnimal || isLoadingMedical;

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-[3px] border-slate-200 border-t-emerald-500 dark:border-slate-800 dark:border-t-emerald-400 rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest animate-pulse">
            Loading asset…
          </p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error || !animal) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle size={36} className="text-rose-400 mx-auto" />
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            Asset not found
          </h2>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Could not load this animal's record from the registry.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <ChevronLeft size={14} /> Back to registry
          </button>
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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      {/* ── Top header ── */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                <Tag size={12} className="text-slate-400 shrink-0" />
                Asset #{animal.earTag}
              </h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusChip(
                  animal.reproductiveStatus,
                )}`}
              >
                {animal.reproductiveStatus || "Normal"}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              Municipal livestock registry · UID-
              {animal._id?.slice(-8).toUpperCase()}
            </p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer">
          <Download size={12} /> Export
        </button>
      </header>

      {/* ── Page body ── */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* ── Left sidebar ── */}
          <aside className="space-y-4">
            {/* Identity card */}
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              {/* Photo */}
              <div className="h-44 bg-slate-100 dark:bg-slate-900 relative">
                <img
                  src={
                    animal.imageUrl ||
                    `https://ui-avatars.com/api/?name=${animal.earTag}&size=200&background=074033&color=fff`
                  }
                  alt={animal.earTag}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
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
                  Stakeholder custody
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <User size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {animal.farmerId?.name || "Unknown farmer"}
                    </p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin size={10} />
                      {animal.farmerId?.address?.barangay || "—"}
                    </p>
                  </div>
                </div>

                {animal.farmerId?.phoneNumber && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <Phone size={12} className="text-slate-400 shrink-0" />
                    <a
                      href={`tel:${animal.farmerId.phoneNumber}`}
                      className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline font-mono"
                    >
                      {animal.farmerId.phoneNumber}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Quick vitals */}
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Quick vitals
              </p>
              <div className="grid grid-cols-2 gap-2">
                <InfoCell label="Ear tag" value={animal.earTag} mono />
                <InfoCell label="Gender" value={animal.gender || "Female"} />
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
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1 flex gap-1 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
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
                                onClick={() => setSelectedInsemination(ins)}
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
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Stethoscope size={12} /> Treatment ledger
                    </h3>
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
                    label="Ownership"
                    value={animal.farmerId?.name || "—"}
                  />
                  <InfoCell
                    label="Barangay"
                    value={animal.farmerId?.address?.barangay || "—"}
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
      />
    </div>
  );
}
