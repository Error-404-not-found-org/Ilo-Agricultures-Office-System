import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import Topbar from "../../components/layout/Topbar";
import axiosInstance from "../../lib/axios";
import { MUNICIPALITY_BARANGAYS } from "../../constants/barangays";
import {
  formatBarangayMetric,
  getDefaultBarangaySort,
  mapBarangayInsight,
  sortBarangayInsights,
  sumBarangayMetric,
} from "./barangayInsightsPresentation";

const SORTABLE_COLUMNS = [
  { key: "name", label: "Barangay", align: "text-left" },
  { key: "farmersCount", label: "Farmers", align: "text-right" },
  { key: "animalsCount", label: "Animals", align: "text-right" },
  {
    key: "pendingHealthRequests",
    label: "Pending Health",
    align: "text-right",
  },
  { key: "pendingAIRequests", label: "Pending AI", align: "text-right" },
];

const getMunicipalityForBarangay = (brgyName) => {
  if (!brgyName) return "Oton, Iloilo";

  const cleanName = brgyName.split(" (")[0].trim().toLowerCase();

  for (const [municipality, list] of Object.entries(MUNICIPALITY_BARANGAYS)) {
    const found = list.some(
      (barangay) =>
        barangay.toLowerCase() === cleanName ||
        barangay.toLowerCase().includes(cleanName),
    );
    if (found) return `${municipality}, Iloilo`;
  }

  if (brgyName.includes("(") && brgyName.includes(")")) {
    const match = brgyName.match(/\(([^)]+)\)/);
    if (match?.[1]) {
      const district = match[1].trim();
      return `${district.charAt(0).toUpperCase() + district.slice(1)}, Iloilo City`;
    }
  }

  return "Oton, Iloilo";
};

export default function BarangayInsights() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "barangay-insights"],
    queryFn: async () => {
      const response = await axiosInstance.get("/admin/barangays/insights");
      if (!Array.isArray(response.data)) {
        throw new Error("Invalid Barangay Insights response");
      }
      return response.data.map((item) =>
        mapBarangayInsight(item, getMunicipalityForBarangay),
      );
    },
  });

  const allBarangays = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const effectiveSort = sort || getDefaultBarangaySort(allBarangays);
  const barangays = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = normalizedSearch
      ? allBarangays.filter((item) =>
          item.name.toLowerCase().includes(normalizedSearch),
        )
      : allBarangays;

    return sortBarangayInsights(filtered, effectiveSort);
  }, [allBarangays, effectiveSort, search]);

  const summary = useMemo(
    () => ({
      barangays: allBarangays.length,
      farmers: sumBarangayMetric(allBarangays, "farmersCount"),
      animals: sumBarangayMetric(allBarangays, "animalsCount"),
      pendingHealth: sumBarangayMetric(allBarangays, "pendingHealthRequests"),
    }),
    [allBarangays],
  );

  const handleSort = (key) => {
    setSort((current) => {
      const active = current || getDefaultBarangaySort(allBarangays);
      if (active.key === key) {
        return {
          key,
          direction: active.direction === "asc" ? "desc" : "asc",
        };
      }
      return {
        key,
        direction: key === "name" ? "asc" : "desc",
      };
    });
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
      <Topbar
        title="Barangay Insights"
        subtitle="Municipal livestock, farmers, and service visibility by barangay"
      />

      <main className="p-4 md:p-6 space-y-5 flex-1 min-h-0 pb-10">
        <section
          aria-label="Barangay summary"
          className="stats stats-vertical sm:stats-horizontal w-full border border-base-300 bg-base-100 shadow-sm"
        >
          <SummaryStat
            label="Total Barangays"
            value={isLoading ? null : summary.barangays}
            loading={isLoading}
          />
          <SummaryStat
            label="Total Farmers"
            value={summary.farmers}
            loading={isLoading}
          />
          <SummaryStat
            label="Total Animals"
            value={summary.animals}
            loading={isLoading}
          />
          <SummaryStat
            label="Pending Health Requests"
            value={summary.pendingHealth}
            loading={isLoading}
          />
        </section>

        <section
          aria-labelledby="barangay-table-heading"
          className="overflow-hidden rounded-box border border-base-300 bg-base-100"
        >
          <div className="flex flex-col gap-3 border-b border-base-300 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="barangay-table-heading"
                className="text-lg font-semibold text-base-content"
              >
                Barangay comparison
              </h2>
              <p className="mt-0.5 text-sm text-base-content/70">
                Compare registered livestock and pending service requests.
              </p>
            </div>

            <label className="input input-sm w-full sm:max-w-sm">
              <Search
                size={16}
                className="shrink-0 text-base-content/60"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search barangay..."
                aria-label="Search barangays"
                className="grow placeholder:text-base-content/60"
              />
            </label>
          </div>

          {error ? (
            <div className="p-4">
              <div role="alert" className="alert alert-error alert-soft">
                <span className="text-sm font-semibold">
                  Failed to load barangay insights.
                </span>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="btn btn-sm"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm table-pin-rows min-w-180">
                <thead>
                  <tr>
                    {SORTABLE_COLUMNS.map((column) => (
                      <SortableHeader
                        key={column.key}
                        column={column}
                        sort={effectiveSort}
                        onSort={handleSort}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index} aria-label="Loading barangay insights">
                        {SORTABLE_COLUMNS.map((column) => (
                          <td key={column.key}>
                            <div className="skeleton h-5 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : barangays.length === 0 ? (
                    <tr>
                      <td
                        colSpan={SORTABLE_COLUMNS.length}
                        className="py-10 text-center text-sm font-medium text-base-content/65"
                      >
                        {search.trim()
                          ? "No barangays match your search."
                          : "No barangay records are available."}
                      </td>
                    </tr>
                  ) : (
                    barangays.map((item) => (
                      <tr key={`${item.municipality}-${item.name}`}>
                        <th
                          scope="row"
                          className="font-semibold text-base-content"
                        >
                          {item.name}
                        </th>
                        <MetricCell value={item.farmersCount} />
                        <MetricCell value={item.animalsCount} />
                        <MetricCell value={item.pendingHealthRequests} />
                        <MetricCell value={item.pendingAIRequests} />
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const SummaryStat = ({ label, value, loading }) => (
  <div className="stat px-4 py-3.5">
    <p className="stat-title text-sm font-medium text-base-content/70">
      {label}
    </p>
    {loading ? (
      <div className="skeleton mt-2 h-7 w-20" aria-label={`Loading ${label}`} />
    ) : (
      <p className="stat-value mt-1 text-2xl font-bold text-base-content">
        {formatBarangayMetric(value)}
      </p>
    )}
  </div>
);

const SortableHeader = ({ column, sort, onSort }) => {
  const isActive = sort.key === column.key;
  const ariaSort = isActive
    ? sort.direction === "asc"
      ? "ascending"
      : "descending"
    : "none";
  const SortIcon = !isActive
    ? ArrowUpDown
    : sort.direction === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <th scope="col" aria-sort={ariaSort} className={column.align}>
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className={`btn btn-ghost btn-xs min-h-8 gap-1.5 font-semibold ${column.align === "text-right" ? "ml-auto" : ""}`}
        aria-label={`Sort by ${column.label}`}
      >
        {column.label}
        <SortIcon
          size={14}
          aria-hidden="true"
          className={isActive ? "text-primary" : "text-base-content/45"}
        />
      </button>
    </th>
  );
};

const MetricCell = ({ value }) => (
  <td className="text-right tabular-nums text-base-content/80">
    {formatBarangayMetric(value)}
  </td>
);
