import React, { useEffect, useRef } from "react";
import { Animated, DimensionValue, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@/lib/theme";

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  shape?: "rect" | "circle";
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({
  width = "100%",
  height = 16,
  radius = 8,
  shape = "rect",
  style,
}: SkeletonProps) {
  const { isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const sizeStyle =
    shape === "circle"
      ? { width: height, height, borderRadius: height / 2 }
      : { width, height, borderRadius: radius };

  return (
    <Animated.View
      accessibilityLabel="Loading content"
      style={[
        sizeStyle,
        {
          opacity,
          backgroundColor: isDark ? "#1f2937" : "#e2e8f0",
        },
        style,
      ]}
    />
  );
}
