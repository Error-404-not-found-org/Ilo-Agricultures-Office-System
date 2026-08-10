import {
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
  Text,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { useClerk, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ChevronRight,
  LogOut,
  HelpCircle,
  User,
  Briefcase,
  Sun,
  Moon,
  Shield,
  Bell,
  MapPin,
  Camera,
  Mail,
  Phone,
  ChevronDown,
  X,
  RefreshCw,
} from "lucide-react-native";
import { toast } from "sonner-native";
import { useColorScheme } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Theme system and UI components
import { useTheme } from "@/lib/theme";
import { useApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getIloiloBarangayOptions,
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
} from "@/constants/address";

const TechnicianProfile = () => {
  const { signOut } = useClerk();
  const { user } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const [statusBarOnHeader, setStatusBarOnHeader] = React.useState(true);
  const [profileHeaderHeight, setProfileHeaderHeight] = React.useState(280);
  const profileHeaderColor = isDark ? "#064e3e" : "#00643B";

  const api = useApi();
  const queryClient = useQueryClient();

  // Query database user profile
  const { data: dbUser } = useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const res = await api.get("/user/me");
      return res.data || {};
    },
  });

  const [editMode, setEditMode] = React.useState<"phone" | "address" | null>(
    null,
  );
  const [formData, setFormData] = React.useState({
    phoneNumber: "",
    street: "",
    barangay: "",
    city: "",
    district: "",
  });

  const [selectModal, setSelectModal] = React.useState({
    visible: false,
    title: "",
    options: [] as string[],
    onSelect: (val: string) => {},
  });

  React.useEffect(() => {
    if (dbUser) {
      setFormData({
        phoneNumber: dbUser.phoneNumber || "",
        street: dbUser.address?.street || "",
        barangay: dbUser.address?.barangay || "",
        city: dbUser.address?.city || "",
        district: dbUser.address?.district || "",
      });
    }
  }, [dbUser]);

  const barangayOptions = React.useMemo(
    () => getIloiloBarangayOptions(formData.city, formData.district),
    [formData.city, formData.district],
  );

  const mutation = useMutation({
    mutationFn: async (updatedData: any) => {
      return await api.put(`/user/${dbUser?._id}`, updatedData);
    },
    onSuccess: () => {
      toast.success("Profile Updated!");
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      setEditMode(null);
    },
    onError: () => toast.error("Update failed."),
  });

  const dispatchMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      return await api.patch(`/technician/dispatch-status`, updatedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
    onError: () => toast.error("Dispatch status update failed."),
  });

  const handleUpdate = async () => {
    if (mutation.isPending) return;
    toast.dismiss();

    if (editMode === "phone") {
      if (!/^09\d{9}$/.test(formData.phoneNumber)) {
        return toast.error(
          "Invalid phone format. Must start with 09 and be 11 digits.",
        );
      }
      mutation.mutate({
        phoneNumber: formData.phoneNumber,
      });
    } else if (editMode === "address") {
      if (!formData.city) {
        return toast.error("Municipality or city is required.");
      }
      if (formData.city === ILOILO_CITY_NAME && !formData.district) {
        return toast.error("District is required for Iloilo City.");
      }
      if (!formData.barangay) {
        return toast.error("Barangay is required.");
      }
      mutation.mutate({
        address: {
          street: formData.street,
          barangay: formData.barangay,
          city: formData.city,
          district: formData.city === ILOILO_CITY_NAME ? formData.district : "",
          province: "Iloilo",
          zipCode: "",
          region: "Region VI",
        },
      });
    }
  };

  const { data: performanceData } = useQuery({
    queryKey: ["technician", "performance"],
    queryFn: async () => {
      const res = await api.get("/analytics/my-performance");
      return res.data;
    },
  });

  const aiStats = performanceData?.ai || {
    totalAI: 0,
    successfulAI: 0,
    failedAI: 0,
    pendingPD: 0,
  };
  const healthStats = performanceData?.health || {
    totalResolved: 0,
    totalInProgress: 0,
  };
  const totalVisits =
    aiStats.totalAI + healthStats.totalResolved + healthStats.totalInProgress;
  const successRate =
    aiStats.totalAI > 0
      ? Math.round((aiStats.successfulAI / aiStats.totalAI) * 100)
      : 0;

  // Dynamic rating based on conception success rate, defaulting to 4.8
  const rating =
    totalVisits > 0 ? (4.0 + (successRate / 100) * 1.0).toFixed(1) : "4.8";

  const handleToggleTheme = async () => {
    const newScheme = colorScheme === "dark" ? "light" : "dark";
    toggleColorScheme();
    try {
      await AsyncStorage.setItem("theme_preference", newScheme);
    } catch (e) {
      console.warn("Failed to save theme preference:", e);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out completely");
      router.replace("/(auth)");
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  return (
    <View
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      style={{ backgroundColor: colors.background }}
    >
      <StatusBar
        barStyle={
          statusBarOnHeader || isDark ? "light-content" : "dark-content"
        }
        backgroundColor={statusBarOnHeader ? profileHeaderColor : colors.card}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: statusBarOnHeader ? profileHeaderColor : colors.card,
          zIndex: 999,
          elevation: 999,
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        onScroll={(event) => {
          const nextOnHeader =
            event.nativeEvent.contentOffset.y <
            profileHeaderHeight - insets.top;
          if (nextOnHeader !== statusBarOnHeader) {
            setStatusBarOnHeader(nextOnHeader);
          }
        }}
        scrollEventThrottle={32}
      >
        {/* Profile Header Backdrop - forest green in both light/dark */}
        <View
          className="pt-14 pb-20 px-6 rounded-b-[40px] items-center relative shadow-lg"
          onLayout={(event) =>
            setProfileHeaderHeight(event.nativeEvent.layout.height)
          }
          style={{ backgroundColor: profileHeaderColor }}
        >
          {/* Profile Picture */}
          <View className="relative mt-4">
            <View className="w-24 h-24 rounded-full border-4 border-white/20 overflow-hidden bg-slate-100 items-center justify-center">
              {user?.imageUrl ? (
                <Image
                  source={{ uri: user.imageUrl }}
                  className="w-full h-full"
                />
              ) : (
                <User size={48} color="#94a3b8" />
              )}
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full items-center justify-center shadow-md"
              style={{ backgroundColor: colors.card }}
            >
              <Camera size={14} color={isDark ? colors.primary : "#00643B"} />
            </TouchableOpacity>
          </View>

          {/* User Full Name */}
          <Text className="text-white font-outfit-bold text-xl mt-4">
            {user?.fullName || "Technician"}
          </Text>

          {/* Role Badge */}
          <View className="flex-row items-center gap-1.5 mt-1 bg-white/10 px-3 py-1 rounded-full">
            <Shield size={12} color="#34d399" />
            <Text className="text-emerald-100 text-[10px] font-outfit-bold uppercase tracking-wider">
              Senior Technician
            </Text>
          </View>
        </View>

        {/* Profile Stats Card (replicates ProfileStatsCard in Farmer Profile) */}
        <View className="px-6 -mt-10">
          <View
            className="rounded-[28px] p-5 flex-row justify-between border shadow-xl dark:shadow-none"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <StatItem
              label="Visits"
              value={totalVisits}
              icon="briefcase"
              color={isDark ? colors.primary : "#00643B"}
            />
            <View
              className="w-[1px] my-1"
              style={{ backgroundColor: colors.border }}
            />
            <StatItem
              label="Success"
              value={`${successRate}%`}
              icon="star"
              color="#eab308"
            />
            <View
              className="w-[1px] my-1"
              style={{ backgroundColor: colors.border }}
            />
            <StatItem
              label="Rating"
              value={rating}
              icon="trophy"
              color="#0891b2"
            />
          </View>
        </View>

        {/* Account Details Section */}
        <View className="px-6 mt-8">
          <Text
            className="font-outfit-black text-[10px] uppercase tracking-widest mb-3 ml-1"
            style={{ color: colors.textMuted }}
          >
            Account Details
          </Text>

          <View
            className="rounded-3xl overflow-hidden border mb-6"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <DetailRow
              icon={<Mail size={18} color={colors.textMuted} />}
              label="Email Address"
              value={user?.primaryEmailAddress?.emailAddress}
            />
            <Divider />
            <DetailRow
              icon={<Phone size={18} color={colors.textMuted} />}
              label="Phone Number"
              value={dbUser?.phoneNumber}
              onPress={() => setEditMode("phone")}
            />
            <Divider />
            <DetailRow
              icon={<MapPin size={18} color={colors.textMuted} />}
              label="Service Barangay"
              value={
                dbUser?.address?.barangay
                  ? `${dbUser.address.street ? dbUser.address.street + ", " : ""}${dbUser.address.barangay}, ${dbUser.address.city || "Iloilo"}`
                  : null
              }
              onPress={() => setEditMode("address")}
            />
          </View>
        </View>

        {/* Dispatch Profile Section */}
        <View className="px-6 mt-8">
          <Text
            className="font-outfit-black text-[10px] uppercase tracking-widest mb-3 ml-1"
            style={{ color: colors.textMuted }}
          >
            Dispatch Profile
          </Text>

          <View
            className="rounded-3xl overflow-hidden border mb-2"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {/* Accepts New Requests Toggle */}
            <TouchableOpacity
              onPress={() => {
                const currentVal =
                  dbUser?.dispatchProfile?.acceptsNewRequests || false;
                dispatchMutation.mutate({ acceptsNewRequests: !currentVal });
              }}
              activeOpacity={0.7}
              style={{
                padding: 18,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.card,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: isDark ? "#1e293b" : "#f8fafc",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Briefcase size={18} color="#0891b2" />
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: "Outfit_600SemiBold",
                      color: colors.textPrimary,
                    }}
                  >
                    Accepting Requests
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: "Outfit_700Bold",
                      color: colors.textMuted,
                      textTransform: "uppercase",
                    }}
                  >
                    {dbUser?.dispatchProfile?.acceptsNewRequests
                      ? "Active"
                      : "Inactive"}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: dbUser?.dispatchProfile?.acceptsNewRequests
                    ? colors.primary
                    : "#e2e8f0",
                  padding: 2,
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: "#fff",
                    alignSelf: dbUser?.dispatchProfile?.acceptsNewRequests
                      ? "flex-end"
                      : "flex-start",
                    shadowColor: "#000",
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                />
              </View>
            </TouchableOpacity>

            <Divider />

            <DetailRow
              icon={<MapPin size={18} color={colors.textMuted} />}
              label="Service Municipalities"
              value={
                dbUser?.dispatchProfile?.serviceMunicipalities
                  ?.map((m: any) => m.municipalityName)
                  .join(", ") || "None"
              }
            />
            {(!dbUser?.dispatchProfile?.serviceMunicipalities ||
              dbUser.dispatchProfile.serviceMunicipalities.length === 0) && (
              <View
                style={{
                  padding: 12,
                  backgroundColor: "rgba(234, 179, 8, 0.1)",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: "#eab308",
                    fontFamily: "Outfit_500Medium",
                    textAlign: "center",
                  }}
                >
                  Warning: No official service coverage assigned.
                </Text>
              </View>
            )}
            <Divider />
            <DetailRow
              icon={<Shield size={18} color={colors.textMuted} />}
              label="Service Capabilities"
              value={
                dbUser?.dispatchProfile?.serviceCapabilities?.join(", ") ||
                "None"
              }
            />
          </View>
        </View>

        {/* System & Support Section */}
        <View className="px-6 mt-6">
          <Text
            className="font-outfit-black text-[10px] uppercase tracking-widest mb-3 ml-1"
            style={{ color: colors.textMuted }}
          >
            System & Support
          </Text>

          <View
            className="rounded-3xl overflow-hidden border mb-10"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {/* Theme Mode Switcher */}
            <TouchableOpacity
              onPress={handleToggleTheme}
              activeOpacity={0.7}
              style={{
                padding: 18,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.card,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: isDark ? "#1e293b" : "#f8fafc",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isDark ? (
                    <Moon size={18} color="#94a3b8" />
                  ) : (
                    <Sun size={18} color="#f59e0b" />
                  )}
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: "Outfit_600SemiBold",
                      color: colors.textPrimary,
                    }}
                  >
                    Theme Mode
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: "Outfit_700Bold",
                      color: colors.textMuted,
                      textTransform: "uppercase",
                    }}
                  >
                    {isDark ? "Dark Mode" : "Light Mode"}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: isDark ? colors.primary : "#e2e8f0",
                  padding: 2,
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: "#fff",
                    alignSelf: isDark ? "flex-end" : "flex-start",
                    shadowColor: "#000",
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                />
              </View>
            </TouchableOpacity>

            <Divider />

            <ActionItem
              icon={<Briefcase size={18} color={colors.textSecondary} />}
              label="Service Schedule"
              onPress={() =>
                router.push("/(technician)/technician.calendar" as any)
              }
            />

            <Divider />

            <ActionItem
              icon={<Bell size={18} color={colors.textSecondary} />}
              label="Notifications"
              onPress={() => router.push("/notifications")}
            />

            <Divider />

            <ActionItem
              icon={<RefreshCw size={18} color={colors.textSecondary} />}
              label="Sync Center"
              onPress={() => router.push("/(technician)/sync-history" as any)}
            />

            <Divider />

            <ActionItem
              icon={<Shield size={18} color={colors.textSecondary} />}
              label="Privacy Policy"
              onPress={() => router.push("/privacy-policy" as any)}
            />

            <Divider />

            <ActionItem
              icon={<HelpCircle size={18} color={colors.textSecondary} />}
              label="Help & Support"
              onPress={() => router.push("/help-center")}
            />
          </View>
        </View>

        {/* Destructive Log Out Button */}
        <TouchableOpacity
          onPress={handleSignOut}
          activeOpacity={0.7}
          className="mx-6 p-4 rounded-[24px] flex-row items-center justify-center gap-2.5 border mb-6"
          style={{
            backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2",
            borderColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fee2e2",
          }}
        >
          <LogOut size={20} color="#ef4444" strokeWidth={2.5} />
          <Text
            className="text-sm font-outfit-bold"
            style={{ color: "#ef4444" }}
          >
            Log Out Account
          </Text>
        </TouchableOpacity>

        {/* Version Information */}
        <Text
          className="text-center font-outfit-semibold text-[11px] mb-12"
          style={{ color: colors.textMuted }}
        >
          Version 2.4.0 — Premium Build
        </Text>
      </ScrollView>

      {/* Profile Editing Modal */}
      <Modal
        visible={editMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditMode(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "center",
              paddingHorizontal: 22,
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.card,
                borderRadius: 28,
                padding: 24,
                paddingBottom: Math.max(insets.bottom, 24),
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 24,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_900Black",
                    fontSize: 20,
                    color: colors.textPrimary,
                  }}
                >
                  {editMode === "phone"
                    ? "Edit Phone Number"
                    : "Edit Service Barangay"}
                </Text>
                <TouchableOpacity onPress={() => setEditMode(null)}>
                  <X size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 0 }}>
                {editMode === "phone" && (
                  <View>
                    <Text
                      className="font-outfit-medium text-sm leading-5 mb-5"
                      style={{ color: colors.textMuted }}
                    >
                      Add or update the phone number farmers can use to contact
                      you for AI, health assistance, and scheduled visits.
                    </Text>
                    <View className="flex-row">
                      <ProfileInputField
                        label="Phone Number"
                        value={formData.phoneNumber}
                        onChangeText={(t: string) =>
                          setFormData({
                            ...formData,
                            phoneNumber: t.replace(/\D/g, "").slice(0, 11),
                          })
                        }
                        placeholder="09XXXXXXXXX"
                        keyboardType="phone-pad"
                        maxLength={11}
                        large
                      />
                    </View>
                  </View>
                )}

                {editMode === "address" && (
                  <View>
                    <View className="flex-row">
                      <ProfileInputField
                        label="Purok / Street (Optional)"
                        value={formData.street}
                        onChangeText={(t: string) =>
                          setFormData({ ...formData, street: t })
                        }
                        placeholder="Purok / Street"
                        maxLength={80}
                      />
                    </View>

                    <View className="flex-row">
                      <SelectField
                        label="Municipality / City"
                        value={formData.city}
                        onPress={() =>
                          setSelectModal({
                            visible: true,
                            title: "Select Municipality / City",
                            options: ILOILO_MUNICIPALITY_OPTIONS,
                            onSelect: (val) =>
                              setFormData({
                                ...formData,
                                city: val,
                                district: "",
                                barangay: "",
                              }),
                          })
                        }
                      />
                    </View>

                    {formData.city === ILOILO_CITY_NAME && (
                      <View className="flex-row">
                        <SelectField
                          label="District"
                          value={formData.district}
                          onPress={() =>
                            setSelectModal({
                              visible: true,
                              title: "Select Iloilo City District",
                              options: ILOILO_CITY_DISTRICT_OPTIONS,
                              onSelect: (val) =>
                                setFormData({
                                  ...formData,
                                  district: val,
                                  barangay: "",
                                }),
                            })
                          }
                        />
                      </View>
                    )}

                    <View className="flex-row">
                      <SelectField
                        label="Barangay"
                        value={formData.barangay}
                        onPress={() =>
                          setSelectModal({
                            visible: true,
                            title: !formData.city
                              ? "Select Municipality / City First"
                              : formData.city === ILOILO_CITY_NAME &&
                                  !formData.district
                                ? "Select Iloilo City District First"
                                : "Select Barangay",
                            options: barangayOptions,
                            onSelect: (val) =>
                              setFormData({ ...formData, barangay: val }),
                          })
                        }
                      />
                    </View>
                  </View>
                )}

                {/* Save Button */}
                <TouchableOpacity
                  onPress={handleUpdate}
                  disabled={mutation.isPending}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: isDark ? colors.primary : "#00643B",
                    borderRadius: 16,
                    paddingVertical: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 16,
                    opacity: mutation.isPending ? 0.6 : 1,
                  }}
                >
                  {mutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 16,
                        fontFamily: "Outfit_700Bold",
                      }}
                    >
                      Save Changes
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Select Options Dropdown Modal */}
      <Modal
        visible={selectModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setSelectModal({ ...selectModal, visible: false })
        }
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setSelectModal({ ...selectModal, visible: false })}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxHeight: "60%",
              backgroundColor: colors.card,
              borderRadius: 28,
              padding: 24,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_900Black",
                fontSize: 18,
                color: colors.textPrimary,
                marginBottom: 16,
              }}
            >
              {selectModal.title}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectModal.options.map((opt, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    selectModal.onSelect(opt);
                    setSelectModal({ ...selectModal, visible: false });
                  }}
                  style={{
                    paddingVertical: 16,
                    borderBottomWidth:
                      idx === selectModal.options.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 15,
                      color: colors.textPrimary,
                    }}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// Local reusable stat item
