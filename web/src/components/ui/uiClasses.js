import React from "react";

const combine = (...classes) => classes.filter(Boolean).join(" ");

export const ui = {
  page: "flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300",
  main: "p-4 md:p-6 space-y-5 flex-1 flex flex-col min-h-0",
  panel: "card bg-base-100 border border-base-300 overflow-hidden",
  panelPadded: "card bg-base-100 border border-base-300 p-5",
  metricCard: "stat bg-base-100 border border-base-300 rounded-box flex-row items-center gap-3",
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

  if (
    ["emergency", "critical", "urgent", "overdue"].includes(normalized)
  ) {
    return "badge-error badge-soft";
  }
  if (["pending", "waiting", "attention", "warning", "high"].includes(normalized)) {
    return "badge-warning badge-soft";
  }
  if (["scheduled", "ready today"].includes(normalized)) {
    return "badge-info badge-soft";
  }
  if (["in-progress", "in_progress", "assigned", "approved"].includes(normalized)) {
    return "badge-primary badge-soft";
  }
  if (["done", "completed", "complete", "resolved", "healthy", "active", "normal"].includes(normalized)) {
    return "badge-success badge-soft";
  }
  if (
    ["cancelled", "canceled", "rejected", "inactive", "unavailable", "off duty", "off_duty"].includes(normalized)
  ) {
    return "badge-neutral badge-soft";
  }
  if (
    kind ||
    ["ai", "insemination", "health", "medical", "pregnancy", "calving", "newborn"].some(
      (value) => normalized.includes(value),
    )
  ) {
    return "badge-neutral badge-soft";
  }
  return "badge-ghost";
};

export const Badge = ({ children, status, kind, className = "" }) =>
  React.createElement(
    "span",
    {
      className: combine(
      "badge badge-sm font-bold",
      statusBadgeClass(status, kind),
      className,
      ),
    },
    children || status || kind || "Standard",
  );
