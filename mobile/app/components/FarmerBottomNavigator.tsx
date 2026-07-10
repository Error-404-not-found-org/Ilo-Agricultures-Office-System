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
  User,
  Plus,
  FileText,
  Dog,
  X,
  Syringe,
  MessageCircleQuestion,
  Sparkles,
} from "lucide-react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import { useTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FarmerBottomNavigator = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);

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
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: colors.card,
                    paddingBottom: Math.max(insets.bottom + 24, 40),
                  },
                ]}
              >
                <View style={styles.modalHeader}>
                  <Text
                    style={[styles.modalTitle, { color: colors.textPrimary }]}
                  >
                    Quick Actions
                  </Text>

                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={[
                      styles.closeButton,
                      {
                        backgroundColor: isDark ? colors.background : "#f8fafc",
                      },
                    ]}
                  >
                    <X size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalGrid}>
                  <ModalAction
                    icon={<Syringe size={24} color={colors.primary} />}
                    label="AI Service Request"
                    onPress={() => handleModalAction("/(farmer)/request-ai")}
                    colors={colors}
                    isDark={isDark}
                  />

                  <ModalAction
                    icon={
                      <MessageCircleQuestion size={24} color={colors.primary} />
                    }
                    label="Report Health Concern"
                    onPress={() =>
                      handleModalAction("/(farmer)/report-sickness")
                    }
                    colors={colors}
                    isDark={isDark}
                  />

                  <ModalAction
                    icon={<FileText size={24} color={colors.primary} />}
                    label="My Service Requests"
                    onPress={() => handleModalAction("/(farmer)/my-requests")}
                    colors={colors}
                    isDark={isDark}
                  />

                  <ModalAction
                    icon={<Plus size={24} color={colors.primary} />}
                    label="Add Animal"
                    onPress={() => handleModalAction("/(farmer)/register-animal")}
                    colors={colors}
                    isDark={isDark}
                  />

                  <ModalAction
                    icon={<Sparkles size={24} color={colors.primary} />}
                    label="Ask Moowie"
                    onPress={() => handleModalAction("/(farmer)/ask-moowie")}
                    colors={colors}
                    isDark={isDark}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <View
        style={[
          styles.tabContainer,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={styles.tabRow}>
          <TabItem
            icon={Home}
            label="Home"
            isFocused={isFocused("index")}
            onPress={() => navigation.navigate("index")}
            colors={colors}
            isDark={isDark}
          />

          <TabItem
            icon={Dog}
            label="My Animals"
            isFocused={isFocused("add-animal")}
            onPress={() => navigation.navigate("add-animal")}
            colors={colors}
            isDark={isDark}
          />

          <View style={styles.fabSlot}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setModalVisible(true)}
              style={[
                styles.fab,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.card,
                  shadowColor: colors.primary,
                },
              ]}
            >
              <Plus color="#fff" size={28} strokeWidth={3} />
            </TouchableOpacity>
          </View>

          <TabItem
            icon={FileText}
            label="Records"
            isFocused={isFocused("farmer.records")}
            onPress={() => navigation.navigate("farmer.records")}
            colors={colors}
            isDark={isDark}
          />

          <TabItem
            icon={User}
            label="Profile"
            isFocused={isFocused("profile")}
            onPress={() => navigation.navigate("profile")}
            colors={colors}
            isDark={isDark}
          />
        </View>
      </View>
    </View>
  );
};

const TabItem = ({
  icon: Icon,
  label,
  isFocused,
  onPress,
  colors,
  isDark,
}: any) => (
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
              ? "rgba(16, 185, 129, 0.15)"
              : "rgba(0, 100, 59, 0.08)"
            : "transparent",
        },
      ]}
    >
      <Icon
        color={isFocused ? colors.primary : colors.textMuted}
        size={22}
        strokeWidth={isFocused ? 2.6 : 2}
      />
    </View>

    <Text
      numberOfLines={1}
      style={{
        fontSize: 10,
        color: isFocused ? colors.primary : colors.textMuted,
        fontFamily: isFocused ? "Outfit_700Bold" : "Outfit_500Medium",
        marginTop: 4,
      }}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const ModalAction = ({ icon, label, onPress, colors, isDark }: any) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.modalAction,
      {
        backgroundColor: isDark ? colors.background : "#f8fafc",
        borderColor: colors.border,
      },
    ]}
    activeOpacity={0.75}
  >
    <View
      style={[
        styles.actionIcon,
        {
          backgroundColor: isDark
            ? "rgba(16, 185, 129, 0.14)"
            : "rgba(0, 100, 59, 0.08)",
        },
      ]}
    >
      {icon}
    </View>

    <Text style={[styles.actionLabel, { color: colors.primary }]}>{label}</Text>
  </TouchableOpacity>
);

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
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    textAlign: "center",
  },
});

export default FarmerBottomNavigator;
