import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

const ThemeToggle = () => {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "emerald",
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "night") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
    window.dispatchEvent(new Event("theme-change"));
  }, [theme]);

  useEffect(() => {
    const handleThemeChange = () => {
      const currentTheme = localStorage.getItem("theme") || "emerald";
      setTheme(currentTheme);
    };
    window.addEventListener("theme-change", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);
    return () => {
      window.removeEventListener("theme-change", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "emerald" ? "night" : "emerald"));
  };

  return (
    <button
      onClick={toggleTheme}
      className="btn btn-ghost btn-circle text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 relative flex items-center justify-center transition-colors"
      aria-label="Toggle Theme"
    >
      {theme === "emerald" ? (
        <Moon size={18} className="text-[#074033] dark:text-emerald-400" />
      ) : (
        <Sun size={18} className="text-amber-400" />
      )}
    </button>
  );
};

export default ThemeToggle;
