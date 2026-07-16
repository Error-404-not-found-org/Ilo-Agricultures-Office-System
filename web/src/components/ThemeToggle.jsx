import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { applyTheme, getStoredTheme, isDarkTheme } from "../lib/theme";

const ThemeToggle = () => {
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

  return (
    <button
      onClick={toggleTheme}
      className="btn btn-ghost btn-circle text-base-content/70"
      aria-label={`Switch to ${isDarkTheme(theme) ? "light" : "dark"} mode`}
      aria-pressed={isDarkTheme(theme)}
    >
      {!isDarkTheme(theme) ? (
        <Moon size={18} />
      ) : (
        <Sun size={18} className="text-warning" />
      )}
    </button>
  );
};

export default ThemeToggle;
