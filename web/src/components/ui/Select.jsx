import { ChevronDown } from "lucide-react";

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
        <label className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] ml-1 flex items-center gap-0.5">
          {label}
          {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
      )}
      <div className="relative w-full">
        <select
          value={value}
          onChange={onChange}
          className={`w-full h-11 bg-base-200 border rounded-xl px-4 pr-10 text-xs font-bold text-base-content focus:outline-none transition-all appearance-none cursor-pointer ${
            error
              ? "border-rose-500/50 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
              : "border-base-300 focus:border-primary"
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
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none">
          <ChevronDown size={14} />
        </span>
      </div>
      {error && (
        <span className="text-[10px] font-bold text-rose-500 ml-1.5 block animate-fade-in">
          {error}
        </span>
      )}
    </div>
  );
}
