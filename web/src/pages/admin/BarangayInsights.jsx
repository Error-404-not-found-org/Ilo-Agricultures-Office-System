import { useQuery } from "@tanstack/react-query";
import { MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import Topbar from "../../components/layout/Topbar";
import axiosInstance from "../../lib/axios";
import { MUNICIPALITY_BARANGAYS } from "../../constants/barangays";
import {
  formatBarangayMetric,
  formatBarangayPercentage,
  getBarangayStatusPresentation,
  mapBarangayInsight,
} from "./barangayInsightsPresentation";

const getMunicipalityForBarangay = (brgyName) => {
  if (!brgyName) return "Oton, Iloilo";

  // Clean the name (e.g. if it has suffix like "Fajardo (Jaro)")
  const cleanName = brgyName.split(" (")[0].trim().toLowerCase();

  // Check each municipality in MUNICIPALITY_BARANGAYS
  for (const [mun, list] of Object.entries(MUNICIPALITY_BARANGAYS)) {
    const found = list.some(
      (b) =>
        b.toLowerCase() === cleanName || b.toLowerCase().includes(cleanName),
    );
    if (found) {
      return `${mun}, Iloilo`;
    }
  }

  // Special check if it contains a district in parentheses (e.g. "Fajardo (Jaro)")
  if (brgyName.includes("(") && brgyName.includes(")")) {
    const match = brgyName.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      const district = match[1].trim();
      const capitalizedDistrict =
        district.charAt(0).toUpperCase() + district.slice(1);
      return `${capitalizedDistrict}, Iloilo City`;
    }
  }

  return "Oton, Iloilo"; // Default fallback
};

export default function BarangayInsights() {
  const [search, setSearch] = useState("");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "barangay-insights"],
    queryFn: async () => {
      const res = await axiosInstance.get("/admin/barangays/insights");
      if (!Array.isArray(res.data)) {
        throw new Error("Invalid Barangay Insights response");
      }
      return res.data.map((item) =>
        mapBarangayInsight(item, getMunicipalityForBarangay),
      );
    },
  });

  const barangays = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    return list.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [data, search]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
      <Topbar
        title="Barangay Insights"
        subtitle="Municipal livestock, farmer, and service visibility by barangay"
      />

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        <div className="bg-base-100 border border-base-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-base-content/80">
              Barangay coverage
            </p>
            <p className="text-2xl font-black text-base-content">
              {isLoading ? "..." : barangays.length}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/80"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search barangay..."
              aria-label="Search barangays"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-base-300 bg-base-200 outline-none focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all shadow-sm"
            />
          </div>
        </div>

        {error && (
          <div role="alert" className="alert alert-error alert-soft rounded-2xl">
            <p className="text-sm font-semibold text-error">
              Failed to load barangay insights.
            </p>
            <button
              onClick={() => refetch()}
              className="btn btn-error btn-sm"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading ? (
            [...Array(6)].map((_, index) => (
              <div
                key={index}
                aria-label="Loading barangay insights"
                className="h-36 rounded-2xl bg-base-100 border border-base-300 animate-pulse"
              />
            ))
          ) : barangays.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3 bg-base-100 border border-base-300 rounded-2xl p-10 text-center text-base-content/80 font-medium">
              No barangay records match this view.
            </div>
          ) : (
            barangays.map((item) => {
              const status = getBarangayStatusPresentation(item.status);
              return (
                <article
                  key={`${item.municipality}-${item.name}`}
                  aria-label={`${item.name} barangay insight`}
                  className="bg-base-100 border-0 border-l-4 border-primary shadow-sm hover:shadow-md transition-shadow rounded-2xl p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-base-content">
                        {item.name}
                      </p>
                      <p className="text-xs text-base-content/80 mt-1 font-semibold">
                        {item.municipality}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {status ? (
                        <span
                          className={`badge badge-soft badge-sm ${status.className}`}
                        >
                          {status.label}
                        </span>
                      ) : null}
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <MapPin size={18} aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-5">
                    <Metric
                      label="Farmers"
                      value={formatBarangayMetric(item.farmersCount)}
                    />
                    <Metric
                      label="Animals"
                      value={formatBarangayMetric(item.animalsCount)}
                    />
                    <Metric
                      label="Pending health"
                      value={formatBarangayMetric(item.pendingHealthRequests)}
                    />
                    <Metric
                      label="AI success"
                      value={formatBarangayPercentage(item.aiSuccessRate)}
                    />
                  </div>
                </article>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

const Metric = ({ label, value }) => (
  <div
    aria-label={`${label}: ${value}`}
    className="rounded-xl bg-base-200 border border-base-300 p-3"
  >
    <p className="text-[10px] font-black uppercase tracking-widest text-base-content/80">
      {label}
    </p>
    <p className="text-lg font-black text-base-content mt-1">
      {value}
    </p>
  </div>
);
