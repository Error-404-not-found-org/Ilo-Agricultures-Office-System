import { useColorScheme } from "nativewind";

export const COLORS = {
  light: {
    primary: "#00643B",
    onPrimary: "#ffffff",
    background: "#f8fafc",
    card: "#ffffff",
    border: "#e2e8f0",
    outline: "#cbd5e1",
    surfaceSubtle: "#f1f5f9",
    textPrimary: "#1e293b",
    textSecondary: "#475569",
    textMuted: "#64748b",
    success: "#10b981",
    successForeground: "#047857",
    successContainer: "#ecfdf5",
    successBorder: "#a7f3d0",
    error: "#ef4444",
    errorForeground: "#b91c1c",
    errorContainer: "#fef2f2",
    errorBorder: "#fecaca",
    warning: "#f59e0b",
    warningForeground: "#a16207",
    warningContainer: "#fffbeb",
    warningBorder: "#fde68a",
    infoForeground: "#1d4ed8",
    infoContainer: "#eff6ff",
    infoBorder: "#bfdbfe",
    neutralForeground: "#475569",
    neutralContainer: "#f1f5f9",
    neutralBorder: "#cbd5e1",
    tint: "#f0fdf4",
    modalBackdrop: "rgba(15, 23, 42, 0.36)",
  },
  dark: {
    primary: "#10b981", // Vibrant green for dark mode visibility
    onPrimary: "#ffffff",
    background: "#090d16", // Deep sleek dark blue/black
    card: "#111827", // Premium slate-900 card bg
    border: "#1f2937", // Slate-800 border
    outline: "#374151",
    surfaceSubtle: "#1f2937",
    textPrimary: "#f8fafc", // Off-white text
    textSecondary: "#cbd5e1", // Slate-300
    textMuted: "#9ca3af", // Muted Ink
    success: "#34d399",
    successForeground: "#a7f3d0",
    successContainer: "#10b9812e",
    successBorder: "#34d39961",
    error: "#f87171",
    errorForeground: "#fecaca",
    errorContainer: "#ef44442e",
    errorBorder: "#f8717161",
    warning: "#fbbf24",
    warningForeground: "#fde68a",
    warningContainer: "#f59e0b2e",
    warningBorder: "#fbbf2461",
    infoForeground: "#bfdbfe",
    infoContainer: "#3b82f62e",
    infoBorder: "#60a5fa61",
    neutralForeground: "#e2e8f0",
    neutralContainer: "#94a3b829",
    neutralBorder: "#94a3b852",
    tint: "#064e3b", // Dark green tint for accents
    modalBackdrop: "rgba(2, 6, 23, 0.48)",
  },
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
    },
  };
}
