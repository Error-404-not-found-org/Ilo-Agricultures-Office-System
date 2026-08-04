export default function Badge({ status, kind = "insemination", className = "" }) {
  const normalized = status ? status.toLowerCase() : "";

  const resolved = (() => {
    if (kind === "insemination") {
      switch (normalized) {
        case "done":
        case "completed":
          return "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400";
        case "in-progress":
        case "pending":
          return "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400";
        default:
          return "bg-slate-500/10 border-slate-500/20 text-slate-600 dark:bg-slate-950/20 dark:text-slate-400";
      }
    }
    if (kind === "pregnancy") {
      switch (normalized) {
        case "pregnant":
          return "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400";
        case "empty":
          return "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400";
        default:
          return "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400";
      }
    }
    if (kind === "calving") {
      if (["normal", "natural", "easy"].includes(normalized)) {
        return "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400";
      }
      if (["difficult", "cesarean", "dystocia"].includes(normalized)) {
        return "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400";
      }
      return "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400";
    }
    return "bg-slate-500/10 border-slate-500/20 text-slate-650";
  })();

  return (
    <span
      className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] border ${resolved} ${className}`}
    >
      {status || "UNKNOWN"}
    </span>
  );
}
