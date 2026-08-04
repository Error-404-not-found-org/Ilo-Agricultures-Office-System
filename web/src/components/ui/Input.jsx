import { useId } from "react";

export default function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  error = "",
  hint = "",
  className = "",
  icon: Icon,
  required = false,
  id,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || `input-${generatedId.replaceAll(":", "")}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`space-y-1.5 w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="label text-xs font-semibold text-base-content/70 flex items-center gap-1">
          {label}
          {required && <span className="text-error font-bold" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative w-full">
        {Icon && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20 pointer-events-none flex items-center justify-center">
            <Icon size={16} />
          </span>
        )}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          {...props}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`input input-bordered w-full bg-base-100 text-sm text-base-content placeholder:text-base-content/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            Icon ? "pl-11" : ""
          } ${
            error
              ? "input-error"
              : "focus:outline-primary"
          }`}
        />
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
