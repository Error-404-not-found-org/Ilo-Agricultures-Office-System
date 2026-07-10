export default function Button({
  children,
  onClick,
  type = "button",
  variant = "primary", // primary, secondary, outline, ghost, danger
  size = "md", // sm, md, lg
  loading = false,
  disabled = false,
  className = "",
  icon: Icon,
  ...props
}) {
  const baseStyle = "btn font-bold rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0";
  
  const variants = {
    primary: "btn-primary text-white shadow-sm hover:shadow-md",
    secondary: "bg-base-200 hover:bg-base-300 text-base-content border-none",
    outline: "btn-outline border-base-350 hover:bg-base-200 hover:text-base-content",
    ghost: "btn-ghost hover:bg-base-200",
    danger: "btn-error text-white shadow-sm hover:bg-red-650",
  }[variant] || "btn-primary";

  const sizes = {
    sm: "btn-sm text-xs px-3 h-9",
    md: "h-11 px-5 text-xs",
    lg: "btn-lg text-sm px-6 h-12",
  }[size] || "h-11";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyle} ${variants} ${sizes} ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      {...props}
    >
      {loading ? (
        <span className="loading loading-spinner loading-xs"></span>
      ) : Icon ? (
        <Icon size={size === "sm" ? 12 : 14} className="shrink-0" />
      ) : null}
      {children}
    </button>
  );
}
