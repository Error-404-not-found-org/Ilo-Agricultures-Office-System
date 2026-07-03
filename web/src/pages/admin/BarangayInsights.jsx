import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import Topbar from "../../components/ui/Topbar";
import axiosInstance from "../../lib/axios";

export default function BarangayInsights() {
  const [search, setSearch] = useState("");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "barangay-insights"],
    queryFn: async () => {
      const res = await axiosInstance.get("/admin/barangays/insights");
      return res.data?.data || res.data || [];
    },
  });

  const barangays = useMemo(() => {
    const list = Array.isArray(data) ? data : data?.barangays || [];
    return list.filter((item) =>
      String(item.name || item.barangay || item._id || "")
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  }, [data, search]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <Topbar
        title="Barangay Insights"
        subtitle="Municipal livestock, farmer, and service visibility by barangay"
      />

      <main className="p-6 space-y-5">
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Barangay coverage</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{isLoading ? "..." : barangays.length}</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search barangay..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl p-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Failed to load barangay insights.</p>
            <button onClick={() => refetch()} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold">Retry</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading ? (
            [...Array(6)].map((_, index) => (
              <div key={index} className="h-36 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 animate-pulse" />
            ))
          ) : barangays.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400">
              No barangay records match this view.
            </div>
          ) : (
            barangays.map((item) => {
              const name = item.name || item.barangay || item._id || "Unnamed barangay";
              return (
                <div key={name} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{name}</p>
                      <p className="text-xs text-slate-400 mt-1">Oton, Iloilo</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                      <MapPin size={18} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-5">
                    <Metric label="Farmers" value={item.farmers || item.farmerCount || 0} />
                    <Metric label="Animals" value={item.animals || item.animalCount || 0} />
                    <Metric label="Cases" value={item.healthRequests || item.healthCount || 0} />
                  </div>
                  {Array.isArray(item.technicians) && item.technicians.length > 0 && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-4 flex items-center gap-1">
                      <Users size={12} /> {item.technicians.length} assigned technician{item.technicians.length === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

const Metric = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800 p-3">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{value}</p>
  </div>
);
