import React from "react";
import { Text as RNText, TextProps, type TextStyle } from "react-native";
import { useTheme } from "../../lib/theme";

export type TextRole =
  | "headline"
  | "title"
  | "bodyStrong"
  | "body"
  | "label"
  | "caption";

const ROLE_STYLES: Record<TextRole, TextStyle> = {
  headline: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 24,
    lineHeight: 30,
  },
  title: {
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    lineHeight: 24,
  },
  bodyStrong: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
  },
  body: {
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
};

export interface CustomTextProps extends TextProps {
  textRole?: TextRole;
  variant?: "regular" | "medium" | "semibold" | "bold" | "extrabold" | "black";
  color?: "primary" | "secondary" | "muted" | "brand";
  size?: number;
}

export function Text({
  textRole,
  variant = "regular",
  color = "primary",
  size,
  style,
  children,
  ...props
}: CustomTextProps) {
  const { colors } = useTheme();

  const getFontFamily = () => {
    switch (variant) {
      case "medium":
        return "Outfit_500Medium";
      case "semibold":
        return "Outfit_600SemiBold";
      case "bold":
        return "Outfit_700Bold";
      case "extrabold":
        return "Outfit_800ExtraBold";
      case "black":
        return "Outfit_900Black";
      default:
        return "Outfit_400Regular";
    }
  };

  const getTextColor = () => {
    switch (color) {
      case "secondary":
        return colors.textSecondary;
      case "muted":
        return colors.textMuted;
      case "brand":
        return colors.primary;
      default:
        return colors.textPrimary;
    }
  };

  return (
    <RNText
      style={[
        textRole
          ? ROLE_STYLES[textRole]
          : {
              fontFamily: getFontFamily(),
              fontSize: size ?? 14,
            },
        { color: getTextColor() },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}
