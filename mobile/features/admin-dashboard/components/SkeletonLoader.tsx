import React, { useEffect, useRef } from "react";
import { View, Animated, ViewStyle } from "react-native";
import { useTheme } from "@/lib/theme";

/**
 * Reusable animated pulse hook for skeleton shimmer effect.
 */
function usePulseAnimation() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return opacity;
}

/**
 * Single skeleton bar/row placeholder.
 */
export function SkeletonRow({
  width = "100%",
  height = 12,
  borderRadius = 6,
  style,
}: {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const { isDark } = useTheme();
  const opacity = usePulseAnimation();

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * Card-shaped skeleton placeholder with inner rows.
 */
export function SkeletonCard({
  rows = 3,
  style,
}: {
  rows?: number;
  style?: ViewStyle;
}) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 24,
          padding: 20,
        },
        style,
      ]}
    >
      {/* Header row */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <SkeletonRow width={32} height={32} borderRadius={16} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonRow width="60%" height={14} />
          <SkeletonRow width="35%" height={10} />
        </View>
      </View>

      {/* Body rows */}
      <View style={{ gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow
            key={i}
            width={i === rows - 1 ? "70%" : "100%"}
            height={12}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * 2x3 analytics-style grid skeleton matching AnalyticsGrid layout.
 */
export function SkeletonGrid() {
  const { colors, isDark } = useTheme();

  const SkeletonStatCard = () => (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 20,
        padding: 16,
        width: "48%",
        marginBottom: 12,
      }}
    >
      <SkeletonRow width={40} height={40} borderRadius={12} style={{ marginBottom: 10 }} />
      <SkeletonRow width="50%" height={20} style={{ marginBottom: 6 }} />
      <SkeletonRow width="70%" height={12} />
    </View>
  );

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
      {/* Section title skeleton */}
      <SkeletonRow width="55%" height={16} style={{ marginBottom: 12 }} />

      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </View>
    </View>
  );
}

/**
 * Moowie-style skeleton for the insights card.
 */
export function SkeletonMoowieCard() {
  const { colors } = useTheme();

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <View
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 24,
          padding: 20,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <SkeletonRow width={32} height={32} borderRadius={16} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonRow width="50%" height={14} />
            <SkeletonRow width="30%" height={10} />
          </View>
          <SkeletonRow width={72} height={24} borderRadius={12} />
        </View>

        {/* Advisor bubble */}
        <View
          style={{
            backgroundColor: colors.background,
            padding: 12,
            borderRadius: 16,
            borderLeftWidth: 4,
            borderLeftColor: colors.border,
            marginBottom: 16,
          }}
        >
          <SkeletonRow width="90%" height={12} style={{ marginBottom: 6 }} />
          <SkeletonRow width="75%" height={12} />
        </View>

        {/* Grid stats */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={{ width: "47%", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <SkeletonRow width={20} height={20} borderRadius={10} />
              <View style={{ flex: 1, gap: 4 }}>
                <SkeletonRow width="50%" height={14} />
                <SkeletonRow width="75%" height={10} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
