import React from "react";
import {
  Pressable,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/lib/theme";

export interface AppPageHeaderProps {
  title: string;
  onBack?: () => void;
  showBackButton?: boolean;
  rightAction?: React.ReactNode;
  includeSafeTop?: boolean;
  variant?: "detail" | "top-level";
  containerStyle?: StyleProp<ViewStyle>;
}

export interface AppHeaderIconButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  selected?: boolean;
}

export function AppHeaderIconButton({
  onPress,
  accessibilityLabel,
  children,
  selected = false,
}: AppHeaderIconButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? colors.tint : colors.surfaceSubtle,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.border,
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}

export function AppPageHeader({
  title,
  onBack,
  showBackButton = true,
  rightAction,
  includeSafeTop = true,
  variant = "detail",
  containerStyle,
}: AppPageHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const horizontalPadding = width >= 600 ? 24 : 16;

  return (
    <>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.card}
        translucent={false}
      />
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            minHeight: includeSafeTop ? insets.top + 64 : 64,
            paddingTop: includeSafeTop ? insets.top + 8 : 8,
            paddingBottom: 8,
            paddingHorizontal: horizontalPadding,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          containerStyle,
        ]}
      >
        {showBackButton ? (
          <Pressable
            onPress={onBack || (() => router.back())}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={4}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "transparent",
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <ArrowLeft
              size={20}
              color={colors.textPrimary}
              strokeWidth={2.25}
            />
          </Pressable>
        ) : null}

        <View
          style={{
            flex: 1,
            minWidth: 0,
            marginLeft: showBackButton ? 12 : 0,
          }}
        >
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            style={{
              color: colors.textPrimary,
              fontFamily:
                variant === "top-level" ? "Outfit_800ExtraBold" : "Outfit_700Bold",
              fontSize: variant === "top-level" ? 24 : 18,
              lineHeight: variant === "top-level" ? 30 : 24,
            }}
          >
            {title}
          </Text>
        </View>

        {rightAction ? (
          <View style={{ marginLeft: 12 }}>{rightAction}</View>
        ) : null}
      </View>
    </>
  );
}
