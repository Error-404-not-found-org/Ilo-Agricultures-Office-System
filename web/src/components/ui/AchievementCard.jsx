export default function AchievementCard({ title, description, icon, unlocked = false, dateUnlocked, className = "" }) {
  return (
    <div
      className={`p-4 border rounded-2xl flex items-center gap-3 transition-all duration-200 ${
        unlocked
          ? "bg-base-100 border-base-300 shadow-xs hover:shadow-md"
          : "bg-base-100/50 border-base-200 opacity-60"
      } ${className}`}
    >
      <div
        className={`p-3 rounded-2xl shrink-0 text-xl font-bold flex items-center justify-center border ${
          unlocked
            ? "bg-primary/10 border-primary/20 text-primary"
            : "bg-base-200 border-base-300 text-base-content/30"
        }`}
      >
        {icon || "🏆"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-extrabold text-xs uppercase tracking-wider text-base-content leading-none">
            {title}
          </h4>
          {unlocked ? (
            <span className="badge badge-success text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md text-white">
              Unlocked
            </span>
          ) : (
            <span className="badge badge-ghost text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md text-base-content/40">
              Locked
            </span>
          )}
        </div>
        <p className="text-[11px] text-base-content/60 mt-1.5 font-semibold leading-tight">
          {description}
        </p>
        {unlocked && dateUnlocked && (
          <span className="text-[9px] text-base-content/40 font-bold block mt-1 font-mono">
            Earned: {dateUnlocked}
          </span>
        )}
      </div>
    </div>
  );
}