const StatItem = ({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: string;
}) => {
  const { colors } = useTheme();
  return (
    <View className="flex-1 items-center">
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <Text
        className="text-xl font-outfit-black mt-1"
        style={{ color: colors.textPrimary }}
      >
        {value}
      </Text>
      <Text
        className="text-[9px] font-outfit-bold uppercase tracking-widest"
        style={{ color: colors.textMuted }}
      >
        {label}
      </Text>
    </View>
  );
};

// Divider component
const Divider = () => {
  const { colors } = useTheme();
  return (
    <View
      className="h-[1px] ml-16"
      style={{ backgroundColor: colors.border }}
    />
  );
};

// Reusable Detail Row matching Farmer design
const DetailRow = ({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  onPress?: () => void;
}) => {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      className="p-4 flex-row items-center gap-4 active:bg-slate-50 dark:active:bg-slate-800"
      style={{ backgroundColor: colors.card }}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center"
        style={{ backgroundColor: isDark ? colors.background : "#f8fafc" }}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text
          className="text-[9px] font-outfit-bold uppercase tracking-widest"
          style={{ color: colors.textMuted }}
        >
          {label}
        </Text>
        <Text
          className="text-sm font-outfit-semibold mt-0.5"
          style={{ color: colors.textPrimary }}
        >
          {value || "Not Set"}
        </Text>
      </View>
      {onPress && <ChevronRight size={16} color={colors.textMuted} />}
    </TouchableOpacity>
  );
};

