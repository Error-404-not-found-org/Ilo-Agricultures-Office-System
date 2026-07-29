import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import {
  ClipboardList,
  FileText,
  Home,
  PawPrint,
  Users,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { getTechnicianRequests } from "@/features/technician-requests/services/technicianRequests.service";

const REQUEST_ROUTES = ["technician.requests", "technician.calendar"];

export default function BottomNavigator({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();

  const focusedRouteKey = state.routes[state.index].key;
  const focusedOptions = descriptors[focusedRouteKey].options;

  const { data: requestCountData } = useQuery({
    queryKey: ["technician", "requests", "navigation-count"],
    queryFn: () =>
      getTechnicianRequests(api, {
        assignment: "unassigned",
        status: "pending",
        page: 1,
        limit: 1,
      }),
    enabled: Boolean(isLoaded && isSignedIn),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if ((focusedOptions.tabBarStyle as any)?.display === "none") return null;

  const activeRoute = state.routes[state.index]?.name;
  const availableCount = requestCountData?.pagination?.total || 0;

  const navigate = (screenName: string) => {
    const route = state.routes.find((item) => item.name === screenName);
    if (!route) return;

    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) navigation.navigate(screenName);
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
      ]}
    >
      <TabItem
        icon={Home}
        label="Home"
        focused={activeRoute === "technician.dashboard"}
        onPress={() => navigate("technician.dashboard")}
        colors={colors}
        isDark={isDark}
      />
      <TabItem
        icon={Users}
        label="Farmers"
        focused={activeRoute === "technician.clients"}
        onPress={() => navigate("technician.clients")}
        colors={colors}
        isDark={isDark}
      />
      <TabItem
        icon={ClipboardList}
        label="Requests"
        focused={REQUEST_ROUTES.includes(activeRoute)}
        badge={availableCount}
        onPress={() => navigate("technician.requests")}
        colors={colors}
        isDark={isDark}
      />
      <TabItem
        icon={PawPrint}
        label="Animals"
        focused={activeRoute === "technician.animals"}
        onPress={() => navigate("technician.animals")}
        colors={colors}
        isDark={isDark}
      />
      <TabItem
        icon={FileText}
        label="Records"
        focused={activeRoute === "technician.records"}
        onPress={() => navigate("technician.records")}
        colors={colors}
        isDark={isDark}
      />
    </View>
  );
}

function TabItem({
  icon: Icon,
  label,
  focused,
  badge = 0,
  onPress,
  colors,
  isDark,
}: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.72}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      style={styles.tab}
    >
      <View style={styles.iconSlot}>
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: focused
                ? isDark
                  ? "rgba(16,185,129,0.18)"
                  : "rgba(0,100,59,0.10)"
                : "transparent",
            },
          ]}
        >
          <Icon
            size={22}
            strokeWidth={focused ? 2.5 : 2}
            color={focused ? colors.primary : colors.textMuted}
          />
        </View>
        {badge > 0 ? (
          <View style={[styles.badge, { borderColor: colors.card }]}>
            <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        style={[
          styles.label,
          {
            color: focused ? colors.primary : colors.textMuted,
            fontFamily: focused ? "Outfit_700Bold" : "Outfit_500Medium",
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 7,
    elevation: 12,
    shadowColor: "#052e1d",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  tab: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconSlot: {
    width: 42,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  label: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 13,
    textAlign: "center",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#b45309",
  },
  badgeText: {
    color: "#fff",
    fontFamily: "Outfit_700Bold",
    fontSize: 9,
    lineHeight: 11,
  },
});
