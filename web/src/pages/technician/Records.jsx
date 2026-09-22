import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Search,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import axiosInstance from "../../lib/axios";
import { sanitizeFileName } from "../../lib/reportExport";
import Topbar from "../../components/layout/Topbar";
import OfficialRecordDetailModal from "../../components/technician/OfficialRecordDetailModal";
import UserAvatar from "../../components/ui/UserAvatar";
import {
  formatRecordStatus,
  getAllRecordsResultPresentation,
  getHealthResultPresentation,
  getAIResultPresentation,
  getPregnancyResultPresentation,
  formatDiagnosticMethod,
} from "../../utils/officialRecordPresentation";
import {
  getCurrentManilaMonth,
  getMonthBounds,
  isMonthValue,
  RECORDS_DATE_PRESETS,
  resolveRecordsDateFilter,
} from "../../utils/recordsDateFilter";

const PAGE_SIZE = 10;

const RECORD_FILTERS = [
  { value: "all", label: "All service types" },
  { value: "insemination", label: "Insemination" },
  { value: "health", label: "Health" },
  { value: "pregnancy", label: "Pregnancy" },
  { value: "calving", label: "Calving" },
];

const formatMonthLabel = (monthValue) => {
  if (!isMonthValue(monthValue)) return "All dates";
  const [year, month] = monthValue.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
};

const formatDateOnlyLabel = (value) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date);
};

const getRecordTypeLabel = (value) =>
  value === "all"
    ? "All service types"
    : RECORD_FILTERS.find((filter) => filter.value === value)?.label || "All service types";

const formatDate = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(date);
};

const categoryBadgeClass = (category) => {
  if (category === "Health") return "badge-info";
  if (category === "Pregnancy") return "badge-secondary";
  if (category === "Calving") return "badge-success";
  return "badge-primary";
};

const statusBadgeClass = (status) =>
  ["cancelled", "rejected"].includes(String(status || "").toLowerCase())
    ? "badge-error"
    : "badge-success";

// --- Presentation Helpers ---
const getAnimalTag = (record) => {
  const animal = record.animalId || record.source?.animalId || {};
  return animal.earTag || animal.animalId || "Animal not recorded";
};

const getFarmer = (record) => {
  const farmer = record.farmerId || record.source?.farmerId || {};
  return {
    name: farmer.name || "Farmer not recorded",
    image:
      farmer.profileImage ||
      farmer.imageUrl ||
      farmer.avatar ||
      farmer.photoUrl,
  };
};

const getInseminationFields = (record) => ({
  date: record.source?.inseminationDate || record.recordDate,
  sireBreed: record.source?.sireBreed,
  sireCode: record.source?.sireCode,
  attemptNumber: record.source?.attemptNumber,
  outcome: record.source?.outcome,
});

const getHealthFields = (record) => ({
  type: record.source?.type || record.title,
  date: record.source?.date || record.recordDate,
  treatment:
    record.source?.details?.treatment ||
    record.source?.details?.diagnosis ||
    record.source?.note ||
    record.summary,
});

const getPregnancyFields = (record) => ({
  date: record.source?.pregnancyDiagnosis?.date || record.recordDate,
  result: record.source?.pregnancyDiagnosis?.result,
  method: record.source?.confirmation?.methodCode,
});

const getCalvingFields = (record) => ({
  date: record.source?.date || record.recordDate,
  numberOfCalves:
    record.source?.numberOfCalves ?? record.source?.calves?.length,
  calvingEase: record.source?.calvingEase,
});

const getRecordActionLabel = (record) => {
  if (record.recordKind === "ai_request") return "View request";
  if (record.recordKind === "health_request") {
    return ["advice", "office_pickup"].includes(record.source?.handlingMethod)
      ? "View response"
      : "View request";
  }
  return "View record";
};

