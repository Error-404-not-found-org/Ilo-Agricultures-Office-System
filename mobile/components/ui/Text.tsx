import React from "react";
import { Text as RNText, TextProps } from "react-native";
import { useTheme } from "../../lib/theme";

interface CustomTextProps extends TextProps {
  variant?: "regular" | "medium" | "semibold" | "bold" | "extrabold" | "black";
  color?: "primary" | "secondary" | "muted" | "brand";
  size?: number;
}

export function Text({ variant = "regular", color = "primary", size, style, children, ...props }: CustomTextProps) {
  const { colors } = useTheme();

  const getFontFamily = () => {
    switch (variant) {
      case "medium": return "Outfit_500Medium";
      case "semibold": return "Outfit_600SemiBold";
      case "bold": return "Outfit_700Bold";
      case "extrabold": return "Outfit_800ExtraBold";
      case "black": return "Outfit_900Black";
      default: return "Outfit_400Regular";
    }
  };

  const getTextColor = () => {
    switch (color) {
      case "secondary": return colors.textSecondary;
      case "muted": return colors.textMuted;
      case "brand": return colors.primary;
      default: return colors.textPrimary;
    }
  };

  return (
    <RNText
      style={[
        {
          fontFamily: getFontFamily(),
          color: getTextColor(),
          fontSize: size || 14,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}
