export interface TechnicianDashboardStats {
  dueToday: number;
  overdue: number;
  completedToday: number;
  aiCompletedToday: number;
  totalInsemMonth: number;
  successRate: string;
}

const metricCount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export function normalizeTechnicianDashboardStats(
  stats: Record<string, unknown> | null | undefined,
): TechnicianDashboardStats {
  return {
    dueToday: metricCount(stats?.dueToday),
    overdue: metricCount(stats?.overdue),
    completedToday: metricCount(stats?.completedToday),
    aiCompletedToday: metricCount(
      stats?.aiCompletedToday ?? stats?.completedToday,
    ),
    totalInsemMonth: metricCount(stats?.totalInsemMonth),
    successRate:
      typeof stats?.successRate === "string" ||
      typeof stats?.successRate === "number"
        ? String(stats.successRate)
        : "0%",
  };
}
