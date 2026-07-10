import {
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Save, X, ChevronDown } from "lucide-react-native";
import React, { useMemo, useState, useEffect } from "react";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import SafeScreen from "@/components/safeScreen";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import {
  formatBarangayWithDistrict,
  getIloiloBarangayOptions,
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
} from "@/constants/address";

const parseBarangayWithDistrict = (value = "") => {
  const match = value.match(/(.+?)\s*\(([^)]+)\)$/);
  if (!match) return { barangay: value, district: "" };
  return { barangay: match[1].trim(), district: match[2].trim() };
};

export default function UpdateClientProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const api = useApi();
  const { colors, isDark, themeStyle } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    barangay: "",
    city: "",
    district: "",
    province: "Iloilo",
  });

  const [pickerState, setPickerState] = useState<
    null | "city" | "district" | "barangay"
  >(null);
  const [searchPicker, setSearchPicker] = useState("");

  const barangayOptions = useMemo(
    () => getIloiloBarangayOptions(formData.city, formData.district),
    [formData.city, formData.district],
  );

  const pickerTitle =
    pickerState === "city"
      ? "Select Municipality / City"
      : pickerState === "district"
        ? "Select Iloilo City District"
        : "Select Barangay";

  const pickerData =
    pickerState === "city"
      ? ILOILO_MUNICIPALITY_OPTIONS
      : pickerState === "district"
        ? ILOILO_CITY_DISTRICT_OPTIONS
        : barangayOptions;

  const filteredOptions = pickerData.filter((item) =>
    item.toLowerCase().includes(searchPicker.toLowerCase()),
  );

  useEffect(() => {
    if (!id) return;
    const fetchClient = async () => {
      try {
        const res = await api.get(`/user/${id}`);
        const user = res.data;
        const addr = user.address || {};
        const parsedAddress = parseBarangayWithDistrict(addr.barangay || "");

        setFormData({
          name: user.name || "",
          email: user.email || "",
          phoneNumber: addr.phoneNumber || user.phoneNumber || "",
          barangay: parsedAddress.barangay,
          city: addr.city || "",
          district: addr.district || parsedAddress.district || "",
          province: addr.province || "Iloilo",
        });
      } catch (error) {
        console.error("Failed to load user for editing:", error);
        toast.error("Could not load client details");
        router.back();
      } finally {
        setLoading(false);
      }
    };
    fetchClient();
  }, [id]);

  const handleSave = async () => {
    if (
      !formData.phoneNumber.trim() ||
      !/^\d{11}$/.test(formData.phoneNumber)
    ) {
      return toast.error("Phone number must be exactly 11 digits.");
    }
    if (!formData.barangay) {
      return toast.error("Barangay is required.");
    }
    if (!formData.city) {
      return toast.error("Municipality / city is required.");
    }
    if (formData.city === ILOILO_CITY_NAME && !formData.district) {
      return toast.error("Please select the Iloilo City district.");
    }

    try {
      setSaving(true);
      const payload = {
        phoneNumber: formData.phoneNumber.trim(),
        address: {
          phoneNumber: formData.phoneNumber.trim(), // Syncing backwards to support legacy nested schema
          barangay: formatBarangayWithDistrict(
            formData.barangay,
            formData.city,
            formData.district,
          ),
          city: formData.city.trim(),
          district: formData.city === ILOILO_CITY_NAME ? formData.district : "",
          province: formData.province.trim(),
        },
      };

      await api.patch(`/user/${id}/technician-update`, payload);
      toast.success("Profile Updated!", {
        duration: 3000,
        position: "top-center",
      });
      router.back(); // Kick user directly back to the Profile Display!
    } catch (error: any) {
      console.error("Failed to save profile modifications:", error);
      toast.error(
        error.response?.data?.message || "Error saving profile. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F9FAFB] dark:bg-slate-950">
        <ActivityIndicator
          size="large"
          color={isDark ? "#10b981" : "#00643B"}
        />
      </View>
    );
  }

  return (
    <SafeScreen>
      <View
        style={[{ flex: 1, backgroundColor: colors.background }]}
        className="px-5"
      >
        {/* COMPACT HEADER */}
        <View className="flex-row items-center justify-between mb-4 mt-2">
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
            className="p-2 rounded-full border active:opacity-75"
          >
            <ArrowLeft size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="bold" size={16} color="primary">
            Edit Profile
          </Text>
          <View className="w-10" />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            <Card style={{ padding: 20 }} className="mt-2 mb-6">
              <Text variant="black" size={18} color="primary" className="mb-1">
                Personal Information
              </Text>
              <Text variant="medium" size={13} color="muted" className="mb-5">
                Ensure the profile data is accurate.
              </Text>

              <InputField
                label="Full Name (Read-Only)"
                value={formData.name}
                onChangeText={(t: string) =>
                  setFormData({ ...formData, name: t })
                }
                placeholder="Juan Dela Cruz"
                editable={false}
              />

              <InputField
                label="Phone Number *"
                value={formData.phoneNumber}
                onChangeText={(t: string) =>
                  setFormData({ ...formData, phoneNumber: t })
                }
                placeholder="09123456789"
                keyboardType="phone-pad"
                maxLength={11}
              />

              <InputField
                label="Email Address (Read-Only)"
                value={formData.email}
                onChangeText={(t: string) =>
                  setFormData({ ...formData, email: t })
                }
                placeholder="farmer@example.com"
                keyboardType="email-address"
                editable={false}
              />
            </Card>

            <Card style={{ padding: 20 }} className="mb-4">
              <Text variant="black" size={18} color="primary" className="mb-1">
                Location Details
              </Text>
              <Text variant="medium" size={13} color="muted" className="mb-5">
                Update geographical sector address markers.
              </Text>

              {/* Municipality / City Selection */}
              <View className="mb-3">
                <Text
                  variant="bold"
                  size={10}
                  color="secondary"
                  className="uppercase tracking-wider mb-1.5 ml-1"
                >
                  Municipality / City *
                </Text>
                <TouchableOpacity
                  onPress={() => setPickerState("city")}
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                  className="border rounded-xl p-3.5 flex-row justify-between items-center"
                >
                  <Text
                    variant="semibold"
                    size={14}
                    style={{
                      color: formData.city
                        ? colors.textPrimary
                        : colors.textMuted,
                    }}
                  >
                    {formData.city || "Select municipality or city"}
                  </Text>
                  <ChevronDown size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {formData.city === ILOILO_CITY_NAME && (
                <View className="mb-3">
                  <Text
                    variant="bold"
                    size={10}
                    color="secondary"
                    className="uppercase tracking-wider mb-1.5 ml-1"
                  >
                    District *
                  </Text>
                  <TouchableOpacity
                    onPress={() => setPickerState("district")}
                    style={{
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    }}
                    className="border rounded-xl p-3.5 flex-row justify-between items-center"
                  >
                    <Text
                      variant="semibold"
                      size={14}
                      style={{
                        color: formData.district
                          ? colors.textPrimary
                          : colors.textMuted,
                      }}
                    >
                      {formData.district || "Select Iloilo City district"}
                    </Text>
                    <ChevronDown size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}

              <View className="mb-3">
                <Text
                  variant="bold"
                  size={10}
                  color="secondary"
                  className="uppercase tracking-wider mb-1.5 ml-1"
                >
                  Barangay *
                </Text>
                <TouchableOpacity
                  onPress={() => setPickerState("barangay")}
                  disabled={
                    !formData.city ||
                    (formData.city === ILOILO_CITY_NAME && !formData.district)
                  }
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity:
                      !formData.city ||
                      (formData.city === ILOILO_CITY_NAME && !formData.district)
                        ? 0.6
                        : 1,
                  }}
                  className="border rounded-xl p-3.5 flex-row justify-between items-center"
                >
                  <Text
                    variant="semibold"
                    size={14}
                    style={{
                      color: formData.barangay
                        ? colors.textPrimary
                        : colors.textMuted,
                    }}
                  >
                    {formData.barangay ||
                      (!formData.city
                        ? "Select city first"
                        : formData.city === ILOILO_CITY_NAME &&
                            !formData.district
                          ? "Select district first"
                          : "Select barangay")}
                  </Text>
                  <ChevronDown size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <InputField
                label="Province"
                value={formData.province}
                onChangeText={(t: string) =>
                  setFormData({ ...formData, province: t })
                }
                placeholder="e.g. Iloilo"
                editable={false}
              />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* BOTTOM SAVE BUTTON */}
        <View className="pt-4 pb-28">
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
              shadowOpacity: 0.1,
              shadowRadius: 8,
            }}
            className="rounded-full py-4 items-center flex-row justify-center gap-2 shadow-lg"
          >
            {saving ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Save size={18} color="white" />
                <Text variant="bold" size={15} style={{ color: "#fff" }}>
                  Save Updates
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ADDRESS SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={!!pickerState}
        onRequestClose={() => setPickerState(null)}
      >
        <View className="flex-1 bg-slate-900/40 justify-end">
          <View
            style={{ backgroundColor: colors.background }}
            className="rounded-t-[40px] p-8 pb-12 max-h-[85%] min-h-[50%] shadow-2xl"
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text variant="black" size={20} color="primary">
                {pickerTitle}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setPickerState(null);
                  setSearchPicker("");
                }}
                style={{ backgroundColor: colors.card }}
                className="p-2.5 rounded-full"
              >
                <X size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.textPrimary,
                fontFamily: "Outfit_600SemiBold",
              }}
              className="border rounded-xl p-3.5 text-sm mb-4"
              placeholder="Search..."
              placeholderTextColor={colors.textMuted}
              value={searchPicker}
              onChangeText={setSearchPicker}
            />

            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    if (pickerState === "city") {
                      setFormData({
                        ...formData,
                        city: item,
                        district: "",
                        barangay: "",
                      });
                    } else if (pickerState === "district") {
                      setFormData({
                        ...formData,
                        district: item,
                        barangay: "",
                      });
                    } else {
                      setFormData({ ...formData, barangay: item });
                    }
                    setPickerState(null);
                    setSearchPicker("");
                  }}
                  style={{ borderBottomColor: colors.border }}
                  className="py-4 border-b"
                >
                  <Text variant="bold" size={16} color="primary">
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
}

// Input component using Theme variables
const InputField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  maxLength,
  editable = true,
}: any) => {
  const { colors } = useTheme();
  return (
    <View className="mb-4">
      <Text
        variant="bold"
        size={10}
        color="secondary"
        className="uppercase tracking-wider mb-1.5 ml-1"
      >
        {label}
      </Text>
      <TextInput
        style={{
          backgroundColor: editable ? colors.card : colors.border,
          borderColor: colors.border,
          color: editable ? colors.textPrimary : colors.textMuted,
          fontFamily: "Outfit_600SemiBold",
        }}
        className="border rounded-xl px-4 py-3.5 text-sm"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        maxLength={maxLength}
        editable={editable}
      />
    </View>
  );
};
