import React from "react";

const combine = (...classes) => classes.filter(Boolean).join(" ");

export const ui = {
  page: "flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300",
  main: "p-4 md:p-6 space-y-5 flex-1 flex flex-col min-h-0",
  panel: "card bg-base-100 border border-base-300 shadow-sm overflow-hidden",
  panelPadded: "card bg-base-100 border border-base-300 shadow-sm p-5",
  metricCard: "stat bg-base-100 border border-base-300 shadow-sm rounded-box flex-row items-center gap-3",
  metricIcon: "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
  filterBar: "flex items-center gap-2 flex-wrap mb-4 bg-base-200 p-3 rounded-box border border-base-300",
  input: "input input-bordered input-sm w-full bg-base-100 text-base-content text-sm placeholder:text-base-content/45 focus:outline-primary",
  select: "select select-bordered select-sm min-h-9 bg-base-100 text-base-content text-sm focus:outline-primary",
  primaryButton: "btn btn-primary btn-sm",
  ghostButton: "btn btn-outline btn-sm",
  iconButton: "btn btn-ghost btn-sm btn-square text-base-content/70",
  table: "table w-full border-collapse text-xs",
  tableHead: "bg-base-200 border-b border-base-300 text-base-content/60 text-xs font-bold uppercase tracking-wide select-none",
  tableBody: "divide-y divide-base-300",
  tableRow: "hover:bg-base-200 transition-colors",
  empty: "rounded-box border border-dashed border-base-300 p-8 text-center text-sm font-medium text-base-content/55",
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
