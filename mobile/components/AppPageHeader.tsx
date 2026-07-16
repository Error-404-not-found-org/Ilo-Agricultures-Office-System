import React from "react";
import { StatusBar, Text, TouchableOpacity, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/lib/theme";

interface AppPageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  includeSafeTop?: boolean;
  containerStyle?: object;
}

export function AppPageHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  includeSafeTop = true,
  containerStyle,
}: AppPageHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

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
            paddingTop: includeSafeTop ? insets.top + 12 : 12,
            paddingBottom: 12,
            paddingHorizontal: 20,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          containerStyle,
        ]}
      >
        <TouchableOpacity
          onPress={onBack || (() => router.back())}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          activeOpacity={0.7}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isDark ? colors.background : "#f8fafc",
          }}
        >
          <ArrowLeft size={20} color={colors.textPrimary} strokeWidth={2.25} />
        </TouchableOpacity>

        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              fontFamily: "Outfit_900Black",
              fontSize: 20,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={2}
              style={{
                marginTop: 2,
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 11,
                lineHeight: 15,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {rightAction ? <View style={{ marginLeft: 12 }}>{rightAction}</View> : null}
      </View>
    </>
  );
}
