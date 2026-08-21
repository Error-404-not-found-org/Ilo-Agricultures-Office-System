import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import {
  MapPin,
  Search,
  Users,
  Beef,
  Activity,
  SlidersHorizontal,
  Download,
  AlertCircle,
  RefreshCw,
  X,
  ExternalLink,
  Syringe,
  HeartPulse,
} from "lucide-react";
import Topbar from "../../components/layout/Topbar";
import { ui } from "../../components/ui/uiClasses";
import {
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
  getIloiloBarangayOptions,
} from "../../utils/addressOptions";
import { MUNICIPALITY_BARANGAYS } from "../../constants/barangays";

const getMunicipalityForBarangay = (brgyName) => {
  if (!brgyName) return "Oton, Iloilo";

  const cleanName = brgyName.split(" (")[0].trim().toLowerCase();

  for (const [mun, list] of Object.entries(MUNICIPALITY_BARANGAYS)) {
    const found = list.some(
      (b) =>
        b.toLowerCase() === cleanName || b.toLowerCase().includes(cleanName)
    );
    if (found) {
      return `${mun}, Iloilo`;
    }
  }

  if (brgyName.includes("(") && brgyName.includes(")")) {
    const match = brgyName.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      const district = match[1].trim();
      const capitalizedDistrict =
        district.charAt(0).toUpperCase() + district.slice(1);
      return `${capitalizedDistrict}, Iloilo City`;
    }
  }

  return "Oton, Iloilo";
};

function MetricCard({ icon, value, label, note }) {
  return (
    <div className="stats border border-base-300 bg-base-100 shadow-sm">
      <div className="stat py-4">
        <div className="stat-figure hidden text-primary sm:block">{icon}</div>
        <div className="stat-title text-xs font-semibold">{label}</div>
        <div className="stat-value text-2xl">{value}</div>
        <div className="stat-desc text-base-content/70">{note}</div>
      </div>
    </div>
  );
}

const FILTER_CHIPS = [
  { id: "all", label: "All Barangays" },
  { id: "high_activity", label: "High Activity" },
  { id: "needs_attention", label: "Needs Attention" },
  { id: "high_density", label: "High Animal Density" },
];

