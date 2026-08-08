import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ArrowLeft, Save, MapPin, CheckCircle, XCircle } from "lucide-react-native";
import { ScreenLayout } from "@/components/ScreenLayout";
import { useTheme } from "@/lib/theme";
import { useUserDetail } from "@/features/admin-users/hooks/useUserDetail";
import { AsyncState } from "@/components/shared";
import { updateDispatchProfile } from "@/features/admin-users/services/adminUsers.service";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const PRIMARY = "#1e3a5f";

import { buildDispatchProfileUpdatePayload, CAPABILITIES_MAP, OTON_MUNICIPALITY } from "@/features/admin-users/utils/dispatchPayloadBuilders";

export default function ManageDispatchScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const api = useApi();
  const queryClient = useQueryClient();

  const { user, isLoading: isUserLoading, refetch } = useUserDetail(id || "");

  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [coversOton, setCoversOton] = useState(false);

  useEffect(() => {
    if (user?.dispatchProfile) {
      setSelectedCapabilities(user.dispatchProfile.serviceCapabilities || []);
      const hasOton = user.dispatchProfile.serviceMunicipalities?.some(
        (m: any) => m.municipalityCode === OTON_MUNICIPALITY.municipalityCode
      );
      setCoversOton(!!hasOton);
    }
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildDispatchProfileUpdatePayload(coversOton, selectedCapabilities);
      return await updateDispatchProfile(api, user!._id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "user", user!._id] });
      refetch();
      toast.success("Dispatch profile updated successfully.");
      router.back();
    },
    onError: (err: any) => {
      console.error(err);
      toast.error("Failed to update dispatch profile.");
    },
  });

  const handleSave = () => {
    if (!coversOton) {
      Alert.alert(
        "Clear Dispatch Coverage?",
        "Removing all dispatch coverage will prevent this technician from receiving local service requests.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove Coverage", style: "destructive", onPress: () => saveMutation.mutate() },
        ]
      );
      return;
    }
    saveMutation.mutate();
  };

  if (isUserLoading) {
    return (
      <ScreenLayout>
        <View className="flex-1 justify-center"><AsyncState state="loading" /></View>
      </ScreenLayout>
    );
  }

  if (!user || user.role !== "technician") {
    return (
      <ScreenLayout>
        <View className="flex-1 justify-center">
          <AsyncState state="error" title="Invalid User" message="Only technicians have a dispatch profile." onAction={() => router.back()} actionLabel="Go back" />
        </View>
      </ScreenLayout>
    );
  }

  const availabilityStatus = user.dispatchProfile?.availabilityStatus || "off-duty";
  const acceptsRequests = !!user.dispatchProfile?.acceptsNewRequests;

  return (
    <ScreenLayout>
      <View
        style={{ backgroundColor: colors.card, borderBottomColor: colors.border }}
        className="px-6 pb-4 pt-10 border-b flex-row items-center justify-between"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full"
          style={{ backgroundColor: isDark ? colors.background : "#f8fafc" }}
        >
          <ArrowLeft size={20} color={PRIMARY} />
        </TouchableOpacity>
        <Text className="text-lg font-outfit-black" style={{ color: colors.textPrimary }}>
          Technician Dispatch Profile
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        {/* Header Summary */}
        <View className="mb-6 items-center">
          <Text className="text-xl font-outfit-bold mb-1" style={{ color: colors.textPrimary }}>
            {user.name || "No Name"}
          </Text>
          <Text className="text-sm font-outfit-medium" style={{ color: colors.textSecondary }}>
            {user.role.toUpperCase()} · {user.status || "active"}
          </Text>
        </View>

        {/* Section 1: Coverage */}
        <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Service Coverage
        </Text>
        <View className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
          <TouchableOpacity
            onPress={() => setCoversOton(!coversOton)}
            className="flex-row items-center justify-between py-2"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-3">
              <MapPin size={20} color={coversOton ? "#2563eb" : "#94a3b8"} />
              <View>
                <Text className="font-outfit-bold text-[16px]" style={{ color: colors.textPrimary }}>
                  Oton, Iloilo
                </Text>
                <Text className="font-outfit-medium text-xs text-slate-500">
                  Municipality level coverage
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons
              name={coversOton ? "checkbox-marked" : "checkbox-blank-outline"}
              size={24}
              color={coversOton ? "#2563eb" : "#cbd5e1"}
            />
          </TouchableOpacity>
          {!coversOton && (
             <Text className="text-xs text-slate-400 mt-2 font-outfit-medium text-center">No service coverage assigned</Text>
          )}
        </View>

        {/* Section 2: Capabilities */}
        <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Service Capabilities
        </Text>
        <View className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
          {CAPABILITIES_MAP.map((cap, index) => {
            const isSelected = selectedCapabilities.includes(cap.id);
            return (
              <TouchableOpacity
                key={cap.id}
                onPress={() => {
                  setSelectedCapabilities((prev) =>
                    isSelected ? prev.filter((c) => c !== cap.id) : [...prev, cap.id]
                  );
                }}
                className={`flex-row items-center justify-between py-3 ${
                  index !== CAPABILITIES_MAP.length - 1 ? "border-b border-slate-100 dark:border-slate-700/50" : ""
                }`}
              >
                <Text className="font-outfit-medium text-[15px]" style={{ color: colors.textPrimary }}>
                  {cap.label}
                </Text>
                <MaterialCommunityIcons
                  name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
                  size={24}
                  color={isSelected ? "#2563eb" : "#cbd5e1"}
                />
              </TouchableOpacity>
            );
          })}
          {selectedCapabilities.length === 0 && (
             <Text className="text-xs text-slate-400 mt-2 font-outfit-medium text-center">No service capabilities assigned</Text>
          )}
        </View>

        {/* Section 3: Operational Status */}
        <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Operational Status
        </Text>
        <View className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-outfit-medium text-[15px]" style={{ color: colors.textPrimary }}>Current Status</Text>
            <View className="flex-row items-center gap-2">
              {availabilityStatus === "on-duty" ? <CheckCircle size={16} color="#16a34a" /> : <XCircle size={16} color="#94a3b8" />}
              <Text className={`font-outfit-bold text-xs ${availabilityStatus === "on-duty" ? "text-emerald-600" : "text-slate-500"}`}>
                {availabilityStatus === "on-duty" ? "On Duty" : "Off Duty"}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="font-outfit-medium text-[15px]" style={{ color: colors.textPrimary }}>Accepting New Requests</Text>
            <View className="flex-row items-center gap-2">
              {acceptsRequests ? <CheckCircle size={16} color="#16a34a" /> : <XCircle size={16} color="#94a3b8" />}
              <Text className={`font-outfit-bold text-xs ${acceptsRequests ? "text-emerald-600" : "text-slate-500"}`}>
                {acceptsRequests ? "Accepting" : "Not Accepting Requests"}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-slate-500 italic mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
            The technician controls their current availability. Admin controls service coverage and authorized services.
          </Text>
        </View>
      </ScrollView>

      {/* Footer / Save Button */}
      <View
        className="absolute bottom-0 left-0 right-0 p-6 border-t"
        style={{
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: 40,
        }}
      >
        <TouchableOpacity
          onPress={handleSave}
          disabled={saveMutation.isPending}
          className="rounded-full py-4 flex-row justify-center items-center gap-2"
          style={{ backgroundColor: PRIMARY, opacity: saveMutation.isPending ? 0.7 : 1 }}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Save size={20} color="white" />
              <Text className="text-white font-outfit-bold text-[16px]">Save Dispatch Profile</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
