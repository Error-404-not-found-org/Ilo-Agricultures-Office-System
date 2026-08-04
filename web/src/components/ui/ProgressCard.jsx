export default function ProgressCard({ title, subtitle, value, target, unit = "", color = "bg-primary" }) {
  const hasTarget = Number.isFinite(target) && target > 0 && Number.isFinite(value);
  const percentage = hasTarget
    ? Math.min(100, Math.round((value / target) * 100))
    : 0;

  return (
    <div className="bg-base-100 border border-base-300 rounded-2xl p-4 shadow-3xs flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start gap-2">
          <div>
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-base-content/50 leading-none">
              {title}
            </h4>
            {subtitle && (
              <p className="text-[10px] text-base-content/40 mt-1 font-bold leading-none">
                {subtitle}
              </p>
            )}
          </div>
          <span className="text-sm font-black text-base-content font-mono leading-none">
            {value} {hasTarget ? `/ ${target}` : ""} {unit}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between items-center text-[10px] font-bold text-base-content/60">
          <span>{hasTarget ? "Completion Goal" : "Configured target"}</span>
          <span className="font-mono">{hasTarget ? `${percentage}%` : "Unavailable"}</span>
        </div>
        <div className="w-full h-3 bg-base-200 rounded-full overflow-hidden border border-base-300">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
