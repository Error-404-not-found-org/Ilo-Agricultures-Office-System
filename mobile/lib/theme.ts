import { useColorScheme } from "nativewind";

export const COLORS = {
  light: {
    primary: "#00643B",
    background: "#f8fafc",
    card: "#ffffff",
    border: "#f1f5f9",
    textPrimary: "#1e293b",
    textSecondary: "#64748b",
    textMuted: "#94a3b8",
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    tint: "#f0fdf4",
  },
  dark: {
    primary: "#10b981",       // Vibrant green for dark mode visibility
    background: "#090d16",    // Deep sleek dark blue/black
    card: "#111827",          // Premium slate-900 card bg
    border: "#1f2937",        // Slate-800 border
    textPrimary: "#f8fafc",   // Off-white text
    textSecondary: "#cbd5e1", // Slate-300
    textMuted: "#6b7280",     // Slate-500
    success: "#34d399",
    error: "#f87171",
    warning: "#fbbf24",
    tint: "#064e3b",          // Dark green tint for accents
  }
};

export function useTheme() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? COLORS.dark : COLORS.light;
  
  return {
    colors,
    isDark,
    themeStyle: {
      backgroundColor: colors.background,
    }
  };
}
