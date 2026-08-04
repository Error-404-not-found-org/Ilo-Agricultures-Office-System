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
  const baseStyle = "btn font-bold shrink-0";
  
  const variants = {
    primary: "btn-primary",
    secondary: "btn-neutral",
    outline: "btn-outline",
    ghost: "btn-ghost",
    danger: "btn-error",
  }[variant] || "btn-primary";

  const sizes = {
    sm: "btn-sm",
    md: "btn-md",
    lg: "btn-lg",
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
