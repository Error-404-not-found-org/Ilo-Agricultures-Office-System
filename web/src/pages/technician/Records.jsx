import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileText, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/layout/Topbar";
import OfficialRecordDetailModal from "../../components/technician/OfficialRecordDetailModal";
import UserAvatar from "../../components/ui/UserAvatar";

const PAGE_SIZE = 10;

const RECORD_FILTERS = [
  { value: "all", label: "All records" },
  { value: "insemination", label: "Insemination" },
  { value: "health", label: "Health" },
  { value: "pregnancy", label: "Pregnancy" },
  { value: "calving", label: "Calving" },
];

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
  method: record.source?.pregnancyDiagnosis?.checkMethod,
});

const getCalvingFields = (record) => ({
  date: record.source?.date || record.recordDate,
  numberOfCalves:
    record.source?.numberOfCalves ?? record.source?.calves?.length,
  calvingEase: record.source?.calvingEase,
});

// --- Dynamic Column Definitions ---
const COLUMNS_BY_TYPE = {
  all: [
    {
      id: "type",
      header: "Type",
      className: "p-3.5 pl-6",
      renderCell: (record) => (
        <span
          className={`badge badge-sm rounded-full text-[9px] font-bold uppercase tracking-wider ${categoryBadgeClass(record.category)}`}
        >
          {record.category === "AI"
            ? "Insemination"
            : record.category || "Record"}
        </span>
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
      renderCell: (record) => (
        <span className="block truncate text-base-content/65">
          {record.summary || "Completed official record"}
        </span>
      ),
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
      header: "AI Date",
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
      header: "Sire",
      className: "p-3.5",
      renderCell: (record) => {
        const fields = getInseminationFields(record);
        return (
          <span className="block text-sm text-base-content/75">
            {fields.sireBreed || "Not recorded"}
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
            {fields.attemptNumber
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
        return (
          <span className="block truncate text-base-content/65">
            {fields.outcome || "Not recorded"}
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
        const fields = getHealthFields(record);
        return (
          <span className="block truncate text-base-content/65">
            {fields.treatment || "Not recorded"}
          </span>
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
        return (
          <span className="block font-bold leading-tight text-base-content">
            {fields.result || "Not recorded"}
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
            {fields.method || "Not recorded"}
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
  className: "w-30 p-3.5 pr-6 text-right",
  renderCell: (record, context) => (
    <div className="flex items-center justify-end">
      <button
        type="button"
        className="btn btn-primary btn-sm rounded-xl hover:bg-primary/90 hover:border-none"
        onClick={() => context.openRecord(record)}
      >
        View record
      </button>
    </div>
  ),
};

export default function TechnicianRecords() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || "",
  );
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const type = searchParams.get("type") || "all";
  const search = searchParams.get("search") || "";
  const selectedRecord = useMemo(() => {
    const animalId = searchParams.get("animalId");
    const recordKind = searchParams.get("recordKind");
    const recordId = searchParams.get("recordId");
    return animalId && recordKind && recordId
      ? { animalId, recordKind, recordId }
      : null;
  }, [searchParams]);

  const recordsQuery = useQuery({
    queryKey: ["technician", "official-records", page, type, search],
    queryFn: async () => {
      const response = await axiosInstance.get("/animals/records", {
        params: {
          page,
          limit: PAGE_SIZE,
          ...(type !== "all" ? { type } : {}),
          ...(search ? { search } : {}),
        },
      });
      return response.data || {};
    },
    keepPreviousData: true,
  });

  const records = recordsQuery.data?.data || [];
  const total = recordsQuery.data?.total ?? records.length;
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

  const activeColumns = [
    ...(COLUMNS_BY_TYPE[type] || COLUMNS_BY_TYPE.all),
    ACTION_COLUMN,
  ];
  const colSpanCount = activeColumns.length;

  return (
    <div className="flex min-h-screen flex-1 flex-col overflow-y-auto bg-base-200 text-base-content">
      <Topbar
        title="Records"
        subtitle="Completed AI, Health, Pregnancy, and Calving records"
      />
      <main className="flex-1 space-y-5 p-4 md:p-6">
        <section className="card card-border bg-base-100 shadow-sm">
          <div className="card-body gap-4 p-4 md:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
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
                  placeholder="Search animal, farmer, service, or technician"
                  aria-label="Search official records"
                />
              </form>
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <select
                  className="select select-bordered w-full sm:w-48"
                  aria-label="Filter official records by type"
                  value={type}
                  onChange={(event) =>
                    updateParams({ type: event.target.value, page: 1 })
                  }
                >
                  {RECORD_FILTERS.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-base-content/60">
                  {recordsQuery.isFetching && !recordsQuery.isLoading
                    ? "Updating..."
                    : `${total} ${total === 1 ? "official record" : "official records"}`}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-box border border-base-300">
              <table
                className="table table-pin-rows w-full min-w-215 text-left"
                aria-label="Technician official records"
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
                        <div
                          role="alert"
                          className="alert alert-error alert-soft"
                        >
                          Records could not be loaded. Please try again.
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
                          No completed records found
                        </p>
                        <p className="mt-1 font-medium">
                          Completed official service records will appear here.
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
                  aria-label="Official record pagination"
                >
                  <button
                    type="button"
                    className="join-item btn btn-sm"
                    aria-label="Previous official records page"
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
                    aria-label="Next official records page"
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
