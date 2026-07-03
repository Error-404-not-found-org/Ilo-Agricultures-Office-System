import React from "react";
import {
  View,
  ScrollView,
  StatusBar,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

type ScreenLayoutProps = {
  children: React.ReactNode;
  statusBarColor?: string;
  statusBarStyle?: "light-content" | "dark-content" | "default";
  backgroundColor?: string;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  refreshControl?: React.ReactElement<any>;
};

export function ScreenLayout({
  children,
  statusBarColor,
  statusBarStyle,
  backgroundColor,
  scrollable = false,
  contentContainerStyle,
  edges = ["top", "left", "right"],
  refreshControl,
}: ScreenLayoutProps) {
  const { colors, isDark } = useTheme();

  const finalBackgroundColor = backgroundColor || colors.background;
  const finalStatusBarStyle = statusBarStyle || (isDark ? "light-content" : "dark-content");
  const finalStatusBarColor = statusBarColor || colors.background;

  const content = scrollable ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        { paddingBottom: 80 },
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.flex}>{children}</View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.container, { backgroundColor: finalBackgroundColor }]}
    >
      <StatusBar barStyle={finalStatusBarStyle} backgroundColor={finalStatusBarColor} />
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
});
