import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  StyleSheet,
} from "react-native";
import {
  Home,
  Users,
  Plus,
  FileText,
  Activity,
  X,
  UserPlus,
  Dog,
  MapPin,
} from "lucide-react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
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
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();
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

  const handleModalAction = (path: string) => {
    setModalVisible(false);
    router.push(path as any);
  };

  return (
    <View style={styles.outerContainer}>
      {/* --- ADMIN QUICK ACTION MODAL --- */}
      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark
                    ? COLORS.darkBackground
                    : COLORS.background,
                  paddingBottom: insets.bottom + 24,
                },
              ]}
            >
              <View
                style={[
                  styles.modalHandle,
                  { backgroundColor: isDark ? "#334155" : "#e2e8f0" },
                ]}
              />

              <View style={styles.modalHeader}>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: isDark ? "#ffffff" : "#1e293b" },
                  ]}
                >
                  Admin Actions
                </Text>

                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={[
                    styles.closeButton,
                    { backgroundColor: isDark ? "#1e293b" : "#f8fafc" },
                  ]}
                >
                  <X size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalGrid}>
                <ModalAction
                  icon={<UserPlus size={24} color={COLORS.active} />}
                  label="Create User"
                  onPress={() => handleModalAction("/(admin)/create-user")}
                  isDark={isDark}
                />
                <ModalAction
                  icon={<Dog size={24} color={COLORS.active} />}
                  label="All Animals"
                  onPress={() => handleModalAction("/(admin)/admin.animals")}
                  isDark={isDark}
                />
                <ModalAction
                  icon={<Activity size={24} color={COLORS.active} />}
                  label="Records"
                  onPress={() => handleModalAction("/(admin)/admin.records")}
                  isDark={isDark}
                />
                <ModalAction
                  icon={<Users size={24} color={COLORS.active} />}
                  label="All Users"
                  onPress={() => handleModalAction("/(admin)/admin.users")}
                  isDark={isDark}
                />
                <ModalAction
                  icon={<MapPin size={24} color={COLORS.active} />}
                  label="Barangay Insights"
                  onPress={() => handleModalAction("/(admin)/barangay-insights")}
                  isDark={isDark}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

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

          <View style={styles.fabSlot}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setModalVisible(true)}
              style={[
                styles.fab,
                {
                  backgroundColor: COLORS.active,
                  borderColor: isDark ? COLORS.darkBackground : "#FFFFFF",
                  shadowColor: COLORS.active,
                },
              ]}
            >
              <Plus color="#fff" size={28} strokeWidth={3} />
            </TouchableOpacity>
          </View>

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

const ModalAction = ({ icon, label, onPress, isDark }: any) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.modalAction,
      {
        backgroundColor: isDark ? "#1e293b" : "#ffffff",
        borderColor: isDark ? "#334155" : "#f1f5f9",
      },
    ]}
    activeOpacity={0.75}
  >
    <View
      style={[
        styles.actionIcon,
        {
          backgroundColor: isDark ? "rgba(37, 99, 235, 0.16)" : "#eff6ff",
        },
      ]}
    >
      {icon}
    </View>

    <Text
      style={[styles.actionLabel, { color: isDark ? "#e2e8f0" : "#334155" }]}
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
    fontSize: 10,
    marginTop: 2,
  },
  fabSlot: {
    flex: 1,
    height: 62,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Outfit_800ExtraBold",
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  modalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  modalAction: {
    width: "48%",
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 22,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 14,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
    textAlign: "center",
  },
});

export default AdminBottomNavigator;