// Reusable Action Row matching Farmer design
const ActionItem = ({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) => {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      className="p-4 flex-row items-center justify-between active:bg-slate-50 dark:active:bg-slate-800"
      style={{ backgroundColor: colors.card }}
    >
      <View className="flex-row items-center gap-4">
        <View
          className="w-9 h-9 rounded-xl items-center justify-center"
          style={{
            backgroundColor: isDark ? colors.background : "#f8fafc",
          }}
        >
          {icon}
        </View>
        <Text
          className="text-sm font-outfit-semibold"
          style={{ color: colors.textPrimary }}
        >
          {label}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
};

// Reusable input fields for editing
const ProfileInputField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  maxLength,
  secureTextEntry = false,
  large = false,
}: any) => {
  const { colors } = useTheme();
  return (
    <View className="flex-1 mb-4">
      <Text
        className="text-[10px] font-outfit-black uppercase mb-1.5 ml-1 tracking-widest"
        style={{ color: colors.textMuted }}
      >
        {label}
      </Text>
      <View style={{ justifyContent: "center" }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          maxLength={maxLength}
          secureTextEntry={secureTextEntry}
          className="border rounded-2xl pl-4 pr-12 font-outfit-medium"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.textPrimary,
            minHeight: large ? 58 : 48,
            paddingTop: large ? 16 : 12,
            paddingBottom: large ? 16 : 12,
            fontSize: large ? 15 : 13,
          }}
          placeholderTextColor={colors.textMuted}
        />
      </View>
    </View>
  );
};

const SelectField = ({ label, value, onPress }: any) => {
  const { colors } = useTheme();
  return (
    <View className="flex-1 mb-4">
      <Text
        className="text-[10px] font-outfit-black uppercase mb-1.5 ml-1 tracking-widest"
        style={{ color: colors.textMuted }}
      >
        {label}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        className="border rounded-2xl px-4 py-3.5 flex-row justify-between items-center"
        style={{
          height: 48,
          backgroundColor: colors.card,
          borderColor: colors.border,
        }}
      >
        <Text
          className="font-outfit-medium text-sm"
          style={{ color: value ? colors.textPrimary : colors.textMuted }}
        >
          {value || "Select"}
        </Text>
        <ChevronDown size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
};

export default TechnicianProfile;
