import React from "react";

const combine = (...classes) => classes.filter(Boolean).join(" ");

export const ui = {
  page: "flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300",
  main: "p-4 md:p-6 space-y-5 flex-1 flex flex-col min-h-0",
  panel: "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden",
  panelPadded: "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5",
  metricCard: "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-center gap-3 shadow-sm",
  metricIcon: "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
  filterBar: "flex items-center gap-2 flex-wrap mb-4 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/70",
  input: "w-full rounded-xl border border-slate-200 bg-slate-100/80 px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-[#00643b] focus:bg-white focus:ring-1 focus:ring-[#00643b] placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:bg-slate-950 dark:focus:ring-emerald-500",
  select: "select select-bordered select-sm min-h-9 rounded-xl border-slate-200 bg-slate-100/80 text-xs font-semibold text-slate-700 outline-none transition focus:border-[#00643b] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 dark:focus:border-emerald-500",
  primaryButton: "inline-flex items-center justify-center gap-2 rounded-xl bg-[#00643b] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#004d2e] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
  ghostButton: "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-[#00643b] hover:text-[#00643b] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-300",
  iconButton: "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#00643b] hover:text-[#00643b] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-emerald-500 dark:hover:text-emerald-300",
  table: "w-full border-collapse text-xs",
  tableHead: "bg-slate-50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-black uppercase tracking-wider select-none",
  tableBody: "divide-y divide-slate-100 dark:divide-slate-800/60",
  tableRow: "hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors",
  empty: "rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-sm font-medium text-slate-400 dark:text-slate-500",
};

export const statusBadgeClass = (status, kind) => {
  const normalized = String(status || kind || "standard").toLowerCase();

  if (kind === "ai" || normalized.includes("insemination")) {
    return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/60";
  }
  if (kind === "health" || normalized.includes("health") || normalized.includes("medical")) {
    return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/60";
  }
  if (kind === "pregnancy" || normalized.includes("pregnan")) {
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/60";
  }
  if (kind === "calving" || normalized.includes("calv") || normalized.includes("newborn")) {
    return "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/20 dark:text-teal-300 dark:border-teal-900/60";
  }
  if (["emergency", "critical", "overdue"].includes(normalized)) {
    return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/60";
  }
  if (["pending", "scheduled", "attention", "warning", "high"].includes(normalized)) {
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/60";
  }
  if (["done", "completed", "complete", "resolved", "healthy", "active", "normal"].includes(normalized)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/60";
  }
  if (["cancelled", "canceled", "rejected", "inactive"].includes(normalized)) {
    return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700";
  }
  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700";
};

export const Badge = ({ children, status, kind, className = "" }) =>
  React.createElement(
    "span",
    {
      className: combine(
      "inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider",
      statusBadgeClass(status, kind),
      className,
      ),
    },
    children || status || kind || "Standard",
  );
