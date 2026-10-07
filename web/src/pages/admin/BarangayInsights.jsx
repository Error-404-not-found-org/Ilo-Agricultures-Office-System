import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ClipboardList, HeartPulse, MapPin, PawPrint, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import Topbar from "../../components/layout/Topbar";
import { ui } from "../../components/ui/uiClasses";
import axiosInstance from "../../lib/axios";
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

export default function BarangayInsights() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(null);
  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "barangay-insights"],
    queryFn: async () => {
      const response = await axiosInstance.get("/admin/barangays/insights");
      if (!Array.isArray(response.data)) {
        throw new Error("Invalid Barangay Insights response");
      }
      return response.data.map(mapBarangayInsight);
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
    () => {
      const pendingAI = sumBarangayMetric(allBarangays, "pendingAIRequests");
      const pendingHealth = sumBarangayMetric(allBarangays, "pendingHealthRequests");
      return {
        barangays: allBarangays.length,
        farmers: sumBarangayMetric(allBarangays, "farmersCount"),
        animals: sumBarangayMetric(allBarangays, "animalsCount"),
        pendingRequests: pendingAI === null || pendingHealth === null
          ? null
          : pendingAI + pendingHealth,
      };
    },
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
        title="Barangay Management"
        subtitle="Registered Farmers, livestock, and pending service requests by barangay"
      />

      <main className="p-4 md:p-6 space-y-5 flex-1 min-h-0 pb-10">
        {selectedBarangay && !error ? (
          <BarangayDetail
            item={selectedBarangay}
            onBack={() => setSelectedBarangay(null)}
          />
        ) : (
          <>
            <section
          aria-label="Barangay summary"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <MetricCard
            label="Barangays with Records"
            value={error ? null : summary.barangays}
            loading={isLoading}
            icon={MapPin}
            accent="primary"
          />
          <MetricCard
            label="Farmers"
            value={error ? null : summary.farmers}
            loading={isLoading}
            icon={Users}
            accent="success"
          />
          <MetricCard
            label="Animals"
            value={error ? null : summary.animals}
            loading={isLoading}
            icon={PawPrint}
            accent="info"
          />
          <MetricCard
            label="Pending Requests"
            value={error ? null : summary.pendingRequests}
            loading={isLoading}
            icon={ClipboardList}
            accent="warning"
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
                Barangays
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
                    <th scope="col">Action</th>
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
                        <td><div className="skeleton h-5 w-full" /></td>
                      </tr>
                    ))
                  ) : barangays.length === 0 ? (
                    <tr>
                      <td
                        colSpan={SORTABLE_COLUMNS.length + 1}
                        className="py-10 text-center text-sm font-medium text-base-content/65"
                      >
                        {search.trim()
                          ? "No barangays match your search."
                          : "No barangay records are available."}
                      </td>
                    </tr>
                  ) : (
                    barangays.map((item) => (
                      <tr key={`${item.municipality}-${item.district}-${item.name}`}>
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
                        <td>
                          <button
                            type="button"
                            className="btn btn-info btn-sm"
                            aria-label={`View Summary for ${item.name}`}
                            onClick={() => setSelectedBarangay(item)}
                          >
                            View Summary
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

const BarangayDetail = ({ item, onBack }) => {
  const location = item.municipality
    ? [item.district, item.municipality].filter(Boolean).join(", ")
    : "Location not available";
  const metrics = [
    ["Farmers", item.farmersCount, Users, "success"],
    ["Animals", item.animalsCount, PawPrint, "info"],
    ["Pending AI", item.pendingAIRequests, ClipboardList, "warning"],
    ["Pending Health", item.pendingHealthRequests, HeartPulse, "primary"],
  ];

  return (
    <section aria-label="Barangay detail" className="space-y-4">
      <button type="button" onClick={onBack} className="btn btn-ghost btn-sm">
        Back to Barangays
      </button>
      <div>
        <h2 className="text-xl font-semibold text-base-content">{item.name}</h2>
        <p className="mt-1 text-sm text-base-content/70">{location}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {metrics.map(([label, value, icon, accent]) => (
          <MetricCard key={label} label={label} value={value} icon={icon} accent={accent} />
        ))}
      </div>
    </section>
  );
};

const accents = {
  primary: { border: "border-primary", icon: "text-primary bg-primary/10" },
  success: { border: "border-success", icon: "text-success bg-success/10" },
  info: { border: "border-info", icon: "text-info bg-info/10" },
  warning: { border: "border-warning", icon: "text-warning bg-warning/10" },
};

const MetricCard = ({ label, value, loading = false, icon: Icon, accent }) => (
  <div className={`${ui.metricCard} border-0 border-l-4 ${accents[accent].border} shadow-sm`}>
    <div className={`p-2.5 rounded-xl shrink-0 ${accents[accent].icon}`}>
      <Icon size={16} aria-hidden="true" />
    </div>
    <div className="min-w-0">
      {loading ? (
        <div className="skeleton h-6 w-20" aria-label={`Loading ${label}`} />
      ) : (
        <div className="text-xl font-black text-base-content">{formatBarangayMetric(value)}</div>
      )}
      <div className="text-[10px] font-bold uppercase text-base-content/80 tracking-wider">
        {label}
      </div>
    </div>
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
