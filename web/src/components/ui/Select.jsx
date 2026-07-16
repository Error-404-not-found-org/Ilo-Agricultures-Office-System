export default function Select({
  label,
  value,
  onChange,
  options = [], // [{ value, label, disabled }] or string[]
  placeholder = "Select option",
  error = "",
  className = "",
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
        <select
          value={value}
          onChange={onChange}
          className={`select select-bordered w-full bg-base-100 text-sm text-base-content ${
            error
              ? "select-error"
              : "focus:outline-primary"
          }`}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt, idx) => {
            const isObj = typeof opt === "object" && opt !== null;
            const optVal = isObj ? opt.value : opt;
            const optLabel = isObj ? opt.label : opt;
            const optDisabled = isObj ? opt.disabled : false;
            return (
              <option key={idx} value={optVal} disabled={optDisabled}>
                {optLabel}
              </option>
            );
          })}
        </select>
      </div>
      {error && (
        <span className="label text-xs font-semibold text-error block" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
