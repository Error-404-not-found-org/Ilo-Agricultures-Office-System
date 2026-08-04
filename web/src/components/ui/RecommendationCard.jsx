export default function RecommendationCard({ title, description, icon, type = "info" }) {
  const colorMap = {
    info: "bg-blue-500/5 border-blue-500/10 text-blue-600 dark:text-blue-400",
    success: "bg-emerald-500/5 border-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/5 border-amber-500/10 text-amber-600 dark:text-amber-400",
    error: "bg-rose-500/5 border-rose-500/10 text-rose-600 dark:text-rose-400",
  };

  return (
    <div className={`p-4 border rounded-2xl flex gap-3 shadow-3xs ${colorMap[type] || colorMap.info}`}>
      {icon && <div className="text-lg shrink-0 mt-0.5">{icon}</div>}
      <div className="min-w-0 flex-1">
        <h4 className="font-extrabold text-xs uppercase tracking-wider text-base-content mb-1">
          {title}
        </h4>
        <p className="text-[11px] text-base-content/70 leading-relaxed font-semibold">
          {description}
        </p>
      </div>
    </div>
  );
}
