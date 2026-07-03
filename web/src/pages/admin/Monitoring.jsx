import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Database, ShieldCheck, Users, LifeBuoy, BarChart3, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Topbar from "../../components/ui/Topbar";
import axiosInstance from "../../lib/axios";

const StatCard = ({ icon, label, value, note }) => (
  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
          {value ?? "—"}
        </p>
      </div>
      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
        {icon}
      </div>
    </div>
    {note && <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">{note}</p>}
  </div>
);

const HealthLine = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-3">
    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-sm font-black text-slate-900 dark:text-white">{value}</span>
  </div>
);

const ProgressRow = ({ label, value }) => (
  <div>
    <div className="flex items-center justify-between gap-3 text-xs font-bold">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <span className="text-slate-900 dark:text-white">{value}%</span>
    </div>
    <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
      <div className="h-full rounded-full bg-[#00643b]" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  </div>
);

export default function AdminMonitoring() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "monitoring-dashboard-combined"],
    queryFn: async () => {
      const [monitoring, stats, supportPending, supportProgress, supportResolved] = await Promise.allSettled([
        axiosInstance.get("/admin/monitoring"),
        axiosInstance.get("/admin/stats"),
        axiosInstance.get("/support-tickets", { params: { status: "pending", limit: 1 } }),
        axiosInstance.get("/support-tickets", { params: { status: "in-progress", limit: 1 } }),
        axiosInstance.get("/support-tickets", { params: { status: "resolved", limit: 1 } }),
      ]);

      const unwrap = (result, fallback) => {
        if (result.status !== "fulfilled") return { data: fallback };
        return { data: result.value?.data ?? fallback };
      };

      const asArray = (value) => {
        if (Array.isArray(value)) return value;
        if (Array.isArray(value?.data)) return value.data;
        return [];
      };

      return {
        monitoring: unwrap(monitoring, {}).data,
        stats: unwrap(stats, {}).data,
        supportPending: asArray(unwrap(supportPending, {}).data),
        supportProgress: asArray(unwrap(supportProgress, {}).data),
        supportResolved: asArray(unwrap(supportResolved, {}).data),
      };
    },
  });

  const monitoring = data?.monitoring || {};
  const stats = data?.stats || {};
  const alerts = Array.isArray(monitoring.alerts) ? monitoring.alerts : [];
  const systemHealth = monitoring.systemHealth || {};
  const registryMonitor = monitoring.registryMonitor || {};
  const backupMonitor = monitoring.backupMonitor || {};
  const moowieInsights = monitoring.moowieInsights || {};

  const totalAnimals = stats.animals || 0;
  const missingAnimals = registryMonitor.missingAnimalData || 0;
  const completionRate = totalAnimals ? Math.max(0, Math.round(((totalAnimals - missingAnimals) / totalAnimals) * 100)) : 100;

  const supportPending = data?.supportPending?.length || 0;
  const supportProgress = data?.supportProgress?.length || 0;
  const supportResolved = data?.supportResolved?.length || 0;

  const formatDate = (date) => {
    if (!date) return "No date";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <Topbar
        title="System Monitoring"
        subtitle="Backend 2.0 health, registry quality, and operational alerts"
      />

      <main className="p-6 space-y-5">
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl p-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
              Failed to load monitoring data.
            </p>
            <button onClick={() => refetch()} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold">
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon={<Users size={18} />} label="Online devices" value={isLoading ? "..." : systemHealth.onlineDevices} note={`${systemHealth.offlineDevices ?? 0} offline profiles`} />
          <StatCard icon={<Database size={18} />} label="Duplicate ear tags" value={isLoading ? "..." : registryMonitor.duplicateEarTags} note="Registry records needing review" />
          <StatCard icon={<AlertTriangle size={18} />} label="Missing animal data" value={isLoading ? "..." : registryMonitor.missingAnimalData} note="Incomplete livestock profiles" />
          <StatCard icon={<ShieldCheck size={18} />} label="AI success rate" value={isLoading ? "..." : `${moowieInsights.aiSuccessRate ?? 0}%`} note="Backend monitoring estimate" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Panel 1: System and Data Health */}
          <section className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">System and Data Diagnostics</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Database completeness, backup schedules and synchronization queue</p>
            </div>
            
            <div className="space-y-4">
              <ProgressRow label="Registry completeness" value={completionRate} />
              <HealthLine label="System status" value={systemHealth.serverStatus || "online"} />
              <HealthLine label="Pending sync items" value={systemHealth.pendingSync || 0} />
              <HealthLine label="Archived records" value={registryMonitor.archivedRecords || 0} />
              <HealthLine label="Last database backup" value={isLoading ? "..." : formatDate(backupMonitor.lastBackup || systemHealth.lastBackup)} />
            </div>
          </section>

          {/* Panel 2: Support Ticket Summary */}
          <section className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Support Tickets Queue</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Farmer helpdesk and technician support cases status</p>
                </div>
                <Link to="/admin/support-tickets" className="inline-flex items-center gap-1 text-xs font-bold text-[#00643b] dark:text-emerald-300 hover:underline shrink-0">
                  Open Tickets
                  <ArrowRight size={13} />
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4">
                  <LifeBuoy size={16} className="text-amber-600 dark:text-amber-400" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-3">Pending</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{isLoading ? "..." : supportPending}</p>
                </div>
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4">
                  <Activity size={16} className="text-blue-600 dark:text-blue-400" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-3">In Progress</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{isLoading ? "..." : supportProgress}</p>
                </div>
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4">
                  <BarChart3 size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-3">Resolved</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{isLoading ? "..." : supportResolved}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Activity size={16} className="text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-black text-slate-900 dark:text-white">Operational Alerts</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <p className="p-5 text-sm text-slate-400">Loading alerts...</p>
            ) : alerts.length === 0 ? (
              <p className="p-5 text-sm text-slate-400">No monitoring alerts right now.</p>
            ) : (
              alerts.map((alert, index) => (
                <div key={`${alert.category || "alert"}-${index}`} className="p-5">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {alert.title || alert.category || "Monitoring alert"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {alert.message || alert.description || "Review this item in the related registry."}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
