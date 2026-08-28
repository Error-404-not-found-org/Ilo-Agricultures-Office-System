import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { applyTheme, getStoredTheme, isDarkTheme } from "../../lib/theme";

const ThemeToggle = ({
  showLabel = false,
  showTooltip = false,
  fullWidth = false,
  tooltipPosition = "right",
}) => {
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(getStoredTheme());
    };
    window.addEventListener("theme-change", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);
    return () => {
      window.removeEventListener("theme-change", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = isDarkTheme(theme) ? "breedsmart" : "breedsmart-dark";
    setTheme(applyTheme(nextTheme));
  };

  const isDark = isDarkTheme(theme);
  const activeLabel = isDark ? "Dark mode" : "Light mode";
  const actionLabel = `Switch to ${isDark ? "light" : "dark"} mode`;

  const control = (
    <button
      type="button"
      onClick={toggleTheme}
      className={`btn btn-ghost text-base-content/70 hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        fullWidth
          ? `h-auto min-h-0 w-full rounded-xl ${
              showLabel
                ? "justify-start gap-2 px-3 py-2 text-xs"
                : "justify-center p-2.5"
            }`
          : "btn-circle"
      }`}
      aria-label={actionLabel}
      aria-pressed={isDark}
    >
      {isDark ? (
        <Moon size={18} aria-hidden="true" />
      ) : (
        <Sun size={18} aria-hidden="true" />
      )}
      {showLabel && <span>{activeLabel}</span>}
    </button>
  );

  if (!showTooltip) return control;

  return (
    <div
      className={`tooltip ${
        tooltipPosition === "bottom" ? "tooltip-bottom" : "tooltip-right"
      } ${fullWidth ? "w-full" : ""}`}
      data-tip={activeLabel}
    >
      {control}
    </div>
  );
};

export default ThemeToggle;
