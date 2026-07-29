import React from "react";
import {
  View,
  ScrollView,
  StatusBar,
  StyleSheet,
  type StyleProp,
  type ScrollViewProps,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

export type ScreenLayoutProps = Omit<ViewProps, "children" | "style"> & {
  children: React.ReactNode;
  statusBarColor?: string;
  statusBarStyle?: "light-content" | "dark-content" | "default";
  backgroundColor?: string;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  bottomInset?: number;
  edges?: Edge[];
  refreshControl?: React.ReactElement<any>;
  keyboardShouldPersistTaps?: ScrollViewProps["keyboardShouldPersistTaps"];
  showsVerticalScrollIndicator?: boolean;
};

export function ScreenLayout({
  children,
  statusBarColor,
  statusBarStyle,
  backgroundColor,
  scrollable = false,
  contentContainerStyle,
  style,
  contentStyle,
  bottomInset = 80,
  edges = ["top", "left", "right"],
  refreshControl,
  keyboardShouldPersistTaps = "handled",
  showsVerticalScrollIndicator = false,
  ...containerProps
}: ScreenLayoutProps) {
  const { colors, isDark } = useTheme();

  const finalBackgroundColor = backgroundColor || colors.background;
  const finalStatusBarStyle = statusBarStyle || (isDark ? "light-content" : "dark-content");
  const finalStatusBarColor = statusBarColor || colors.background;

  const content = scrollable ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        { paddingBottom: bottomInset },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      {...containerProps}
      edges={edges}
      style={[
        styles.container,
        { backgroundColor: finalBackgroundColor },
        style,
      ]}
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
