export default function StatCard({ label, value, icon, trend, trendType = "neutral", className = "" }) {
  const trendColor =
    trendType === "positive"
      ? "text-emerald-500"
      : trendType === "negative"
      ? "text-rose-500"
      : "text-base-content/40";

  return (
    <div className={`bg-base-100 border border-base-300 p-4 rounded-2xl flex items-center gap-3 shadow-xs hover:shadow-md transition-all duration-200 ${className}`}>
      {icon && (
        <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-black tracking-tight text-base-content leading-none">
          {value}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mt-1.5 leading-none">
          {label}
        </div>
        {trend && (
          <span className={`text-[9px] font-extrabold block mt-1 leading-none ${trendColor}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
