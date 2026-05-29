import React from "react";
import { View, ViewProps, TouchableOpacity } from "react-native";
import { useTheme } from "../../lib/theme";

interface CardProps extends ViewProps {
  onPress?: () => void;
  variant?: "default" | "tinted" | "outlined";
}

export function Card({ children, style, onPress, variant = "default", ...props }: CardProps) {
  const { colors, isDark } = useTheme();

  const getCardBg = () => {
    if (variant === "tinted") return colors.tint;
    return colors.card;
  };

  const getCardBorder = () => {
    if (variant === "outlined") return colors.border;
    return "transparent";
  };

  const cardStyle = {
    backgroundColor: getCardBg(),
    borderColor: getCardBorder(),
    borderWidth: variant === "outlined" ? 1 : 0,
    borderRadius: 24,
    padding: 16,
    // Premium soft shadow (hides on dark mode to prevent grey halos)
    shadowColor: "#000",
    shadowOpacity: isDark ? 0 : 0.03,
    shadowRadius: 10,
    elevation: isDark ? 0 : 2,
  };

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[cardStyle, style]} {...(props as any)}>
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[cardStyle, style]} {...props}>
      {children}
    </View>
  );
}
