import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ScreenLayout } from "@/components/ScreenLayout";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";

const PRIMARY = "#1e3a5f";

export default function AdminSettingsScreen() {
  const { colors, isDark } = useTheme();
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [pregnancyWindow, setPregnancyWindow] = useState("60");
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [breeds, setBreeds] = useState<string[]>([]);
  const [newBreed, setNewBreed] = useState("");

  // 1. Fetch settings config
  const { data: configData, isLoading } = useQuery<any>({
    queryKey: ["admin-system-configs"],
    queryFn: async () => {
      const res = await api.get("/config/settings");
      return res.data;
    },
    staleTime: 1000 * 60 * 10, // stable configs
  });

  // Load config data into state when available
  useEffect(() => {
    if (configData) {
      setPregnancyWindow(String(configData.pregnancyWindowDays || "60"));
      setMaxAttempts(String(configData.maxAttemptLimit || "3"));
      setEmailEnabled(Boolean(configData.emailNotificationEnabled));
      setSmsEnabled(Boolean(configData.smsNotificationEnabled));
      setBreeds(Array.isArray(configData.registered_breeds) ? configData.registered_breeds : []);
    }
  }, [configData]);

  // 2. Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post("/config/settings", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Settings updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin-system-configs"] });
      queryClient.invalidateQueries({ queryKey: ["config"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to update configurations.");
    },
  });

  const handleSave = () => {
    const windowNum = parseInt(pregnancyWindow, 10);
    const attemptsNum = parseInt(maxAttempts, 10);

    if (Number.isNaN(windowNum) || windowNum <= 0) {
      toast.error("Pregnancy window must be a positive number.");
      return;
    }
    if (Number.isNaN(attemptsNum) || attemptsNum <= 0) {
      toast.error("Max attempt limit must be a positive number.");
      return;
    }

    saveMutation.mutate({
      pregnancyWindowDays: String(windowNum),
      maxAttemptLimit: String(attemptsNum),
      emailNotificationEnabled: emailEnabled,
      smsNotificationEnabled: smsEnabled,
      registered_breeds: breeds,
    });
  };

  const handleAddBreed = () => {
    const cleaned = newBreed.trim();
    if (!cleaned) return;
    if (breeds.includes(cleaned)) {
      toast.error("Breed is already registered.");
      return;
    }
    setBreeds([...breeds, cleaned]);
    setNewBreed("");
  };

  const handleRemoveBreed = (breedToRemove: string) => {
    Alert.alert(
      "Remove Breed",
      `Are you sure you want to remove '${breedToRemove}' from registered breeds?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setBreeds(breeds.filter((b) => b !== breedToRemove));
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <ScreenLayout>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 12,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 18, color: colors.textPrimary, marginLeft: 8 }}>
            System Settings
          </Text>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      {/* Custom back-header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 18, color: colors.textPrimary, marginLeft: 8, flex: 1 }}>
          System Settings
        </Text>
        {saveMutation.isPending ? (
          <ActivityIndicator size="small" color={PRIMARY} />
        ) : (
          <TouchableOpacity onPress={handleSave} style={{ padding: 8, marginRight: -8 }}>
            <Text style={{ fontSize: 14, fontFamily: "Outfit_700Bold", color: PRIMARY }}>Save</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 100 }}>
        {/* Core parameters */}
        <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 14 }}>
            BREEDING METRICS & WINDOWS
          </Text>
          
          <View style={{ gap: 12 }}>
            <View>
              <Text style={{ fontSize: 12.5, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 6 }}>
                Pregnancy Window Check Days
              </Text>
              <TextInput
                keyboardType="numeric"
                value={pregnancyWindow}
                onChangeText={setPregnancyWindow}
                style={{
                  backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 10,
                  fontSize: 14,
                  fontFamily: "Outfit_600SemiBold",
                  color: colors.textPrimary,
                }}
              />
            </View>

            <View>
              <Text style={{ fontSize: 12.5, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 6 }}>
                Max AI Attempts per Cycle
              </Text>
              <TextInput
                keyboardType="numeric"
                value={maxAttempts}
                onChangeText={setMaxAttempts}
                style={{
                  backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 10,
                  fontSize: 14,
                  fontFamily: "Outfit_600SemiBold",
                  color: colors.textPrimary,
                }}
              />
            </View>
          </View>
        </View>

        {/* Alerts & Notifications config */}
        <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 14 }}>
            ALERTS & DISPATCH NOTIFICATIONS
          </Text>

          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 13.5, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>Email Notifications</Text>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>Send verification and claim receipts</Text>
              </View>
              <Switch value={emailEnabled} onValueChange={setEmailEnabled} trackColor={{ true: PRIMARY }} />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 13.5, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>SMS Alerts (OTP)</Text>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>Required for walk-in claims confirmation</Text>
              </View>
              <Switch value={smsEnabled} onValueChange={setSmsEnabled} trackColor={{ true: PRIMARY }} />
            </View>
          </View>
        </View>

        {/* Registered Breeds config */}
        <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 12 }}>
            REGISTERED BREED REGISTRY ({breeds.length})
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            <TextInput
              placeholder="Add new breed..."
              placeholderTextColor={colors.textMuted}
              value={newBreed}
              onChangeText={setNewBreed}
              style={{
                flex: 1,
                backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 12,
                fontSize: 13,
                fontFamily: "Outfit_500Medium",
                color: colors.textPrimary,
              }}
            />
            <TouchableOpacity
              onPress={handleAddBreed}
              style={{
                backgroundColor: PRIMARY,
                paddingHorizontal: 16,
                borderRadius: 12,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Outfit_700Bold" }}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* List of registered breeds */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {breeds.map((breed) => (
              <View
                key={breed}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9",
                  paddingVertical: 6,
                  paddingLeft: 10,
                  paddingRight: 6,
                  borderRadius: 10,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textPrimary, marginRight: 6 }}>
                  {breed}
                </Text>
                <TouchableOpacity onPress={() => handleRemoveBreed(breed)}>
                  <MaterialCommunityIcons name="close-circle" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
