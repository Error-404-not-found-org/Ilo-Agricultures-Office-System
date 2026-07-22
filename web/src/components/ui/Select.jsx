import { useId } from "react";

export default function Select({
  label,
  value,
  onChange,
  options = [], // [{ value, label, disabled }] or string[]
  placeholder = "Select option",
  error = "",
  hint = "",
  className = "",
  required = false,
  id,
  ...props
}) {
  const generatedId = useId();
  const selectId = id || `select-${generatedId.replaceAll(":", "")}`;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`space-y-1.5 w-full ${className}`}>
      {label && (
        <label htmlFor={selectId} className="label text-xs font-semibold text-base-content/70 flex items-center gap-1">
          {label}
          {required && <span className="text-error font-bold" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative w-full">
        <select
          id={selectId}
          value={value}
          onChange={onChange}
          {...props}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`select select-bordered w-full bg-base-100 text-sm text-base-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            error
              ? "select-error"
              : "focus:outline-primary"
          }`}
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
      {hint && !error && <span id={hintId} className="label block text-xs text-base-content/60">{hint}</span>}
      {error && (
        <span id={errorId} className="label text-xs font-semibold text-error block" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
