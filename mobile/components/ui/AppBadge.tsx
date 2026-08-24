import React from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BadgeTone =
  | "emerald"
  | "rose"
  | "violet"
  | "orange"
  | "blue"
  | "amber"
  | "red"
  | "green"
  | "slate"
  | "neutral";

export interface FilterOption {
  value: string;
  label: string;
}

// ─── Badge Component ──────────────────────────────────────────────────────────

interface BadgeProps {
  label: string;
  tone: BadgeTone;
  accessibilityPrefix?: string;
  size?: "sm" | "md" | "lg";
}

const toneColors = (
  tone: BadgeTone,
  isDark: boolean,
): { background: string; foreground: string; border: string } => {
  const palette = {
    emerald: isDark
      ? ["rgba(16,185,129,0.18)", "#6ee7b7", "rgba(52,211,153,0.35)"]
      : ["#ecfdf5", "#047857", "#a7f3d0"],
    rose: isDark
      ? ["rgba(244,63,94,0.18)", "#fda4af", "rgba(251,113,133,0.35)"]
      : ["#fff1f2", "#be123c", "#fecdd3"],
    violet: isDark
      ? ["rgba(139,92,246,0.18)", "#c4b5fd", "rgba(167,139,250,0.35)"]
      : ["#f5f3ff", "#6d28d9", "#ddd6fe"],
    orange: isDark
      ? ["rgba(249,115,22,0.18)", "#fdba74", "rgba(251,146,60,0.35)"]
      : ["#fff7ed", "#c2410c", "#fed7aa"],
    blue: isDark
      ? ["rgba(59,130,246,0.18)", "#93c5fd", "rgba(96,165,250,0.35)"]
      : ["#eff6ff", "#1d4ed8", "#bfdbfe"],
    amber: isDark
      ? ["rgba(245,158,11,0.18)", "#fcd34d", "rgba(251,191,36,0.35)"]
      : ["#fffbeb", "#b45309", "#fde68a"],
    red: isDark
      ? ["rgba(239,68,68,0.18)", "#fca5a5", "rgba(248,113,113,0.35)"]
      : ["#fef2f2", "#b91c1c", "#fecaca"],
    green: isDark
      ? ["rgba(34,197,94,0.18)", "#86efac", "rgba(74,222,128,0.35)"]
      : ["#f0fdf4", "#15803d", "#bbf7d0"],
    slate: isDark
      ? ["#1e293b", "#cbd5e1", "#475569"]
      : ["#f1f5f9", "#475569", "#cbd5e1"],
    neutral: isDark
      ? ["#1e293b", "#cbd5e1", "#475569"]
      : ["#f8fafc", "#475569", "#cbd5e1"],
  } as const;
  const [background, foreground, border] = palette[tone];
  return { background, foreground, border };
};

const sizeStyles = {
  sm: { fontSize: 9, paddingHorizontal: 8, paddingVertical: 2, minHeight: 22 },
  md: { fontSize: 10, paddingHorizontal: 9, paddingVertical: 3, minHeight: 26 },
  lg: { fontSize: 12, paddingHorizontal: 12, paddingVertical: 4, minHeight: 30 },
};

export function AppBadge({
  label,
  tone,
  accessibilityPrefix = "Badge",
  size = "md",
}: BadgeProps) {
  const { isDark } = useTheme();
  const colors = toneColors(tone, isDark);
  const sizeStyle = sizeStyles[size];

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${accessibilityPrefix}: ${label}`}
      style={{
        alignSelf: "flex-start",
        justifyContent: "center",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        paddingHorizontal: sizeStyle.paddingHorizontal,
        paddingVertical: sizeStyle.paddingVertical,
        minHeight: sizeStyle.minHeight,
      }}
    >
      <Text
        style={{
          color: colors.foreground,
          fontFamily: "Outfit_700Bold",
          fontSize: sizeStyle.fontSize,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Filter Chips Component ──────────────────────────────────────────────────

interface FilterChipsProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  counts?: Partial<Record<string, number>>;
  countsLoading?: boolean;
}

export function FilterChips({
  options,
  value,
  onChange,
  counts,
  countsLoading = false,
}: FilterChipsProps) {
  const { colors, isDark } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
      }}
    >
      {options.map((option) => {
        const selected = value === option.value;
        const count = counts?.[option.value];
        const countLabel = countsLoading || count === undefined ? "" : ` ${count}`;

        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.label} filter, ${selected ? "selected" : "not selected"}${countsLoading || count === undefined ? "" : `, ${count} items`}`}
            style={{
              minHeight: 44,
              justifyContent: "center",
              borderRadius: 999,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected
                ? isDark
                  ? "rgba(16,185,129,0.16)"
                  : colors.tint
                : colors.card,
              paddingHorizontal: 14,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: selected ? colors.primary : colors.textSecondary,
                fontFamily: "Outfit_700Bold",
                fontSize: 12,
              }}
            >
              {option.label}
              {countLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