export default function BarangayInsights() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeChip, setActiveChip] = useState("all");
  const [municipalityFilter, setMunicipalityFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "barangay-insights"],
    queryFn: async () => {
      const res = await axiosInstance.get("/admin/barangays/insights");
      return res.data?.data || res.data || [];
    },
  });

  const rawBarangays = useMemo(() => {
    return Array.isArray(data) ? data : data?.barangays || [];
  }, [data]);

  const barangays = useMemo(() => {
    return rawBarangays
      .map((item) => {
        const name =
          item.name || item.barangay || item._id || "Unnamed Barangay";
        const farmers = item.farmers || item.farmerCount || 0;
        const animals = item.animals || item.animalCount || 0;
        const healthCases =
          item.healthRequests || item.healthCount || item.pendingHealthRequests || 0;
        const aiRequests =
          item.aiRequests || item.aiCount || item.pendingAIRequests || 0;
        const totalCases = healthCases + aiRequests;
        const municipality = getMunicipalityForBarangay(name);
        const techs = Array.isArray(item.technicians) ? item.technicians : [];

        // Determine health risk status
        let status = item.status || "healthy";
        if (totalCases >= 5 || healthCases >= 3) {
          status = "needs_attention";
        } else if (animals >= 20 || farmers >= 10) {
          status = "high_activity";
        }

        return {
          id: name,
          name,
          municipality,
          farmers,
          animals,
          healthCases,
          aiRequests,
          totalCases,
          technicians: techs,
          status,
        };
      })
      .filter((b) => {
        const matchesSearch =
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.municipality.toLowerCase().includes(search.toLowerCase());

        const matchesMunicipality =
          !municipalityFilter ||
          b.municipality
            .toLowerCase()
            .includes(municipalityFilter.toLowerCase());

        let matchesChip = true;
        if (activeChip === "high_activity") {
          matchesChip = b.totalCases > 0 || b.animals >= 10;
        } else if (activeChip === "needs_attention") {
          matchesChip =
            b.status === "needs_attention" || b.healthCases > 0;
        } else if (activeChip === "high_density") {
          matchesChip = b.animals >= 15;
        }

        return matchesSearch && matchesMunicipality && matchesChip;
      });
  }, [rawBarangays, search, municipalityFilter, activeChip]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalBarangays = rawBarangays.length;
    const totalAnimals = rawBarangays.reduce(
      (sum, b) => sum + (b.animals || b.animalCount || 0),
      0
    );
    const totalFarmers = rawBarangays.reduce(
      (sum, b) => sum + (b.farmers || b.farmerCount || 0),
      0
    );
    const totalCases = rawBarangays.reduce(
      (sum, b) =>
        sum +
        (b.healthRequests ||
          b.healthCount ||
          b.pendingHealthRequests ||
          0) +
        (b.aiRequests || b.aiCount || b.pendingAIRequests || 0),
      0
    );

    return {
      totalBarangays,
      totalAnimals,
      totalFarmers,
      totalCases,
    };
  }, [rawBarangays]);

  const hasFilters = Boolean(
    search || municipalityFilter || activeChip !== "all"
  );

  const clearFilters = () => {
    setSearch("");
    setMunicipalityFilter("");
    setDistrictFilter("");
    setActiveChip("all");
  };

  const exportReport = () => {
    const rows = barangays.map((b) => [
      b.name,
      b.municipality,
      b.farmers,
      b.animals,
      b.healthCases,
      b.aiRequests,
      b.technicians.length,
      b.status.replace("_", " ").toUpperCase(),
    ]);
    const csv = [
      [
        "Barangay Name",
        "Municipality",
        "Farmers",
        "Livestock",
        "Health Cases",
        "AI Requests",
        "Assigned Technicians",
        "Operational Status",
      ],
      ...rows,
    ]
      .map((row) =>
        row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `BreedSmart_Barangay_Insights_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={ui.page}>
      <Topbar
        title="Barangay Insights & Telemetry"
        subtitle="Municipal livestock population, farmer density, service demand, and health visibility by sector"
      />

      <main className={ui.main}>
        {/* Dynamic Metric Ribbon */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            icon={<MapPin size={21} />}
            value={isLoading ? "—" : stats.totalBarangays}
            label="Monitored Sectors"
            note="Barangay registries"
          />
          <MetricCard
            icon={<Beef size={21} />}
            value={isLoading ? "—" : stats.totalAnimals}
            label="Total Livestock"
            note="Across all sectors"
          />
          <MetricCard
            icon={<Users size={21} />}
            value={isLoading ? "—" : stats.totalFarmers}
            label="Registered Farmers"
            note="Enrolled agricultural clients"
          />
          <MetricCard
            icon={<Activity size={21} />}
            value={isLoading ? "—" : stats.totalCases}
            label="Active Service Cases"
            note="Health & AI field tasks"
          />
        </section>

        {/* Datatable & Filters Platform Wrapper */}
        <section className="card card-border bg-base-100 shadow-sm">
          <div className="card-body gap-4 p-4 md:p-5">
            {/* Top Action Bar */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <label className="input w-full xl:max-w-md">
                <Search size={16} className="text-base-content/45" />
                <input
                  type="search"
                  aria-label="Search barangays"
                  placeholder="Search barangay or municipality..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={exportReport}
                  disabled={isLoading || barangays.length === 0}
                >
                  <Download size={15} /> Export Insights
                </button>
                <span className="text-sm font-medium text-base-content/70">
                  {isFetching && !isLoading
                    ? "Updating…"
                    : `${barangays.length} barangay${
                        barangays.length === 1 ? "" : "s"
                      }`}
                </span>
              </div>
            </div>

            {/* Standardized Filter Ribbon */}
            <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-3 md:flex-row md:flex-wrap md:items-center">
              <span className="flex items-center gap-1.5 text-sm font-bold text-base-content/75">
                <SlidersHorizontal size={14} /> Filters
              </span>

              {/* Municipality Filter */}
              <select
                className="select select-sm w-full md:w-auto"
                aria-label="Filter by municipality"
                value={municipalityFilter}
                onChange={(e) => setMunicipalityFilter(e.target.value)}
              >
                <option value="">All Municipalities</option>
                {ILOILO_MUNICIPALITY_OPTIONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Quick Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 ml-1">
                {FILTER_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setActiveChip(chip.id)}
                    className={`btn btn-xs rounded-full font-bold transition-all ${
                      activeChip === chip.id
                        ? "btn-primary shadow-xs"
                        : "btn-ghost bg-base-100 hover:bg-base-300 text-base-content/70"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {hasFilters && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm md:ml-auto"
                  onClick={clearFilters}
                >
                  <X size={14} /> Clear filters
                </button>
              )}
            </div>

            {/* Content States */}
            {isError ? (
              <div role="alert" className="alert alert-error">
                <AlertCircle size={18} />
                <div>
                  <div className="font-bold">
                    Barangay insights could not be loaded.
                  </div>
                  <div className="text-sm">
                    {error?.response?.data?.message ||
                      error?.message ||
                      "Check the server or your connection."}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => refetch()}
                >
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            ) : isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[0, 1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="skeleton h-44 rounded-2xl w-full" />
                ))}
              </div>
            ) : barangays.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 px-5 py-12 text-center">
                <MapPin className="mx-auto mb-3 text-base-content/35" />
                <h2 className="font-bold">No barangay insights found</h2>
                <p className="mt-1 text-sm text-base-content/60">
                  {hasFilters
                    ? "Try changing or clearing the search query and filters."
                    : "Barangay registry records will appear here."}
                </p>
                {hasFilters && (
                  <button
                    type="button"
                    className="btn btn-sm mt-4"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {barangays.map((item) => {
                  const isAttention = item.status === "needs_attention";

                  return (
                    <article
                      key={item.id}
                      className="card card-border bg-base-100 shadow-sm hover:shadow-md transition-all border border-base-300"
                    >
                      <div className="card-body p-5 gap-4">
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-black text-base text-base-content truncate">
                              {item.name}
                            </h3>
                            <p className="text-xs text-base-content/60 mt-0.5 flex items-center gap-1">
                              <MapPin size={13} className="shrink-0 text-primary" />
                              <span className="truncate">{item.municipality}</span>
                            </p>
                          </div>
                          <span
                            className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] ${
                              isAttention ? "badge-warning" : "badge-success"
                            }`}
                          >
                            {isAttention ? "Needs Attention" : "Healthy Sector"}
                          </span>
                        </div>

                        {/* Metric Grid */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-base-200 p-2.5 text-center border border-base-300">
                            <p className="text-[9px] font-extrabold uppercase tracking-wider text-base-content/60">
                              Farmers
                            </p>
                            <p className="text-base font-black text-base-content mt-0.5">
                              {item.farmers}
                            </p>
                          </div>
                          <div className="rounded-xl bg-base-200 p-2.5 text-center border border-base-300">
                            <p className="text-[9px] font-extrabold uppercase tracking-wider text-base-content/60">
                              Livestock
                            </p>
                            <p className="text-base font-black text-primary mt-0.5">
                              {item.animals}
                            </p>
                          </div>
                          <div className="rounded-xl bg-base-200 p-2.5 text-center border border-base-300">
                            <p className="text-[9px] font-extrabold uppercase tracking-wider text-base-content/60">
                              Cases
                            </p>
                            <p
                              className={`text-base font-black mt-0.5 ${
                                item.totalCases > 0
                                  ? "text-warning"
                                  : "text-base-content"
                              }`}
                            >
                              {item.totalCases}
                            </p>
                          </div>
                        </div>

                        {/* Telemetry Breakdown */}
                        <div className="flex items-center justify-between text-[11px] text-base-content/65 border-t border-base-300 pt-3">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 font-medium">
                              <HeartPulse size={13} className="text-rose-500" />
                              {item.healthCases} Health
                            </span>
                            <span className="flex items-center gap-1 font-medium">
                              <Syringe size={13} className="text-blue-500" />
                              {item.aiRequests} AI
                            </span>
                          </div>
                          {item.technicians.length > 0 ? (
                            <span className="font-semibold text-primary flex items-center gap-1">
                              <Users size={12} /> {item.technicians.length} Officer
                              {item.technicians.length === 1 ? "" : "s"}
                            </span>
                          ) : (
                            <span className="text-base-content/40">
                              Unassigned
                            </span>
                          )}
                        </div>

                        {/* Quick Drilldown Actions */}
                        <div className="card-actions grid grid-cols-2 border-t border-base-300 pt-3">
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost text-primary justify-start"
                            onClick={() =>
                              navigate(
                                `/admin/livestock?barangay=${encodeURIComponent(
                                  item.name
                                )}`
                              )
                            }
                          >
                            <Beef size={13} /> View Animals
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost text-base-content/70 justify-end"
                            onClick={() =>
                              navigate(
                                `/admin/users?barangay=${encodeURIComponent(
                                  item.name
                                )}`
                              )
                            }
                          >
                            <ExternalLink size={13} /> View Farmers
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
