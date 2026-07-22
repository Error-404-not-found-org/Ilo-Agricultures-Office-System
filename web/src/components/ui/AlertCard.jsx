export default function AlertCard({ title, description, urgency = "medium", actionText, onAction, icon }) {
  const urgencyStyles = {
    high: "border-rose-500 bg-rose-500/5 text-rose-800 dark:text-rose-300",
    medium: "border-amber-500 bg-amber-500/5 text-amber-800 dark:text-amber-300",
    low: "border-blue-500 bg-blue-500/5 text-blue-800 dark:text-blue-300",
  };

  const urgencyBadge = {
    high: "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
    medium: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
    low: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
  };

  return (
    <div className={`p-4 border-l-4 rounded-r-xl border border-y-base-300 border-r-base-300 flex items-start gap-3 shadow-3xs ${urgencyStyles[urgency] || urgencyStyles.medium}`}>
      {icon && <div className="shrink-0 mt-0.5 text-lg">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-extrabold text-xs text-base-content leading-none">
            {title}
          </h4>
          <span className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[8px] border ${urgencyBadge[urgency]}`}>
            {urgency} priority
          </span>
        </div>
        <p className="text-[11px] text-base-content/75 mt-1.5 font-semibold leading-relaxed">
          {description}
        </p>
        {actionText && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="btn btn-xs btn-outline border-base-300 hover:bg-base-200 text-[10px] font-bold rounded-lg mt-3"
          >
            {actionText}
          </button>
        )}
      </div>
    </div>
  );
}
