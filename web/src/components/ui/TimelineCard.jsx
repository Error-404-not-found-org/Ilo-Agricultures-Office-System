export default function TimelineCard({ time, title, subtitle, badgeText, badgeColor = "badge-primary", icon, done = false }) {
  return (
    <div className={`flex gap-3 relative pb-4 last:pb-0 ${done ? "opacity-60" : ""}`}>
      {/* Vertical line connector */}
      <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-base-300 last:hidden" />

      <div className="w-8 h-8 rounded-full bg-base-200 border border-base-300 flex items-center justify-center text-sm shrink-0 z-10 font-bold">
        {icon || "📅"}
      </div>

      <div className="min-w-0 flex-1 bg-base-100 border border-base-300 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
          <div>
            <h4 className="font-extrabold text-xs text-base-content leading-tight">
              {title}
            </h4>
            <p className="text-[11px] text-base-content/50 mt-1 font-semibold leading-tight">
              {subtitle}
            </p>
          </div>
          {badgeText && (
            <span className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[8px] border shrink-0 ${badgeColor}`}>
              {badgeText}
            </span>
          )}
        </div>
        <div className="text-[9px] font-bold text-base-content/40 mt-2 font-mono flex items-center gap-1">
          ⏰ {time}
        </div>
      </div>
    </div>
  );
}
