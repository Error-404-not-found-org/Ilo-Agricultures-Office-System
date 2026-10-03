export default function OverviewMetricCard({
  icon: Icon,
  label,
  value,
  description,
  borderClass = "border-l-primary",
  iconClass = "bg-primary/10 text-primary",
  isLoading = false,
}) {
  return (
    <article
      className={`stat min-h-28 rounded-box border border-base-300 border-l-4 ${borderClass} bg-base-100 p-4 shadow-sm`}
    >
      {Icon && (
        <div
          className={`stat-figure ml-3 flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
        >
          <Icon size={19} aria-hidden="true" />
        </div>
      )}
      <div className="stat-title mt-1 text-sm font-semibold text-base-content/90">
        {label}
      </div>
      <div className="stat-value text-3xl font-extrabold leading-none text-base-content">
        {isLoading ? (
          <span
            className="skeleton mt-1 block h-8 w-20"
            aria-label={`Loading ${label}`}
          />
        ) : (
          value
        )}
      </div>
      <div className="stat-desc mt-1 text-xs text-base-content/70">
        {description}
      </div>
    </article>
  );
}
