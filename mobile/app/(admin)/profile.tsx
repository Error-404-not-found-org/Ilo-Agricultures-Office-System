import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import SafeScreen from "@/components/safeScreen";
import { useClerk, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ChevronRight,
  LogOut,
  Settings,
  HelpCircle,
  User,
  Shield,
  UserPlus,
  Sun,
  Moon,
  ShieldCheck,
} from "lucide-react-native";
import { toast } from "sonner-native";
import { useColorScheme } from "nativewind";
import { useTheme } from "@/lib/theme";
import { useApi } from "@/lib/api";
import { signOutWithPushCleanup } from "@/lib/notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CustomDialog } from "@/components/shared";

const PRIMARY = "#1e3a5f";

const AdminProfile = () => {
  const { signOut } = useClerk();
  const { user } = useUser();
  const router = useRouter();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const api = useApi();

  // Edit name state
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState(user?.firstName || "");
  const [editLastName, setEditLastName] = useState(user?.lastName || "");
  const [savingName, setSavingName] = useState(false);

  const [personalVisible, setPersonalVisible] = useState(false);
  const [preferencesVisible, setPreferencesVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);

  const saveProfileName = async () => {
    if (!editFirstName.trim()) {
      toast.error("First name cannot be empty.");
      return;
    }
    setSavingName(true);
    try {
      await user?.update({
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
      });
      toast.success("Name updated successfully!");
      setIsEditing(false);
    } catch {
      toast.error("Failed to update name.");
    } finally {
      setSavingName(false);
    }
  };

  const handleEditProfileTrigger = () => {
    setEditFirstName(user?.firstName || "");
    setEditLastName(user?.lastName || "");
    setIsEditing(true);
  };

  const showPersonalInfo = () => {
    setPersonalVisible(true);
  };

  const showPreferences = () => {
    setPreferencesVisible(true);
  };

  const showAboutApp = () => {
    setAboutVisible(true);
  };

  const handleSignOut = async () => {
    try {
      await signOutWithPushCleanup(api, signOut);
      toast.success("Signed out successfully");
      router.replace("/(auth)");
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  const handleToggleTheme = async () => {
    const newScheme = colorScheme === "dark" ? "light" : "dark";
    toggleColorScheme();
    try {
      await AsyncStorage.setItem("theme_preference", newScheme);
    } catch (e) {
      console.warn("Failed to save theme preference:", e);
    }
  };

  return (
    <SafeScreen>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section (Deep Navy Blue Background, Rounded bottom 40px) */}
        <View
          style={{
            backgroundColor: PRIMARY,
            borderBottomLeftRadius: 40,
            borderBottomRightRadius: 40,
            paddingTop: 40,
            paddingBottom: 48,
            paddingHorizontal: 24,
            alignItems: "center",
            position: "relative",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 5,
          }}
        >
          {/* Edit Button in Header */}
          <TouchableOpacity
            onPress={handleEditProfileTrigger}
            style={{
              position: "absolute",
              top: 16,
              right: 24,
              padding: 8,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontFamily: "Outfit_700Bold",
                fontSize: 14,
              }}
            >
              Edit
            </Text>
          </TouchableOpacity>

          {/* Profile Picture */}
          <View style={{ position: "relative" }}>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                borderWidth: 4,
                borderColor: "rgba(255, 255, 255, 0.2)",
                overflow: "hidden",
                backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {user?.imageUrl ? (
                <Image
                  source={{ uri: user.imageUrl }}
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <Shield size={44} color="#94a3b8" />
              )}
            </View>
          </View>

          {/* Profile Name & Email */}
          <Text
            style={{
              color: "#fff",
              fontFamily: "Outfit_700Bold",
              fontSize: 20,
              marginTop: 16,
              textAlign: "center",
            }}
          >
            {user?.fullName || "Admin"}
          </Text>

          <Text
            style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontFamily: "Outfit_500Medium",
              fontSize: 13,
              marginTop: 4,
              textAlign: "center",
            }}
          >
            {user?.primaryEmailAddress?.emailAddress || "No email registered"}
          </Text>

          {/* Translucent Badge */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 12,
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 20,
            }}
          >
            <ShieldCheck size={12} color="#34d399" />
            <Text
              style={{
                color: "#e2e8f0",
                fontSize: 12,
                fontFamily: "Outfit_700Bold",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Administrator
            </Text>
          </View>
        </View>

        {/* Administration Section */}
        <View style={{ paddingHorizontal: 24, marginTop: 32 }}>
          <Text
            style={{
              fontFamily: "Outfit_800ExtraBold",
              fontSize: 12,
              color: colors.textMuted,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              marginBottom: 12,
              marginLeft: 4,
            }}
          >
            Administration
          </Text>

          <View
            style={{
              borderRadius: 24,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            <MenuItem
              icon={<UserPlus size={18} color={colors.textSecondary} />}
              label="Create New User"
              onPress={() => router.push("/(admin)/create-user" as any)}
            />
            <Divider />
            <MenuItem
              icon={<User size={18} color={colors.textSecondary} />}
              label="Personal Information"
              onPress={showPersonalInfo}
            />
            <Divider />
            <MenuItem
              icon={
                colorScheme === "dark" ? (
                  <Sun size={18} color="#f59e0b" />
                ) : (
                  <Moon size={18} color="#94a3b8" />
                )
              }
              label="Theme Mode"
              value={colorScheme === "dark" ? "Dark Mode" : "Light Mode"}
              onPress={handleToggleTheme}
            />
            <Divider />
            <MenuItem
              icon={<Settings size={18} color={colors.textSecondary} />}
              label="Preferences"
              onPress={showPreferences}
            />
          </View>
        </View>

        {/* Support Section */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <Text
            style={{
              fontFamily: "Outfit_800ExtraBold",
              fontSize: 12,
              color: colors.textMuted,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              marginBottom: 12,
              marginLeft: 4,
            }}
          >
            Support
          </Text>

          <View
            style={{
              borderRadius: 24,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            <MenuItem
              icon={<HelpCircle size={18} color={colors.textSecondary} />}
              label="Help & FAQ"
              onPress={() => router.push("/help-center" as any)}
            />
            <Divider />
            <MenuItem
              icon={
                <MaterialCommunityIcons
                  name="information-outline"
                  size={18}
                  color={colors.textSecondary}
                />
              }
              label="About App"
              onPress={showAboutApp}
            />
          </View>
        </View>

        {/* Sign Out Button */}
        <View style={{ paddingHorizontal: 24, marginTop: 32 }}>
          <TouchableOpacity
            onPress={handleSignOut}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
              borderWidth: 1,
              borderColor: isDark ? "rgba(239, 68, 68, 0.25)" : "#fee2e2",
              paddingVertical: 16,
              borderRadius: 16,
              gap: 8,
            }}
          >
            <LogOut size={18} color="#ef4444" />
            <Text
              style={{
                color: "#ef4444",
                fontFamily: "Outfit_700Bold",
                fontSize: 15,
              }}
            >
              Sign Out
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              textAlign: "center",
              color: colors.textMuted,
              fontFamily: "Outfit_600SemiBold",
              fontSize: 12,
              marginTop: 24,
            }}
          >
            Version 1.0.0
          </Text>
        </View>

        {/* Custom Edit Name Modal */}
        <Modal
          visible={isEditing}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsEditing(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 24,
            }}
          >
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 32,
                width: "100%",
                padding: 24,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 15,
                elevation: 5,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: "Outfit_800ExtraBold",
                  color: colors.textPrimary,
                  marginBottom: 20,
                }}
              >
                Edit Profile Name
              </Text>

              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Outfit_700Bold",
                  color: colors.textSecondary,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                First Name
              </Text>
              <TextInput
                style={{
                  backgroundColor: isDark ? colors.background : "#f8fafc",
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 14,
                  fontFamily: "Outfit_500Medium",
                  color: colors.textPrimary,
                  marginBottom: 16,
                }}
                value={editFirstName}
                onChangeText={setEditFirstName}
                placeholder="First Name"
                placeholderTextColor={colors.textMuted}
              />

              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Outfit_700Bold",
                  color: colors.textSecondary,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Last Name
              </Text>
              <TextInput
                style={{
                  backgroundColor: isDark ? colors.background : "#f8fafc",
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 14,
                  fontFamily: "Outfit_500Medium",
                  color: colors.textPrimary,
                  marginBottom: 24,
                }}
                value={editLastName}
                onChangeText={setEditLastName}
                placeholder="Last Name"
                placeholderTextColor={colors.textMuted}
              />

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setIsEditing(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "#f1f5f9",
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 14,
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={saveProfileName}
                  disabled={savingName}
                  style={{
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: PRIMARY,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 80,
                  }}
                >
                  {savingName ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text
                      style={{
                        color: "white",
                        fontFamily: "Outfit_700Bold",
                        fontSize: 14,
                      }}
                    >
                      Save
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>

      {/* Personal Info Dialog */}
      <CustomDialog
        visible={personalVisible}
        title="Personal Information"
        description={`Full Name: ${user?.fullName || "N/A"}\nEmail: ${user?.primaryEmailAddress?.emailAddress || "N/A"}\nCreated: ${user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}\nRole: Administrator`}
        onClose={() => setPersonalVisible(false)}
        icon={
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: "rgba(37,99,235,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <User size={26} color="#2563eb" />
          </View>
        }
        actions={[
          {
            text: "Close",
            variant: "cancel",
            onPress: () => setPersonalVisible(false),
          },
        ]}
      />

      {/* Preferences Dialog */}
      <CustomDialog
        visible={preferencesVisible}
        title="App Preferences"
        description={`Current Theme: ${colorScheme === "dark" ? "Dark Mode 🌙" : "Light Mode ☀️"}\n\nDo you want to toggle the visual theme?`}
        onClose={() => setPreferencesVisible(false)}
        icon={
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: "rgba(245,158,11,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Settings size={26} color="#f59e0b" />
          </View>
        }
        actions={[
          {
            text: "Toggle Theme",
            variant: "primary",
            onPress: () => {
              setPreferencesVisible(false);
              handleToggleTheme();
            },
          },
          {
            text: "Close",
            variant: "cancel",
            onPress: () => setPreferencesVisible(false),
          },
        ]}
      />

      {/* About App Dialog */}
      <CustomDialog
        visible={aboutVisible}
        title="About BreedSmart"
        description="BreedSmart is a unified livestock management system for Oton, Iloilo. Developed under DA RFU VI standards to streamline Artificial Insemination, pregnancy diagnostics, and calving monitoring."
        onClose={() => setAboutVisible(false)}
        icon={
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: "rgba(124,58,237,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HelpCircle size={26} color="#7c3aed" />
          </View>
        }
        actions={[
          {
            text: "Close",
            variant: "cancel",
            onPress: () => setAboutVisible(false),
          },
        ]}
      />
    </SafeScreen>
  );
};

// ── Menu Item Component ────────────────────────────────────────
const MenuItem = ({
  icon,
  label,
  value,
  onPress,
  isDestructive,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  onPress: () => void;
  isDestructive?: boolean;
}) => {
  const { colors, isDark } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.card,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isDestructive
              ? isDark
                ? "rgba(239, 68, 68, 0.2)"
                : "#fef2f2"
              : isDark
                ? colors.background
                : "#f8fafc",
          }}
        >
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: isDestructive
                ? "Outfit_700Bold"
                : "Outfit_600SemiBold",
              color: isDestructive ? colors.error : colors.textPrimary,
            }}
          >
            {label}
          </Text>
          {value && (
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Outfit_500Medium",
                color: colors.textSecondary,
                marginTop: 2,
              }}
            >
              {value}
            </Text>
          )}
        </View>
      </View>
      <ChevronRight size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
};

// ── Divider Component ──────────────────────────────────────────
const Divider = () => {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: 1,
        marginLeft: 64,
        backgroundColor: colors.border,
      }}
    />
  );
};

export default AdminProfile;
