export default function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  error = "",
  className = "",
  icon: Icon,
  required = false,
  ...props
}) {
  return (
    <div className={`space-y-1.5 w-full ${className}`}>
      {label && (
        <label className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] ml-1 flex items-center gap-0.5">
          {label}
          {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
      )}
      <div className="relative w-full">
        {Icon && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20 pointer-events-none flex items-center justify-center">
            <Icon size={16} />
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full h-11 bg-base-200 border rounded-xl px-4 text-xs font-bold text-base-content placeholder:text-base-content/25 focus:outline-none transition-all ${
            Icon ? "pl-11" : ""
          } ${
            error
              ? "border-rose-500/50 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
              : "border-base-300 focus:border-primary"
          }`}
          {...props}
        />
      </div>
      {error && (
        <span className="text-[10px] font-bold text-rose-500 ml-1.5 block animate-fade-in">
          {error}
        </span>
      )}
    </div>
  );
}
