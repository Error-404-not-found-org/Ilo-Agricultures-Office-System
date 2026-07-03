import React, { ReactNode } from "react";
import { View, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

interface DashboardLayoutProps {
  children: ReactNode;
  statusBarColor?: string;
  backgroundColor?: string;
  statusBarStyle?: "light-content" | "dark-content";
}

export default function DashboardLayout({
  children,
  statusBarColor = "#00643B",
  backgroundColor,
  statusBarStyle = "light-content",
}: DashboardLayoutProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const finalBackgroundColor = backgroundColor || colors.background;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: finalBackgroundColor,
      }}
    >
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor={statusBarColor}
      />

      {/* Status Bar Safety Zone */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: statusBarColor,
          zIndex: 999,
          elevation: 999,
        }}
      />

      {children}
    </View>
  );
}