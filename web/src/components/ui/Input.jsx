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
        <label className="label text-xs font-semibold text-base-content/70 flex items-center gap-1">
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
          className={`input input-bordered w-full bg-base-100 text-sm text-base-content ${
            Icon ? "pl-11" : ""
          } ${
            error
              ? "input-error"
              : "focus:outline-primary"
          }`}
          {...props}
        />
      </div>
      {error && (
        <span className="label text-xs font-semibold text-error block" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
