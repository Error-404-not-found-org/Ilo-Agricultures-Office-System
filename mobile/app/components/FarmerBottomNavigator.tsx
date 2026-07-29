import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import {
  ClipboardList,
  FileText,
  Home,
  PawPrint,
  User,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "@/contexts/TranslationContext";
import { useTheme } from "@/lib/theme";

export default function FarmerBottomNavigator({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const focusedRouteKey = state.routes[state.index].key;
  const focusedOptions = descriptors[focusedRouteKey].options;

  if ((focusedOptions.tabBarStyle as any)?.display === "none") return null;

  const activeRoute = state.routes[state.index]?.name;

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
        label={t("home")}
        focused={activeRoute === "index"}
        onPress={() => navigate("index")}
        colors={colors}
        isDark={isDark}
      />
      <TabItem
        icon={PawPrint}
        label={t("myAnimals")}
        focused={activeRoute === "add-animal"}
        onPress={() => navigate("add-animal")}
        colors={colors}
        isDark={isDark}
      />
      <TabItem
        icon={ClipboardList}
        label="Requests"
        focused={activeRoute === "service-requests"}
        onPress={() => navigate("service-requests")}
        colors={colors}
        isDark={isDark}
      />
      <TabItem
        icon={FileText}
        label={t("records")}
        focused={activeRoute === "farmer.records"}
        onPress={() => navigate("farmer.records")}
        colors={colors}
        isDark={isDark}
      />
      <TabItem
        icon={User}
        label={t("profile")}
        focused={activeRoute === "profile"}
        onPress={() => navigate("profile")}
        colors={colors}
        isDark={isDark}
      />
    </View>
  );
}

type TabItemProps = {
  icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  label: string;
  focused: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  isDark: boolean;
};

function TabItem({
  icon: Icon,
  label,
  focused,
  onPress,
  colors,
  isDark,
}: TabItemProps) {
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
});
