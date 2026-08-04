import * as React from "react";
import {
  View,
  Text,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme";

export interface BadgeProps extends React.ComponentPropsWithoutRef<typeof View> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "info";
  label?: string;
  textClassName?: string;
  textStyle?: StyleProp<TextStyle>;
  textNumberOfLines?: number;
  compact?: boolean;
}

export function Badge({
  className,
  textClassName,
  variant = "default",
  label,
  textStyle,
  textNumberOfLines,
  compact = false,
  children,
  style,
  ...props
}: BadgeProps) {
  const { colors } = useTheme();
  const baseBadgeClasses = "flex-row items-center justify-center self-start";

  const variantStyles = {
    default: {
      backgroundColor: colors.tint,
      borderColor: colors.successBorder,
      textColor: colors.primary,
    },
    secondary: {
      backgroundColor: colors.neutralContainer,
      borderColor: colors.neutralBorder,
      textColor: colors.neutralForeground,
    },
    outline: {
      backgroundColor: colors.card,
      borderColor: colors.outline,
      textColor: colors.textSecondary,
    },
    success: {
      backgroundColor: colors.successContainer,
      borderColor: colors.successBorder,
      textColor: colors.successForeground,
    },
    warning: {
      backgroundColor: colors.warningContainer,
      borderColor: colors.warningBorder,
      textColor: colors.warningForeground,
    },
    destructive: {
      backgroundColor: colors.errorContainer,
      borderColor: colors.errorBorder,
      textColor: colors.errorForeground,
    },
    info: {
      backgroundColor: colors.infoContainer,
      borderColor: colors.infoBorder,
      textColor: colors.infoForeground,
    },
  };
  const resolvedVariant = variantStyles[variant];

  return (
    <View
      className={cn(baseBadgeClasses, className)}
      style={[
        {
          backgroundColor: resolvedVariant.backgroundColor,
          borderColor: resolvedVariant.borderColor,
          borderWidth: 1,
          borderRadius: 999,
          paddingHorizontal: compact ? 8 : 12,
          paddingVertical: compact ? 4 : 6,
        },
        style,
      ]}
      {...props}
    >
      {label ? (
        <Text
          numberOfLines={textNumberOfLines}
          ellipsizeMode="tail"
          className={cn("font-outfit-semibold text-xs", textClassName)}
          style={[
            {
              color: resolvedVariant.textColor,
              fontFamily: "Outfit_600SemiBold",
              fontSize: 12,
              lineHeight: 16,
            },
            textStyle,
          ]}
        >
          {label}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
