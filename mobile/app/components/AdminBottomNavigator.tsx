import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  Home,
  Users,
  FileText,
  Dog,
  MapPin,
} from "lucide-react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";

// Admin Theme Colors
const COLORS = {
  primary: "#0f172a", // Dark Navy
  active: "#2563EB",  // Admin Blue
  inactive: "#94a3b8",
  background: "#ffffff",
  darkBackground: "#0f172a",
  darkSurface: "#1e293b",
};

const AdminBottomNavigator = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();

  const isDark = colorScheme === "dark";
  const focusedRouteKey = state.routes[state.index].key;
  const focusedOptions = descriptors[focusedRouteKey].options;

  if ((focusedOptions.tabBarStyle as any)?.display === "none") return null;

  const isFocused = (screenName: string) => {
    const routeIndex = state.routes.findIndex((r) => r.name === screenName);
    return routeIndex === state.index;
  };

  return (
    <View style={styles.outerContainer}>
      {/* --- MAIN TAB BAR --- */}
      <View
        style={[
          styles.tabContainer,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: isDark ? COLORS.darkBackground : COLORS.background,
            borderTopColor: isDark ? "#1e293b" : "#f1f5f9",
          },
        ]}
      >
        <View style={styles.tabRow}>
          <TabItem
            icon={Home}
            label="Home"
            isFocused={isFocused("admin.dashboard")}
            onPress={() => navigation.navigate("admin.dashboard")}
            isDark={isDark}
          />
          <TabItem
            icon={Users}
            label="Users"
            isFocused={isFocused("admin.users")}
            onPress={() => navigation.navigate("admin.users")}
            isDark={isDark}
          />
          <TabItem
            icon={MapPin}
            label="Insights"
            isFocused={isFocused("admin.insights")}
            onPress={() => navigation.navigate("admin.insights")}
            isDark={isDark}
          />
          <TabItem
            icon={Dog}
            label="Animals"
            isFocused={isFocused("admin.animals")}
            onPress={() => navigation.navigate("admin.animals")}
            isDark={isDark}
          />
          <TabItem
            icon={FileText}
            label="Records"
            isFocused={isFocused("admin.records")}
            onPress={() => navigation.navigate("admin.records")}
            isDark={isDark}
          />
        </View>
      </View>
    </View>
  );
};

// --- SUB COMPONENTS ---

const TabItem = ({ icon: Icon, label, isFocused, onPress, isDark }: any) => (
  <TouchableOpacity
    accessibilityRole="tab"
    accessibilityLabel={label}
    accessibilityState={{ selected: isFocused }}
    onPress={onPress}
    style={styles.tabItem}
    activeOpacity={0.75}
  >
    <View
      style={[
        styles.iconWrapper,
        {
          backgroundColor: isFocused
            ? isDark
              ? "#1e3a8a"
              : "#eff6ff"
            : "transparent",
        },
      ]}
    >
      <Icon
        color={isFocused ? COLORS.active : COLORS.inactive}
        size={22}
        strokeWidth={isFocused ? 2.6 : 2}
      />
    </View>

    <Text
      numberOfLines={1}
      style={[
        styles.tabLabel,
        {
          color: isFocused ? COLORS.active : COLORS.inactive,
          fontFamily: isFocused ? "Outfit_800ExtraBold" : "Outfit_600SemiBold",
        },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

// --- STYLES ---

const styles = StyleSheet.create({
  outerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
  },
  tabContainer: {
    borderTopWidth: 1,
    elevation: 16,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default AdminBottomNavigator;
