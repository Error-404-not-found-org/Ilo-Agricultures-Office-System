import React from "react";
import {
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../../lib/theme";

export interface CardProps extends Omit<ViewProps, "style"> {
  onPress?: () => void;
  variant?: "default" | "tinted" | "outlined";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Card({ children, style, onPress, variant = "default", ...props }: CardProps) {
  const { colors } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: variant === "tinted" ? colors.tint : colors.card,
    borderColor: variant === "outlined" ? colors.outline : "transparent",
    borderWidth: variant === "outlined" ? 1 : 0,
    borderRadius: 16,
    padding: 16,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole={props.accessibilityRole || "button"}
        style={({ pressed }) => [
          cardStyle,
          pressed && { opacity: 0.82 },
          style,
        ]}
        {...(props as PressableProps)}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[cardStyle, style]} {...props}>
      {children}
    </View>
  );
}
