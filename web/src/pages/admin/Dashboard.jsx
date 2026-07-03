import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  ClipboardList,
  HeartPulse,
  MapPin,
  RefreshCcw,
  ShieldAlert,
  Stethoscope,
  Syringe,
  UserCheck,
  Users,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Topbar from "../../components/ui/Topbar";
import DashboardChart from "../../components/data/DashboardChart";
import AssignTaskModal from "../../components/modals/AssignTaskModal";

const GREEN = "#00643b";
const GREEN_SOFT = "rgba(0, 100, 59, 0.72)";
const AMBER = "#d97706";
const ROSE = "#e11d48";
const BLUE = "#1d4ed8";
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

const emptyResult = (fallback) => ({ ok: false, data: fallback });

const unwrap = (result, fallback) => {
  if (result.status !== "fulfilled") return emptyResult(fallback);
  return { ok: true, data: result.value?.data ?? fallback };
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.users)) return value.users;
  if (Array.isArray(value?.tickets)) return value.tickets;
  if (Array.isArray(value?.logs)) return value.logs;
  if (Array.isArray(value?.barangays)) return value.barangays;
  return [];
};

const numberValue = (value) => Number(value || 0).toLocaleString();

const getBarangayName = (item) => item?.barangay || item?.name || item?._id || "Unspecified";