// --- Dynamic Column Definitions ---
const COLUMNS_BY_TYPE = {
  all: [
    {
      id: "type",
      header: "Type",
      className: "p-3.5 pl-6",
      renderCell: (record) => (
        <div className="space-y-1.5">
          <span
            className={`badge badge-sm rounded-full text-[9px] font-bold uppercase tracking-wider ${categoryBadgeClass(record.category)}`}
          >
            {record.category === "AI" ? "AI" : record.category || "Record"}
          </span>
          <span className="block text-sm font-bold text-base-content">
            {record.title || "Saved activity"}
          </span>
        </div>
      ),
    },
    {
      id: "animal",
      header: "Animal",
      className: "p-3.5",
      renderCell: (record) => (
        <span className="block text-sm font-extrabold leading-tight text-base-content">
          {getAnimalTag(record)}
        </span>
      ),
    },
    {
      id: "farmer",
      header: "Farmer",
      className: "p-3.5",
      renderCell: (record) => {
        const farmer = getFarmer(record);
        return (
          <div className="flex items-center gap-3">
            <UserAvatar
              name={farmer.name}
              imageUrl={farmer.image}
              size={36}
              sizeClass="h-9 w-9"
            />
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold text-base-content">
                {farmer.name}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "date",
      header: "Date",
      className: "p-3.5",
      renderCell: (record) => (
        <span className="block font-bold leading-tight text-base-content">
          {formatDate(record.recordDate)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Result / Status",
      className: "max-w-sm p-3.5",
      renderCell: (record) => {
        const secondary = getAllRecordsResultPresentation(record);
        return (
          <div className="space-y-1.5">
            <span
              className={`badge badge-sm badge-soft ${statusBadgeClass(record.status)}`}
            >
              {formatRecordStatus(record.status)}
            </span>
            {secondary?.value && (
              <span className="block truncate text-base-content/65">
                {secondary.label ? (
                  <span className="font-semibold text-base-content/80">
                    {secondary.label}:{" "}
                  </span>
                ) : null}
                <span>{secondary.value}</span>
              </span>
            )}
          </div>
        );
      },
    },
  ],
  insemination: [
    {
      id: "animal",
      header: "Animal",
      className: "p-3.5 pl-6",
      renderCell: (record) => (
        <span className="block text-sm font-extrabold leading-tight text-base-content">
          {getAnimalTag(record)}
        </span>
      ),
    },
    {
      id: "farmer",
      header: "Farmer",
      className: "p-3.5",
      renderCell: (record) => {
        const farmer = getFarmer(record);
        return (
          <div className="flex items-center gap-3">
            <UserAvatar
              name={farmer.name}
              imageUrl={farmer.image}
              size={36}
              sizeClass="h-9 w-9"
            />
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold text-base-content">
                {farmer.name}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "date",
      header: "Activity Date",
      className: "p-3.5",
      renderCell: (record) => {
        const fields = getInseminationFields(record);
        return (
          <span className="block font-bold leading-tight text-base-content">
            {formatDate(fields.date)}
          </span>
        );
      },
    },
    {
      id: "sire",
      header: "Sire / Details",
      className: "p-3.5",
      renderCell: (record) => {
        const fields = getInseminationFields(record);
        return (
          <span className="block text-sm text-base-content/75">
            {record.recordKind === "ai_request"
              ? record.summary || "Request closed"
              : fields.sireBreed || "Not recorded"}
            {fields.sireCode && (
              <span className="block text-[10px] uppercase">
                {fields.sireCode}
              </span>
            )}
          </span>
        );
      },
    },
    {
      id: "attempt",
      header: "Attempt",
      className: "p-3.5",
      renderCell: (record) => {
        const fields = getInseminationFields(record);
        return (
          <span className="block text-sm font-bold text-base-content/85">
            {record.recordKind === "ai_request"
              ? "Not applicable"
              : fields.attemptNumber
              ? `Attempt #${fields.attemptNumber}`
              : "Not recorded"}
          </span>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      className: "p-3.5",
      renderCell: (record) => {
        const fields = getInseminationFields(record);
        const outcome = getAIResultPresentation(record);
        return (
          <span
            className={`badge badge-sm badge-soft ${statusBadgeClass(record.status)}`}
          >
            {outcome || fields.outcome || formatRecordStatus(record.status)}
          </span>
        );
      },
    },
  ],
  health: [
    {
      id: "animal",
      header: "Animal",
      className: "p-3.5 pl-6",
      renderCell: (record) => (
        <span className="block text-sm font-extrabold leading-tight text-base-content">
          {getAnimalTag(record)}
        </span>
      ),
    },
    {
      id: "farmer",
      header: "Farmer",
      className: "p-3.5",
      renderCell: (record) => {
        const farmer = getFarmer(record);
        return (
          <div className="flex items-center gap-3">
            <UserAvatar
              name={farmer.name}
              imageUrl={farmer.image}
              size={36}
              sizeClass="h-9 w-9"
            />
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold text-base-content">
                {farmer.name}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "serviceType",
      header: "Service Type",
      className: "p-3.5",
      renderCell: (record) => {
        const fields = getHealthFields(record);
        return (
          <span className="block font-bold leading-tight text-base-content">
            {fields.type || "Not recorded"}
          </span>
        );
      },
    },
    {
      id: "date",
      header: "Service Date",
      className: "p-3.5",
      renderCell: (record) => {
        const fields = getHealthFields(record);
        return (
          <span className="block font-bold leading-tight text-base-content">
            {formatDate(fields.date)}
          </span>
        );
      },
    },
    {
      id: "treatment",
      header: "Treatment / Result",
      className: "max-w-sm p-3.5",
      renderCell: (record) => {
        const health = getHealthResultPresentation(record);
        return (
          <div className="space-y-1.5">
            <span
              className={`badge badge-sm badge-soft ${statusBadgeClass(record.status)}`}
            >
              {formatRecordStatus(record.status)}
            </span>
            {health.value && (
              <span className="block truncate text-base-content/65">
                {health.label ? (
                  <span className="font-semibold text-base-content/80">
                    {health.label}:{" "}
                  </span>
                ) : null}
                <span>{health.value}</span>
              </span>
            )}
          </div>
        );
      },
    },
  ],
  pregnancy: [
    {
      id: "animal",
      header: "Animal",
      className: "p-3.5 pl-6",
      renderCell: (record) => (
        <span className="block text-sm font-extrabold leading-tight text-base-content">
          {getAnimalTag(record)}
        </span>
      ),
    },
    {
      id: "farmer",
      header: "Farmer",
      className: "p-3.5",
      renderCell: (record) => {
        const farmer = getFarmer(record);
        return (
          <div className="flex items-center gap-3">
            <UserAvatar
              name={farmer.name}
              imageUrl={farmer.image}
              size={36}
              sizeClass="h-9 w-9"
            />
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold text-base-content">
                {farmer.name}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "date",
      header: "Diagnosis Date",
      className: "p-3.5",
      renderCell: (record) => {
        const fields = getPregnancyFields(record);
        return (
          <span className="block font-bold leading-tight text-base-content">
            {formatDate(fields.date)}
          </span>
        );
      },
    },
    {
      id: "result",
      header: "Result",
      className: "p-3.5",
      renderCell: (record) => {
        const fields = getPregnancyFields(record);
        const result = getPregnancyResultPresentation(record);
        return (
          <span className="block font-bold leading-tight text-base-content">
            {result || fields.result || "Not recorded"}
          </span>
        );
      },
    },
    {
      id: "method",
      header: "Method",
      className: "p-3.5",
      renderCell: (record) => {
        const fields = getPregnancyFields(record);
        return (
          <span className="block truncate text-base-content/65">
            {formatDiagnosticMethod(fields.method)}
          </span>
        );
      },
    },
  ],
  calving: [
    {
      id: "animal",
      header: "Dam / Animal",
      className: "p-3.5 pl-6",
      renderCell: (record) => (
        <span className="block text-sm font-extrabold leading-tight text-base-content">
          {getAnimalTag(record)}
        </span>
      ),
    },
    {
      id: "farmer",
      header: "Farmer",
      className: "p-3.5",
      renderCell: (record) => {
        const farmer = getFarmer(record);
        return (
          <div className="flex items-center gap-3">
            <UserAvatar
              name={farmer.name}
              imageUrl={farmer.image}
              size={36}
              sizeClass="h-9 w-9"
            />
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold text-base-content">
                {farmer.name}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "date",
      header: "Calving Date",
      className: "p-3.5",
      renderCell: (record) => {
        const fields = getCalvingFields(record);
        return (
          <span className="block font-bold leading-tight text-base-content">
            {formatDate(fields.date)}
          </span>
        );
      },
    },
    {
      id: "outcome",
      header: "Outcome / Calf Info",
      className: "max-w-sm p-3.5",
      renderCell: (record) => {
        const fields = getCalvingFields(record);
        if (fields.numberOfCalves == null)
          return (
            <span className="block truncate text-base-content/65">
              Not recorded
            </span>
          );
        return (
          <div>
            <span className="block truncate text-base-content/65">
              {fields.numberOfCalves > 0
                ? `${fields.numberOfCalves} calf/calves`
                : "No calves recorded"}
            </span>
            {fields.calvingEase && (
              <span className="block text-[10px] text-base-content/50">
                Ease: {fields.calvingEase}
              </span>
            )}
          </div>
        );
      },
    },
  ],
};

const ACTION_COLUMN = {
  id: "action",
  header: "Actions",
  className: "w-36 p-3.5 pr-6 text-right",
  renderCell: (record, context) => {
    const actionLabel = getRecordActionLabel(record);

    return (
      <div
        className="flex items-center justify-end gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="btn btn-primary btn-sm rounded-xl hover:bg-primary/90 hover:border-none"
          onClick={() => context.openRecord(record)}
        >
          <Eye size={14} aria-hidden="true" />
          {actionLabel}
        </button>
      </div>
    );
  },
};

export default function TechnicianRecords() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || "",
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const type = searchParams.get("type") || "all";
  const search = searchParams.get("search") || "";
  const dateFilter = resolveRecordsDateFilter(searchParams);
  const { preset: datePreset, month, fromDate, toDate } = dateFilter;
  const periodLabel = datePreset === "all"
    ? "All time"
    : datePreset === "custom"
    ? `${formatDateOnlyLabel(fromDate)} – ${formatDateOnlyLabel(toDate)}`
    : datePreset === "select-month"
      ? formatMonthLabel(month)
      : datePreset === "last-30-days"
        ? `${formatDateOnlyLabel(fromDate)} – ${formatDateOnlyLabel(toDate)}`
        : formatMonthLabel(fromDate.slice(0, 7));
  const hasExplicitPeriod = datePreset !== "all";
  const hasActiveFilters = Boolean(
    type !== "all" || search || hasExplicitPeriod,
  );
  const selectedRecord = useMemo(() => {
    const animalId = searchParams.get("animalId");
    const recordKind = searchParams.get("recordKind");
    const recordId = searchParams.get("recordId");
    return animalId && recordKind && recordId
      ? { animalId, recordKind, recordId }
      : null;
  }, [searchParams]);

  const recordsQuery = useQuery({
    queryKey: [
      "technician",
      "official-records",
      page,
      type,
      search,
      fromDate,
      toDate,
    ],
    queryFn: async () => {
      const response = await axiosInstance.get("/animals/records", {
        params: {
          page,
          limit: PAGE_SIZE,
          ...(type !== "all" ? { type } : {}),
          ...(search ? { search } : {}),
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
        },
      });
      return response.data || {};
    },
    keepPreviousData: true,
  });

  const records = recordsQuery.data?.data || [];
  const total = recordsQuery.data?.total ?? records.length;
  const summary = recordsQuery.data?.summary || {
    all: total,
    insemination: type === "all" || type === "insemination" ? total : 0,
    health: type === "health" ? total : 0,
    pregnancy: type === "pregnancy" ? total : 0,
    calving: type === "calving" ? total : 0,
  };
  const totalPages = Math.max(
    1,
    recordsQuery.data?.totalPages || Math.ceil(total / PAGE_SIZE),
  );

  const updateParams = (next) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });
    setSearchParams(params);
  };

  const openRecord = (record) => {
    const animalId = record.animalId?._id || record.animalId?.id;
    if (!animalId || !record.id || !record.recordKind) return;
    updateParams({
      animalId,
      recordKind: record.recordKind,
      recordId: record.id,
    });
  };

  const closeRecord = () =>
    updateParams({ animalId: null, recordKind: null, recordId: null });

  const clearFilters = () => {
    setSearchInput("");
    updateParams({
      page: null,
      type: null,
      search: null,
      month: null,
      datePreset: null,
      fromDate: null,
      toDate: null,
    });
  };

  const handleDownloadReport = async () => {
    setIsDownloading(true);
    try {
      const response = await axiosInstance.get("/animals/records/export", {
        params: {
          ...(type !== "all" ? { type } : {}),
          ...(search ? { search } : {}),
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
        },
        responseType: "blob",
      });
      const disposition = response.headers?.["content-disposition"] || "";
      const fileName =
        disposition.match(/filename="?([^";]+)"?/i)?.[1] ||
        `BreedSmart-${type === "all" ? "Technician-Records" : `${getRecordTypeLabel(type).replace(/\s+/g, "-")}-Records`}-${fromDate?.slice(0, 10) || "all-dates"}.csv`;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = sanitizeFileName(fileName).replace(/\.csv$/i, "") + ".csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Unable to download the records report. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const metrics = [
    { value: "all", label: "All Records", count: summary.all, borderClass: "border-l-primary" },
    { value: "insemination", label: "Insemination", count: summary.insemination, borderClass: "border-l-secondary" },
    { value: "health", label: "Health", count: summary.health, borderClass: "border-l-success" },
    { value: "pregnancy", label: "Pregnancy", count: summary.pregnancy, borderClass: "border-l-warning" },
    { value: "calving", label: "Calving", count: summary.calving, borderClass: "border-l-info" },
  ];
  const selectedTypeLabel = getRecordTypeLabel(type);
  const emptyTitle = search
    ? "No completed records match your search."
    : type !== "all"
      ? `No ${selectedTypeLabel} records found for ${periodLabel}.`
      : datePreset === "this-month"
        ? "No records found this month."
      : hasExplicitPeriod
        ? `No records found for ${periodLabel}.`
        : "No completed records yet.";

  const activeColumns = [
    ...(COLUMNS_BY_TYPE[type] || COLUMNS_BY_TYPE.all),
    ACTION_COLUMN,
  ];
  const colSpanCount = activeColumns.length;

  return (
    <div className="flex min-h-screen flex-1 flex-col overflow-y-auto bg-base-200 text-base-content">
      <Topbar
        title="Records"
        subtitle="Official completed service records"
      />
      <main className="flex-1 space-y-5 p-4 md:p-6">
        <section
          className="grid grid-cols-2 gap-3 md:grid-cols-5"
          aria-label="Official record metrics"
        >
          {metrics.map((metric) => (
            <div
              key={metric.value}
              className={`card card-border border-l-4 bg-base-100 text-left shadow-sm ${metric.borderClass}`}
            >
              <span className="card-body gap-1 p-4">
                <span className="text-xs font-bold uppercase tracking-wide text-base-content/55">
                  {metric.label}
                </span>
                <span className="text-2xl font-black text-base-content">
                  {recordsQuery.isLoading ? "—" : metric.count}
                </span>
              </span>
            </div>
          ))}
        </section>

        <section className="card card-border bg-base-100 shadow-sm">
          <div className="card-body gap-4 p-4 md:p-5">
            <div className="flex flex-col gap-4">
              <form
                className="input w-full xl:max-w-md"
                onSubmit={(event) => {
                  event.preventDefault();
                  updateParams({ search: searchInput.trim(), page: 1 });
                }}
              >
                <Search size={16} className="text-base-content/45" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search animal, farmer, or record ID"
                  aria-label="Search finished activity"
                />
              </form>
              <div className="flex flex-wrap items-end gap-2">
                <label className="form-control w-full sm:w-48">
                  <span className="label-text mb-1 text-xs font-bold text-base-content/60">
                    Date
                  </span>
                  <select
                    className="select select-bordered w-full"
                    aria-label="Date"
                    value={datePreset}
                    onChange={(event) => {
                      const nextPreset = event.target.value;
                      const currentMonth = getCurrentManilaMonth();
                      const bounds = getMonthBounds(currentMonth);
                      updateParams({
                        datePreset: RECORDS_DATE_PRESETS.has(nextPreset) ? nextPreset : null,
                        month: nextPreset === "select-month" ? currentMonth : null,
                        fromDate: nextPreset === "custom" ? bounds.fromDate : null,
                        toDate: nextPreset === "custom" ? bounds.toDate : null,
                        page: 1,
                      });
                    }}
                  >
                    <option value="all">All time</option>
                    <option value="this-month">This month</option>
                    <option value="last-month">Last month</option>
                    <option value="last-30-days">Last 30 days</option>
                    <option value="select-month">Select month</option>
                    <option value="custom">Custom range</option>
                  </select>
                </label>
                {datePreset === "select-month" && (
                  <label className="form-control w-full sm:w-48">
                    <span className="label-text mb-1 text-xs font-bold text-base-content/60">
                      Month
                    </span>
                    <input
                      type="month"
                      className="input input-bordered w-full"
                      aria-label="Month"
                      value={month}
                      onChange={(event) =>
                        updateParams({ month: event.target.value, page: 1 })
                      }
                    />
                  </label>
                )}
                {datePreset === "custom" && (
                  <>
                    <label className="form-control w-full sm:w-40">
                      <span className="label-text mb-1 text-xs font-bold text-base-content/60">
                        From
                      </span>
                      <input
                        type="date"
                        className="input input-bordered w-full"
                        aria-label="From"
                        value={fromDate}
                        onChange={(event) => updateParams({ fromDate: event.target.value, page: 1 })}
                      />
                    </label>
                    <label className="form-control w-full sm:w-40">
                      <span className="label-text mb-1 text-xs font-bold text-base-content/60">
                        To
                      </span>
                      <input
                        type="date"
                        className="input input-bordered w-full"
                        aria-label="To"
                        value={toDate}
                        onChange={(event) => updateParams({ toDate: event.target.value, page: 1 })}
                      />
                    </label>
                  </>
                )}
                <select
                  className="select select-bordered w-full sm:w-48"
                  aria-label="Filter records by type"
                  value={type}
                  onChange={(event) =>
                    updateParams({
                      type: event.target.value,
                      page: 1,
                    })
                  }
                >
                  {RECORD_FILTERS.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-outline gap-2"
                  disabled={isDownloading}
                  onClick={handleDownloadReport}
                >
                  <Download size={15} aria-hidden="true" />
                  {isDownloading ? "Preparing..." : "Download report"}
                </button>
              </div>
              {hasActiveFilters && (
                <div className="flex justify-end">
                  <button type="button" className="btn btn-ghost btn-xs" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-box border border-base-300">
              <table
                className="table table-pin-rows w-full min-w-215 text-left"
                aria-label="Technician finished activity"
              >
                <thead>
                  <tr className="border-b border-base-300 bg-base-200 text-[11px] font-bold uppercase tracking-wider text-base-content/60">
                    {activeColumns.map((col) => (
                      <th key={col.id} className={col.className}>
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-300 text-xs font-semibold text-base-content/85">
                  {recordsQuery.isLoading ? (
                    [0, 1, 2, 3, 4].map((row) => (
                      <tr key={row}>
                        <td colSpan={colSpanCount}>
                          <div
                            className="grid gap-5 py-1"
                            style={{
                              gridTemplateColumns: activeColumns
                                .map(() => "1fr")
                                .join(" "),
                            }}
                          >
                            {activeColumns.map((col) => (
                              <span key={col.id} className="skeleton h-4" />
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : recordsQuery.isError ? (
                    <tr>
                      <td colSpan={colSpanCount} className="p-6">
                        <div role="alert" className="alert alert-error alert-soft flex-wrap justify-between gap-3">
                          <span>Unable to load records.</span>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => recordsQuery.refetch()}
                          >
                            Retry
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td
                        colSpan={colSpanCount}
                        className="p-12 text-center text-base-content/50"
                      >
                        <FileText
                          size={28}
                          className="mx-auto mb-3 text-base-content/35"
                        />
                        <p className="font-bold text-base-content">
                          {emptyTitle}
                        </p>
                        <p className="mt-1 font-medium">
                          Official completed service records will appear here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => (
                      <tr
                        key={
                          String(record.recordKind) + "-" + String(record.id)
                        }
                        className="transition-colors hover:bg-base-200/50"
                      >
                        {activeColumns.map((col) => (
                          <td key={col.id} className={col.className}>
                            {col.renderCell(record, { openRecord })}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!recordsQuery.isError && totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-base-300 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-base-content/55">
                  Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
                  {Math.min(page * PAGE_SIZE, total)} of {total}
                </span>
                <nav
                  className="join self-end sm:self-auto"
                  aria-label="Records pagination"
                >
                  <button
                    type="button"
                    className="join-item btn btn-sm"
                    aria-label="Previous records page"
                    disabled={page <= 1}
                    onClick={() => updateParams({ page: page - 1 })}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="join-item btn btn-sm btn-disabled">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="join-item btn btn-sm"
                    aria-label="Next records page"
                    disabled={page >= totalPages}
                    onClick={() => updateParams({ page: page + 1 })}
                  >
                    <ChevronRight size={16} />
                  </button>
                </nav>
              </div>
            )}
          </div>
        </section>
      </main>

      <OfficialRecordDetailModal
        recordIdentity={selectedRecord}
        onClose={closeRecord}
      />
    </div>
  );
}
