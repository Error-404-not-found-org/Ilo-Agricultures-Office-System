export default function SectionHeader({ title, subtitle, actions, className = "" }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-base-300 pb-3 mb-4 ${className}`}>
      <div>
        <h3 className="font-extrabold text-xs uppercase tracking-wider text-base-content/50 leading-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] text-base-content/40 font-bold block mt-0.5 leading-tight">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 animate-fade-in">
          {actions}
        </div>
      )}
    </div>
  );
}