const formatDate = (date) => {
  if (!date) return "No date";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getRequestType = (request) => {
  if (request?.type === "ai" || request?.type === "insemination") return "AI";
  if (request?.type === "health") return "Health";
  if (request?.requestType) return request.requestType;
  if (request?.raw?.requestType) return request.raw.requestType;
  if (request?.issueDescription || request?.symptoms || request?.raw?.symptoms) return "Health";
  return "Service";
};

const getQueueRequests = (value) => {
  if (Array.isArray(value?.requests)) return value.requests;
  return asArray(value);
};

const toDashboardRequest = (request) => {
  const raw = request?.raw || request || {};
  return {
    id: request?.id || raw?._id,
    rawId: raw?._id || request?.id,
    type: request?.type || raw?.type || (raw?.issueDescription || raw?.symptoms ? "health" : "service"),
    status: request?.status || raw?.status || "pending",
    urgency: request?.urgency || raw?.urgency || "standard",
    farmer: request?.farmer || raw?.farmerId?.name || raw?.farmer?.name || "Unknown farmer",
    barangay: request?.location || raw?.farmerId?.address?.barangay || raw?.barangay || "No barangay",
    animalTag: request?.earTag || request?.animal || raw?.animalId?.earTag || raw?.animalId?.animalId || "No tag",
    animalLabel: request?.breed || raw?.animalId?.species || raw?.animalId?.breed || "Livestock",
    detail: raw?.symptoms || raw?.requestType || raw?.issueDescription || request?.task || "No details provided",
    createdAt: request?.createdAt || raw?.createdAt,
    raw,
  };
};

export default function Dashboard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "emerald");
  const [activeUrgency, setActiveUrgency] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  useEffect(() => {
    const syncTheme = () => setTheme(localStorage.getItem("theme") || "emerald");
    window.addEventListener("theme-change", syncTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener("theme-change", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "dashboard-overview"],
    queryFn: async () => {
      const [
        stats,
        monitoring,
        analytics,
        chartData,
        barangays,
        technicians,
        technicianRequests,
        supportPending,
        supportProgress,
        supportResolved,
        auditLogs,
        registry,
      ] = await Promise.allSettled([
        axiosInstance.get("/admin/stats"),
        axiosInstance.get("/admin/monitoring"),
        axiosInstance.get("/admin/analytics"),
        axiosInstance.get("/admin/chart-data"),
        axiosInstance.get("/admin/barangays/insights"),
        axiosInstance.get("/user?role=technician"),
        axiosInstance.get("/technician/requests", { params: { status: "pending", limit: 50 } }),
        axiosInstance.get("/support-tickets", { params: { status: "pending", limit: 25 } }),
        axiosInstance.get("/support-tickets", { params: { status: "in-progress", limit: 25 } }),
        axiosInstance.get("/support-tickets", { params: { status: "resolved", limit: 25 } }),
        axiosInstance.get("/audit-logs", { params: { limit: 5 } }),
        axiosInstance.get("/technician/dashboard-registry"),
      ]);

      return {
        stats: unwrap(stats, {}).data,
        monitoring: unwrap(monitoring, {}).data,
        analytics: unwrap(analytics, {}).data,
        chartData: unwrap(chartData, {}).data,
        barangays: asArray(unwrap(barangays, []).data),
        technicians: asArray(unwrap(technicians, []).data),
        requests: getQueueRequests(unwrap(technicianRequests, {}).data).map(toDashboardRequest),
        supportPending: unwrap(supportPending, {}).data,
        supportProgress: unwrap(supportProgress, {}).data,
        supportResolved: unwrap(supportResolved, {}).data,
        auditLogs: asArray(unwrap(auditLogs, {}).data),
        registry: asArray(unwrap(registry, []).data),
      };
    },
    refetchInterval: 1000 * 45,
  });

  const darkTheme = theme === "night";
  const stats = data?.stats || EMPTY_OBJECT;
  const monitoring = data?.monitoring || EMPTY_OBJECT;
  const registryMonitor = monitoring.registryMonitor || {};
  const moowieInsights = monitoring.moowieInsights || {};
  const serviceRequests = data?.requests || EMPTY_ARRAY;
  const barangays = data?.barangays || EMPTY_ARRAY;
  const technicians = data?.technicians || EMPTY_ARRAY;
  const auditLogs = data?.auditLogs || EMPTY_ARRAY;

  const urgentHealth = useMemo(
    () =>
      serviceRequests.filter((request) =>
        ["high", "emergency", "urgent", "critical"].includes(String(request?.urgency || "").toLowerCase()),
      ),
    [serviceRequests],
  );

  const filteredRequests = useMemo(() => {
    if (activeUrgency === "urgent") return urgentHealth;
    return serviceRequests;
  }, [activeUrgency, serviceRequests, urgentHealth]);





  const barangayAttention = useMemo(() => {
    return [...barangays]
      .sort((a, b) => {
        const aRisk = (a.pendingHealthRequests || 0) * 3 + (a.pendingAIRequests || 0) * 2 + (a.incompleteRecordsCount || 0);
        const bRisk = (b.pendingHealthRequests || 0) * 3 + (b.pendingAIRequests || 0) * 2 + (b.incompleteRecordsCount || 0);
        return bRisk - aRisk;
      })
      .slice(0, 5);
  }, [barangays]);

  const requestStatusData = useMemo(() => {
    const pendingAI = serviceRequests.filter((request) => request.type === "ai" || request.type === "insemination").length;
    const pendingHealth = serviceRequests.filter((request) => request.type === "health").length;
    const urgent = urgentHealth.length;
    const assigned = moowieInsights.technicianWorkloads?.reduce((sum, item) => sum + Number(item.activeRequests || 0), 0) || 0;
    return {
      labels: ["Health pending", "Urgent", "AI pending", "Assigned work"],
      datasets: [
        {
          label: "Requests",
          data: [pendingHealth, urgent, pendingAI, assigned],
          backgroundColor: [ROSE, AMBER, GREEN, BLUE],
          borderColor: darkTheme ? "#020617" : "#ffffff",
          borderWidth: 3,
        },
      ],
    };
  }, [darkTheme, moowieInsights.technicianWorkloads, serviceRequests, urgentHealth.length]);

  const trendChart = useMemo(() => {
    const chartData = data?.chartData || {};
    const ai = chartData.inseminations || [];
    const health = chartData.healthRequests || [];
    const dates = Array.from(new Set([...ai.map((item) => item._id), ...health.map((item) => item._id)])).sort();
    const labels = dates.length
      ? dates.map((date) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }))
      : ["Week 1", "Week 2", "Week 3", "Week 4"];

    return {
      labels,
      datasets: [
        {
          label: "AI records",
          data: dates.length ? dates.map((date) => ai.find((item) => item._id === date)?.count || 0) : [0, 0, 0, 0],
          borderColor: GREEN,
          backgroundColor: "rgba(0, 100, 59, 0.08)",
          fill: true,
        },
        {
          label: "Health reports",
          data: dates.length ? dates.map((date) => health.find((item) => item._id === date)?.count || 0) : [0, 0, 0, 0],
          borderColor: ROSE,
          backgroundColor: "rgba(225, 29, 72, 0.06)",
          fill: true,
        },
      ],
    };
  }, [data?.chartData]);



  const workloadChart = useMemo(() => {
    const workloads = Array.isArray(moowieInsights.technicianWorkloads) ? moowieInsights.technicianWorkloads : [];
    const rows = workloads.length
      ? workloads.slice(0, 6)
      : technicians.slice(0, 6).map((tech) => ({ name: tech.name || "Technician", activeRequests: 0 }));
    return {
      rows,
      labels: rows.map((item) => item.name || "Technician"),
      datasets: [
        {
          label: "Active requests",
          data: rows.map((item) => item.activeRequests || 0),
          backgroundColor: GREEN_SOFT,
          borderColor: GREEN,
          borderWidth: 0,
        },
      ],
    };
  }, [moowieInsights.technicianWorkloads, technicians]);



  const summaryCards = [
    {
      label: "Farmers",
      value: stats.farmers,
      note: "Registered farmer accounts",
      icon: Users,
      color: "text-[#00643b] dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      label: "Animals",
      value: stats.animals,
      note: `${registryMonitor.missingAnimalData || 0} incomplete records`,
      icon: Activity,
      color: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      label: "Technicians",
      value: stats.technicians ?? technicians.length,
      note: "Active field workforce",
      icon: UserCheck,
      color: "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900",
    },
    {
      label: "Open requests",
      value: serviceRequests.length,
      note: `${urgentHealth.length} urgent requests`,
      icon: ClipboardList,
      color: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30",
    },
  ];

  const needsAttention = [
    {
      title: "Urgent service requests",
      count: urgentHealth.length,
      detail: "High-priority service requests waiting for action",
      to: "/admin/requests",
      tone: "rose",
    },
    {
      title: "Unclaimed service requests",
      count: serviceRequests.length,
      detail: "Pending requests from the unified service queue",
      to: "/admin/requests",
      tone: "amber",
    },
    {
      title: "Barangays needing review",
      count: barangayAttention.filter((item) => item.status !== "healthy").length,
      detail: "Health, AI, or registry quality risk",
      to: "/admin/barangays",
      tone: "blue",
    },
    {
      title: "Incomplete animal records",
      count: registryMonitor.missingAnimalData || 0,
      detail: "Missing breed, birth date, or registry details",
      to: "/admin/monitoring",
      tone: "slate",
    },
  ];

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success("Admin dashboard data refreshed.");
    } catch {
      toast.error("Unable to refresh admin dashboard data.");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Topbar
        title="Admin Dashboard"
        subtitle="Municipal agriculture operations, service demand, and registry health"
      >
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 rounded-xl bg-[#00643b] px-3 py-2 text-xs font-bold text-white hover:bg-[#004d2e] active:scale-95 transition"
        >
          <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </Topbar>

      <main className="p-4 md:p-6 space-y-5">
        {isError && (
          <ErrorPanel title="Dashboard data unavailable" message="Some operational data could not be loaded. Check the backend connection and try again." onRetry={handleRefresh} />
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} loading={isLoading} />
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Panel className="xl:col-span-5" title="Needs Attention" description="Items admins should review first">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {needsAttention.map((item) => (
                <AttentionCard key={item.title} item={item} loading={isLoading} />
              ))}
            </div>
          </Panel>

          <Panel className="xl:col-span-7" title="Service Request Overview" description="Pending work across health and AI services">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-center">
              <div className="lg:col-span-2">
                <DashboardChart
                  type="doughnut"
                  labels={requestStatusData.labels}
                  datasets={requestStatusData.datasets}
                  height={220}
                  darkTheme={darkTheme}
                />
              </div>
              <div className="lg:col-span-3 grid grid-cols-2 gap-3">
                <MiniMetric icon={HeartPulse} label="Health pending" value={requestStatusData.datasets[0].data[0]} />
                <MiniMetric icon={ShieldAlert} label="Urgent requests" value={urgentHealth.length} />
                <MiniMetric icon={Syringe} label="AI pending" value={requestStatusData.datasets[0].data[2]} />
                <MiniMetric icon={ClipboardList} label="Assigned work" value={requestStatusData.datasets[0].data[3]} />
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Panel className="xl:col-span-7" title="Pending Service Queue" description="Unassigned or urgent cases from farmers" actionLabel="Open board" to="/admin/requests">
            <RequestTable
              requests={filteredRequests}
              loading={isLoading}
              activeUrgency={activeUrgency}
              onUrgencyChange={setActiveUrgency}
              onAssign={(request) => {
                setSelectedRequest(request);
                setIsAssignModalOpen(true);
              }}
            />
          </Panel>

          <Panel className="xl:col-span-5" title="Technician Workload" description="Active assigned service load">
            <DashboardChart
              type="bar"
              labels={workloadChart.labels}
              datasets={workloadChart.datasets}
              height={260}
              darkTheme={darkTheme}
            />
          </Panel>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Panel className="xl:col-span-6" title="Barangay Overview" description="Barangays with service or data quality pressure" actionLabel="View all" to="/admin/barangays">
            <RankedBarangays barangays={barangayAttention} loading={isLoading} />
          </Panel>

          <Panel className="xl:col-span-6" title="Service Trends" description="AI records and health reports over the last 30 days">
            <DashboardChart
              type="line"
              labels={trendChart.labels}
              datasets={trendChart.datasets}
              height={270}
              darkTheme={darkTheme}
            />
          </Panel>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Panel className="xl:col-span-12" title="Recent Audit Activity" description="Latest admin and workflow changes" actionLabel="View logs" to="/admin/audit-logs">
            <AuditPreview logs={auditLogs} loading={isLoading} />
          </Panel>
        </section>
      </main>

      <AssignTaskModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        taskData={selectedRequest}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin", "dashboard-overview"] })}
      />
    </div>
  );
}

const Panel = ({ title, description, actionLabel, to, className = "", children }) => (
  <section className={`bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden ${className}`}>
    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-black text-slate-900 dark:text-white">{title}</h2>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>}
      </div>
      {to && actionLabel && (
        <Link to={to} className="inline-flex items-center gap-1 text-xs font-bold text-[#00643b] dark:text-emerald-300 hover:underline shrink-0">
          {actionLabel}
          <ArrowRight size={13} />
        </Link>
      )}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const SummaryCard = ({ label, value, note, icon: Icon, color, loading }) => (
  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm min-h-32">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 capitalize">{loading ? "..." : formatSummaryValue(value)}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
    </div>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">{note}</p>
  </div>
);

const formatSummaryValue = (value) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric.toLocaleString();
  return value || "0";
};

const AttentionCard = ({ item, loading }) => {
  const toneClass = {
    rose: "border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/15 text-rose-700 dark:text-rose-300",
    amber: "border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/15 text-amber-700 dark:text-amber-300",
    blue: "border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/15 text-blue-700 dark:text-blue-300",
    slate: "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300",
  }[item.tone];

  return (
    <Link to={item.to} className={`block rounded-2xl border p-4 hover:-translate-y-0.5 transition ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-black text-slate-900 dark:text-white">{item.title}</p>
        <span className="text-xl font-black">{loading ? "..." : numberValue(item.count)}</span>
      </div>
      <p className="text-xs mt-2 text-slate-600 dark:text-slate-400">{item.detail}</p>
    </Link>
  );
};

const MiniMetric = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4">
    <Icon size={16} className="text-[#00643b] dark:text-emerald-300" />
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-3">{label}</p>
    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{numberValue(value)}</p>
  </div>
);

const RankedBarangays = ({ barangays, loading }) => {
  if (loading) return <SkeletonRows count={5} />;
  if (!barangays.length) return <EmptyState message="No barangay risk records available." />;

  return (
    <div className="space-y-3">
      {barangays.map((item) => {
        const name = getBarangayName(item);
        const risk = Number(item.pendingHealthRequests || 0) + Number(item.pendingAIRequests || 0) + Number(item.incompleteRecordsCount || 0);
        return (
          <div key={name} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-white truncate">{name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {numberValue(item.animalsCount || 0)} animals, {numberValue(item.farmersCount || 0)} farmers
                </p>
              </div>
              <StatusBadge status={item.status || (risk > 0 ? "attention" : "healthy")} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <SmallCount label="Health" value={item.pendingHealthRequests || 0} />
              <SmallCount label="AI" value={item.pendingAIRequests || 0} />
              <SmallCount label="Data" value={item.incompleteRecordsCount || 0} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const RequestTable = ({ requests, loading, activeUrgency, onUrgencyChange, onAssign }) => (
  <div>
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1">
        {[
          ["all", "All pending"],
          ["urgent", "Urgent only"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => onUrgencyChange(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeUrgency === value ? "bg-[#00643b] text-white" : "text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{requests.length} visible requests</p>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
            <th className="py-3 pr-3">Farmer</th>
            <th className="py-3 pr-3">Animal</th>
            <th className="py-3 pr-3">Type</th>
            <th className="py-3 pr-3">Urgency</th>
            <th className="py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <tr>
              <td colSpan={5} className="py-6"><SkeletonRows count={3} /></td>
            </tr>
          ) : requests.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-10"><EmptyState message="No pending health requests in this view." /></td>
            </tr>
          ) : (
            requests.slice(0, 7).map((request) => (
              <tr key={request.id || request.rawId} className="align-middle">
                <td className="py-3 pr-3">
                  <p className="font-bold text-slate-900 dark:text-white">{request.farmer}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <MapPin size={12} /> {request.barangay}
                  </p>
                </td>
                <td className="py-3 pr-3">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{request.animalTag}</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{request.animalLabel}</p>
                </td>
                <td className="py-3 pr-3">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-900 px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <Stethoscope size={12} /> {getRequestType(request)}
                  </span>
                </td>
                <td className="py-3 pr-3">
                  <StatusBadge status={request.urgency || "standard"} />
                </td>
                <td className="py-3 text-right">
                  {request.type === "health" && request.raw?._id ? (
                    <button onClick={() => onAssign(request.raw)} className="rounded-lg bg-[#00643b] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#004d2e] active:scale-95 transition">
                      Assign
                    </button>
                  ) : (
                    <Link to="/admin/requests" className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition">
                      Review
                    </Link>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const AuditPreview = ({ logs, loading }) => {
  if (loading) return <SkeletonRows count={4} />;
  if (!logs.length) return <EmptyState message="No recent audit logs available." />;

  return (
    <div className="space-y-3">
      {logs.slice(0, 5).map((log) => (
        <div key={log._id} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900 dark:text-white truncate">{log.action || "Audit action"}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.entityType || "System"} by {log.actorId?.name || "System"}</p>
            </div>
            <span className="text-[11px] text-slate-400 shrink-0">{formatDate(log.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const SmallCount = ({ label, value }) => (
  <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-2">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{numberValue(value)}</p>
  </div>
);

const StatusBadge = ({ status }) => {
  const normalized = String(status || "standard").toLowerCase();
  const urgent = ["high", "emergency", "urgent", "critical"].includes(normalized);
  const attention = ["attention", "pending", "standard"].includes(normalized);
  const cls = urgent
    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/60"
    : attention
      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/60"
      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/60";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${cls}`}>{status || "standard"}</span>;
};

const EmptyState = ({ message }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-400 dark:text-slate-500">
    {message}
  </div>
);

const SkeletonRows = ({ count }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse" />
    ))}
  </div>
);

const ErrorPanel = ({ title, message, onRetry }) => (
  <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 p-4 flex flex-wrap items-center justify-between gap-3">
    <div>
      <p className="text-sm font-black text-rose-800 dark:text-rose-200">{title}</p>
      <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">{message}</p>
    </div>
    <button onClick={onRetry} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700">
      Retry
    </button>
  </div>
);
