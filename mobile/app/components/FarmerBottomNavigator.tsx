import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
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
  Map,
  Sparkles,
} from "lucide-react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import { useTheme } from "@/lib/theme";

const FarmerBottomNavigator = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  const { colors, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const focusedRouteKey = state.routes[state.index].key;
  const focusedOptions = descriptors[focusedRouteKey].options;

  if ((focusedOptions.tabBarStyle as any)?.display === "none") {
    return null;
  }

  const onNavigate = (screenName: string) => {
    navigation.navigate(screenName);
  };

  const isFocused = (screenName: string) => {
    const route = state.routes.find((r) => r.name === screenName);
    return route ? state.index === state.routes.indexOf(route) : false;
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
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalGrid}>
                <ModalAction
                  icon={<Syringe size={24} color={colors.primary} />}
                  label="Request AI"
                  onPress={() => handleModalAction("/(farmer)/request-ai")}
                  colors={colors}
                  isDark={isDark}
                />
                <ModalAction
                  icon={
                    <MessageCircleQuestion size={24} color={colors.primary} />
                  }
                  label="Report Issue"
                  onPress={() => handleModalAction("/(farmer)/report-sickness")}
                  colors={colors}
                  isDark={isDark}
                />
                <ModalAction
                  icon={<FileText size={24} color={colors.primary} />}
                  label="My Requests"
                  onPress={() => handleModalAction("/(farmer)/my-requests")}
                  colors={colors}
                  isDark={isDark}
                />
                <ModalAction
                  icon={<Plus size={24} color={colors.primary} />}
                  label="Add Animal"
                  onPress={() => handleModalAction("/(farmer)/add-animal")}
                  colors={colors}
                  isDark={isDark}
                />
                <ModalAction
                  icon={<Map size={24} color={colors.primary} />}
                  label="Disease Map"
                  onPress={() => handleModalAction("/(farmer)/heat-map")}
                  colors={colors}
                  isDark={isDark}
                />
                <ModalAction
                  icon={<Sparkles size={24} color={colors.primary} />}
                  label="Ask Moowie"
                  onPress={() => handleModalAction("/ask-moowie")}
                  colors={colors}
                  isDark={isDark}
                />
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <View style={styles.tabContainer}>
        <View style={[
          styles.tabBar, 
          { 
            backgroundColor: colors.card,
            borderWidth: isDark ? 1 : 0,
            borderColor: colors.border,
          }
        ]}>
          <TabItem
            icon={Home}
            label="Home"
            isFocused={isFocused("index")}
            onPress={() => onNavigate("index")}
            colors={colors}
            isDark={isDark}
          />
          <TabItem
            icon={Dog}
            label="Animals"
            isFocused={isFocused("add-animal")}
            onPress={() => onNavigate("add-animal")}
            colors={colors}
            isDark={isDark}
          />

          <View style={styles.centerSpace} />

          <TabItem
            icon={FileText}
            label="Records"
            isFocused={isFocused("farmer.records")}
            onPress={() => onNavigate("farmer.records")}
            colors={colors}
            isDark={isDark}
          />
          <TabItem
            icon={User}
            label="Profile"
            isFocused={isFocused("profile")}
            onPress={() => onNavigate("profile")}
            colors={colors}
            isDark={isDark}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setModalVisible(true)}
          style={[
            styles.fab,
            {
              backgroundColor: colors.primary,
              borderColor: colors.card,
              shadowColor: colors.primary,
            }
          ]}
        >
          <Plus color="#fff" size={28} strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const TabItem = ({ icon: Icon, label, isFocused, onPress, colors, isDark }: any) => (
  <TouchableOpacity
    onPress={onPress}
    style={styles.tabItem}
    activeOpacity={0.7}
  >
    <View style={[
      styles.iconWrapper, 
      isFocused && { backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(0, 100, 59, 0.08)" }
    ]}>
      <Icon
        color={isFocused ? colors.primary : colors.textMuted}
        size={22}
        strokeWidth={isFocused ? 2.5 : 2}
      />
    </View>
    <Text
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
      }
    ]}
    activeOpacity={0.7}
  >
    <View style={styles.actionIcon}>{icon}</View>
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
    height: 90,
    justifyContent: "flex-end",
    paddingBottom: Platform.OS === "ios" ? 25 : 15,
  },
  tabBar: {
    flexDirection: "row",
    height: 65,
    marginHorizontal: 16,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    padding: 6,
    borderRadius: 12,
  },
  centerSpace: {
    width: 60,
  },
  fab: {
    position: "absolute",
    top: 0,
    left: "50%",
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 4,
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
    paddingBottom: 40,
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
  modalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  modalAction: {
    width: "48%",
    padding: 20,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 16,
  },
  actionIcon: {
    marginBottom: 12,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
  },
});

export default FarmerBottomNavigator;
