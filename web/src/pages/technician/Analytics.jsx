import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Percent,
  Clock,
  CheckCircle,
  ListTodo,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/layout/Topbar";
import StatCard from "../../components/ui/StatCard";
import SectionHeader from "../../components/ui/SectionHeader";
import RecommendationCard from "../../components/ui/RecommendationCard";
import ProgressCard from "../../components/ui/ProgressCard";

export default function TechnicianAnalytics() {
  const [timeRange, setTimeRange] = useState("6-months");
  const [barangay, setBarangay] = useState("all");

  // ---- LIVE BACKEND DATA QUERY ----
  const { data: analytics = {}, isLoading } = useQuery({
    queryKey: ["technician", "analytics-dashboard-isolated"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/analytics");
      return res.data || {};
    },
  });

  // ---- TASKS QUERY ----
  const { data: tasksData = [] } = useQuery({
    queryKey: ["technician", "performance-tasks"],
    queryFn: async () => {
      const res = await axiosInstance.get("/tasks", { params: { scope: "all", limit: 100 } });
      return res.data?.data || res.data || [];
    }
  });

  // Today's Progress calculations
  const todayProgress = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayTasks = tasksData.filter((t) => {
      const taskDate = t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "";
      return taskDate === todayStr;
    });

    const completed = todayTasks.filter((t) =>
      ["completed", "done"].includes(String(t.status || "").toLowerCase())
    ).length;

    const remaining = todayTasks.length - completed;

    const overdue = tasksData.filter((t) => {
      const taskDate = t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "";
      const isPending = !["completed", "done", "cancelled"].includes(String(t.status || "").toLowerCase());
      return isPending && taskDate < todayStr;
    }).length;

    return {
      total: todayTasks.length,
      completed,
      remaining,
      overdue,
    };
  }, [tasksData]);

  // Calculate dynamic stats
  const totalFarmers = useMemo(() => {
    return analytics.barangayActivity?.reduce((sum, b) => sum + (b.farmers || 0), 0) ?? 0;
  }, [analytics]);

  const kpis = useMemo(() => {
    const totalInsem = analytics.totalInsem;
    const totalPreg = analytics.totalPreg;
    return {
      completed: "Unavailable",
      conceptionRate:
        analytics.successRate !== undefined ? `${analytics.successRate}%` : "Unavailable",
      responseTime: "Unavailable",
      animalsAssisted: "Unavailable",
      farmersServed: totalFarmers,
      successfulAI: totalPreg ?? "Unavailable",
      pregnanciesConfirmed: totalPreg ?? "Unavailable",
      healthyBirths: "Unavailable",
      healthCasesResolved: "Unavailable",
      totalInsem: totalInsem ?? "Unavailable",
      healthRequestsThisMonth: analytics.totalHealth_Month ?? "Unavailable",
    };
  }, [analytics, totalFarmers]);

  // Success Indicators
  const successIndicators = useMemo(() => {
    return {
      aiRate: kpis.conceptionRate,
      pdRate: "Unavailable",
      calvingRate: "Unavailable",
      healthRate: "Unavailable",
    };
  }, [kpis]);

  const rateWidth = (value) =>
    typeof value === "string" && value.endsWith("%")
      ? `${Math.min(100, Math.max(0, Number.parseFloat(value) || 0))}%`
      : "0%";

  // Actionable operational recommendations
  const recommendations = useMemo(() => {
    const recs = [];

    if (todayProgress.overdue > 0) {
      recs.push({
        title: "Overdue tasks in Queue",
        description: `You have ${todayProgress.overdue} overdue follow-up tasks. Prioritize claiming and completing them today.`,
        type: "error",
        icon: "🚨",
      });
    }

    return recs;
  }, [todayProgress]);

  if (isLoading) {
    return (
      <div className="grow flex flex-col items-center justify-center min-h-[60vh] gap-4 bg-base-200 text-base-content">
        <span className="loading loading-infinity loading-lg text-primary scale-150"></span>
        <p className="text-primary font-bold tracking-widest animate-pulse uppercase text-[10px]">
          Computing Performance Metrics...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300 font-sans">
      <Topbar
        title="Field Performance Dashboard"
        subtitle="Operational metrics, productivity analysis, and service success rates"
      >
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="select select-sm select-bordered rounded-xl text-xs bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none transition-all duration-200 font-bold"
          >
            <option value="6-months">Last 6 Months</option>
            <option value="12-months">Last 12 Months</option>
            <option value="all-time">All Time</option>
          </select>

          <select
            value={barangay}
            onChange={(e) => setBarangay(e.target.value)}
            className="select select-sm select-bordered rounded-xl text-xs bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none transition-all duration-200 font-bold"
          >
            <option value="all">All Barangays</option>
            <option value="sm">San Miguel</option>
            <option value="sb">Santa Barbara</option>
            <option value="pv">Pavia</option>
          </select>
        </div>
      </Topbar>

      <main className="p-6 space-y-6 flex-1 flex flex-col min-h-0">

        {/* 1. Today's Progress Section */}
        <section className="bg-base-100 border border-base-300 rounded-2xl p-5 shadow-2xs">
          <SectionHeader title="Today's Progress" subtitle="Review your scheduled task completions for today" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 items-center">

            <div className="flex flex-col items-center justify-center p-3.5 bg-base-200 rounded-2xl">
              <span className="text-3xl font-black text-primary font-mono">{todayProgress.completed}</span>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-base-content/40 mt-1">Completed Tasks</span>
            </div>

            <div className="flex flex-col items-center justify-center p-3.5 bg-base-200 rounded-2xl">
              <span className="text-3xl font-black text-base-content font-mono">{todayProgress.remaining}</span>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-base-content/40 mt-1">Remaining Tasks</span>
            </div>

            <div className="flex flex-col items-center justify-center p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
              <span className="text-3xl font-black text-rose-600 dark:text-rose-400 font-mono">{todayProgress.overdue}</span>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-rose-600 dark:text-rose-400 mt-1">Overdue Tasks</span>
            </div>

            <div className="flex flex-col justify-center">
              <div className="flex justify-between items-center text-xs font-bold text-base-content/60 mb-2">
                <span>Task Completion progress</span>
                <span>{Math.round((todayProgress.completed / (todayProgress.total || 1)) * 100)}%</span>
              </div>
              <div className="w-full h-3.5 bg-base-200 rounded-full overflow-hidden border border-base-300">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((todayProgress.completed / (todayProgress.total || 1)) * 100)}%` }}
                />
              </div>
            </div>

          </div>
        </section>

        {/* 2. Monthly Productivity KPIs */}
        <section>
          <SectionHeader title="Monthly Productivity" subtitle="Summary of work completed during the active month" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4">
            <StatCard label="Completed Services" value={`${kpis.completed}`} icon={<CheckCircle size={16} />} />
            <StatCard label="Avg Services per day" value="Unavailable" icon={<ListTodo size={16} />} />
            <StatCard label="AI Conception Rate" value={kpis.conceptionRate} icon={<Percent size={16} />} />
            <StatCard label="Average Response" value={kpis.responseTime} icon={<Clock size={16} />} />
          </div>
        </section>

        {/* 3. Community Impact */}
        <section className="bg-base-100 border border-base-300 rounded-2xl p-5 shadow-2xs">
          <SectionHeader title="Community Impact metrics" subtitle="Officer statistics and contribution to the municipality" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-4">
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl hover:shadow-xs transition-shadow">
              <span className="text-emerald-600 dark:text-emerald-400 font-black text-2xl font-mono block leading-none">{kpis.successfulAI}</span>
              <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-wide block mt-2">Successful AI</span>
            </div>
            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl hover:shadow-xs transition-shadow">
              <span className="text-blue-600 dark:text-blue-400 font-black text-2xl font-mono block leading-none">{kpis.pregnanciesConfirmed}</span>
              <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-wide block mt-2">Pregnancies Confirmed</span>
            </div>
            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl hover:shadow-xs transition-shadow">
              <span className="text-amber-600 dark:text-amber-400 font-black text-2xl font-mono block leading-none">{kpis.healthyBirths}</span>
              <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-wide block mt-2">Healthy Births</span>
            </div>
            <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl hover:shadow-xs transition-shadow">
              <span className="text-rose-600 dark:text-rose-400 font-black text-2xl font-mono block leading-none">{kpis.healthCasesResolved}</span>
              <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-wide block mt-2">Health Cases Resolved</span>
            </div>
            <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl hover:shadow-xs transition-shadow">
              <span className="text-purple-600 dark:text-purple-400 font-black text-2xl font-mono block leading-none">{kpis.animalsAssisted}</span>
              <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-wide block mt-2">Animals Assisted</span>
            </div>
            <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-2xl hover:shadow-xs transition-shadow">
              <span className="text-teal-600 dark:text-teal-400 font-black text-2xl font-mono block leading-none">{kpis.farmersServed}</span>
              <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-wide block mt-2">Registered Farmers</span>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

          {/* 4. Service Success Rates */}
          <div className="lg:col-span-5 bg-base-100 border border-base-300 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <SectionHeader title="Service Success Rates" subtitle="Diagnostic completion and recovery metrics" />
              <div className="space-y-4 mt-2">

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-base-content">AI Success Rate</span>
                    <span className="font-bold text-emerald-500 font-mono">{successIndicators.aiRate}</span>
                  </div>
                  <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: rateWidth(successIndicators.aiRate) }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-base-content">Pregnancy Confirmation Rate</span>
                    <span className="font-bold text-blue-500 font-mono">{successIndicators.pdRate}</span>
                  </div>
                  <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: rateWidth(successIndicators.pdRate) }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-base-content">Calving Drop Rate</span>
                    <span className="font-bold text-amber-500 font-mono">{successIndicators.calvingRate}</span>
                  </div>
                  <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: rateWidth(successIndicators.calvingRate) }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-base-content">Health Recovery Rate</span>
                    <span className="font-bold text-rose-500 font-mono">{successIndicators.healthRate}</span>
                  </div>
                  <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: rateWidth(successIndicators.healthRate) }} />
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* 5. Personal Operational Recommendations */}
          <div className="lg:col-span-7 bg-base-100 border border-base-300 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <SectionHeader title="Actionable Recommendations" subtitle="Data-driven field advice to help prioritize your dispatches" />
              <div className="space-y-3 mt-2">
                {recommendations.length === 0 ? (
                  <p className="text-xs text-base-content/40 italic font-semibold py-4 text-center">
                    No recommendations found.
                  </p>
                ) : (
                  recommendations.map((rec, i) => (
                    <RecommendationCard
                      key={i}
                      title={rec.title}
                      description={rec.description}
                      type={rec.type}
                      icon={rec.icon}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

        </div>

        {/* 6. Monthly Goals Progress Grid */}
        <section>
          <SectionHeader title="Monthly Targets & Goals" subtitle="Track your active monthly quotas" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <ProgressCard
              title="Monthly Inseminations"
              subtitle="Target completed insemination cycles"
              value={kpis.totalInsem}
              target={null}
              unit="AI runs"
              color="bg-emerald-500"
            />
            <ProgressCard
              title="Pregnancies Confirmed"
              subtitle="Confirmed positive diagnoses target"
              value={kpis.pregnanciesConfirmed}
              target={null}
              unit="diagnoses"
              color="bg-blue-500"
            />
            <ProgressCard
              title="Clinical Resolutions"
              subtitle="Resolved health requests target"
              value={kpis.healthCasesResolved}
              target={null}
              unit="cases"
              color="bg-rose-500"
            />
          </div>
        </section>

      </main>
    </div>
  );
}
