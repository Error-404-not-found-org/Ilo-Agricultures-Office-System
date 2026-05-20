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

const COLORS = {
  primary: "#00643B",
  active: "#00643B",
  inactive: "#94a3b8",
  white: "#ffffff",
};

const FarmerBottomNavigator = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  const focusedRouteKey = state.routes[state.index].key;
  const focusedOptions = descriptors[focusedRouteKey].options;

  if ((focusedOptions.tabBarStyle as any)?.display === "none") {
    return null;
  }

  const [modalVisible, setModalVisible] = useState(false);

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
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Quick Actions</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <X size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalGrid}>
                <ModalAction
                  icon={<Syringe size={24} color={COLORS.primary} />}
                  label="Request AI"
                  onPress={() => handleModalAction("/(farmer)/request-ai")}
                />
                <ModalAction
                  icon={
                    <MessageCircleQuestion size={24} color={COLORS.primary} />
                  }
                  label="Report Issue"
                  onPress={() => handleModalAction("/(farmer)/report-sickness")}
                />
                <ModalAction
                  icon={<FileText size={24} color={COLORS.primary} />}
                  label="My Requests"
                  onPress={() => handleModalAction("/(farmer)/my-requests")}
                />
                <ModalAction
                  icon={<Plus size={24} color={COLORS.primary} />}
                  label="Add Animal"
                  onPress={() => handleModalAction("/(farmer)/add-animal")}
                />
                <ModalAction
                  icon={<Map size={24} color={COLORS.primary} />}
                  label="Disease Map"
                  onPress={() => handleModalAction("/(farmer)/heat-map")}
                />
                <ModalAction
                  icon={<Sparkles size={24} color={COLORS.primary} />}
                  label="Ask Moowie"
                  onPress={() => handleModalAction("/ask-moowie")}
                />
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <View style={styles.tabContainer}>
        <View style={styles.tabBar}>
          <TabItem
            icon={Home}
            label="Farm"
            isFocused={isFocused("index")}
            onPress={() => onNavigate("index")}
          />
          <TabItem
            icon={Dog}
            label="Cattle"
            isFocused={isFocused("add-animal")}
            onPress={() => onNavigate("add-animal")}
          />

          <View style={styles.centerSpace} />

          <TabItem
            icon={FileText}
            label="Records"
            isFocused={isFocused("farmer.records")}
            onPress={() => onNavigate("farmer.records")}
          />
          <TabItem
            icon={User}
            label="Profile"
            isFocused={isFocused("profile")}
            onPress={() => onNavigate("profile")}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setModalVisible(true)}
          style={styles.fab}
        >
          <Plus color="#fff" size={28} strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const TabItem = ({ icon: Icon, label, isFocused, onPress }: any) => (
  <TouchableOpacity
    onPress={onPress}
    style={styles.tabItem}
    activeOpacity={0.7}
  >
    <View style={[styles.iconWrapper, isFocused && styles.activeIconWrapper]}>
      <Icon
        color={isFocused ? COLORS.active : COLORS.inactive}
        size={22}
        strokeWidth={isFocused ? 2.5 : 2}
      />
    </View>
    <Text
      style={{
        fontSize: 10,
        color: isFocused ? COLORS.active : COLORS.inactive,
        fontFamily: isFocused ? "Outfit_700Bold" : "Outfit_500Medium",
        marginTop: 4,
      }}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const ModalAction = ({ icon, label, onPress }: any) => (
  <TouchableOpacity
    onPress={onPress}
    style={styles.modalAction}
    activeOpacity={0.7}
  >
    <View style={styles.actionIcon}>{icon}</View>
    <Text style={styles.actionLabel}>{label}</Text>
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
    backgroundColor: "#fff",
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
  activeIconWrapper: {
    backgroundColor: "rgba(0, 100, 59, 0.08)",
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
    backgroundColor: "#00643B",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#00643B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 4,
    borderColor: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
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
    color: "#1e293b",
  },
  modalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  modalAction: {
    width: "48%",
    backgroundColor: "#f8fafc",
    padding: 20,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    marginBottom: 16,
  },
  actionIcon: {
    marginBottom: 12,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: "#00643B",
  },
});

export default FarmerBottomNavigator;
