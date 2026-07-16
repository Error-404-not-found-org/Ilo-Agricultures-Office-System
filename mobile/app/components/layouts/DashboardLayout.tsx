import React, { ReactNode } from "react";
import { View, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

interface DashboardLayoutProps {
  children: ReactNode;
  statusBarColor?: string;
  backgroundColor?: string;
  statusBarStyle?: "light-content" | "dark-content";
  manageStatusBar?: boolean;
}

export default function DashboardLayout({
  children,
  statusBarColor,
  backgroundColor,
  statusBarStyle,
  manageStatusBar = true,
}: DashboardLayoutProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const finalBackgroundColor = backgroundColor || colors.background;
  const finalStatusBarColor = statusBarColor || colors.card;
  const finalStatusBarStyle = statusBarStyle || (isDark ? "light-content" : "dark-content");

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: finalBackgroundColor,
      }}
    >
      {manageStatusBar ? (
        <StatusBar barStyle={finalStatusBarStyle} backgroundColor={finalStatusBarColor} />
      ) : null}

      {/* Status Bar Safety Zone */}
      {manageStatusBar ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: finalStatusBarColor,
            zIndex: 999,
            elevation: 999,
          }}
        />
      ) : null}

      {children}
    </View>
  );
}
