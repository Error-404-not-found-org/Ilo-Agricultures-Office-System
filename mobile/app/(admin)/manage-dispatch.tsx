import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, CircleAlert, CircleCheck, MapPin, Save } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";

import { ScreenLayout } from "@/components/ScreenLayout";
import { AsyncState } from "@/components/shared";
import { useUserDetail } from "@/features/admin-users/hooks/useUserDetail";
import { updateDispatchProfile } from "@/features/admin-users/services/adminUsers.service";
import { buildDispatchProfileUpdatePayload, CAPABILITIES_MAP, isOtonMunicipalityCode, OTON_MUNICIPALITY } from "@/features/admin-users/utils/dispatchPayloadBuilders";
import { getAvailabilityLabel, getDispatchReadinessPresentation, getReceiveRequestsPresentation } from "@/features/admin-users/utils/dispatchPresentation";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";

const PRIMARY = "#1e3a5f";
const BLUE = "#2563eb";

export default function ManageDispatchScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const api = useApi();
  const queryClient = useQueryClient();
  const { user, isLoading, refetch } = useUserDetail(id || "");
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [coversOton, setCoversOton] = useState(false);

  useEffect(() => {
    if (!user) return;
    setSelectedCapabilities(user.dispatchProfile?.serviceCapabilities || []);
    setCoversOton(Boolean(user.dispatchProfile?.serviceMunicipalities?.some(
      (area: { municipalityCode?: string }) => isOtonMunicipalityCode(area.municipalityCode),
    )));
  }, [user]);

  const readiness = useMemo(() => getDispatchReadinessPresentation(user ? {
    ...user,
    dispatchReadiness: undefined,
    dispatchProfile: {
      ...user.dispatchProfile,
      serviceMunicipalities: coversOton ? [OTON_MUNICIPALITY] : [],
      serviceCapabilities: selectedCapabilities,
    },
  } : null), [coversOton, selectedCapabilities, user]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Technician account is unavailable.");
      return updateDispatchProfile(api, user._id, buildDispatchProfileUpdatePayload(coversOton, selectedCapabilities));
    },
    onSuccess: async () => {
      if (!user) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-technicians-list"] }),
        refetch(),
      ]);
      toast.success("Dispatch settings saved.");
      router.back();
    },
    onError: (error: any) => toast.error(
      error?.response?.data?.message || error?.message || "Dispatch settings could not be saved. Please try again.",
    ),
  });

  const handleSave = () => {
    if (coversOton) return saveMutation.mutate();
    Alert.alert(
      "Remove Field Area?",
      "This technician will not be eligible for municipality-based requests. Existing assigned work is not changed.",
      [
        { text: "Keep Field Area", style: "cancel" },
        { text: "Remove Field Area", style: "destructive", onPress: () => saveMutation.mutate() },
      ],
    );
  };

  if (isLoading) return (
    <ScreenLayout><View className="flex-1 justify-center"><AsyncState state="loading" /></View></ScreenLayout>
  );

  if (!user || user.role !== "technician") return (
    <ScreenLayout>
      <View className="flex-1 justify-center">
        <AsyncState state="error" title="Technician unavailable" message="Dispatch settings are only available for Technician accounts." actionLabel="Go back" onAction={() => router.back()} />
      </View>
    </ScreenLayout>
  );

  const receiveRequests = getReceiveRequestsPresentation(user.dispatchProfile);
  const availability = getAvailabilityLabel(user.dispatchProfile);
  const previewColor = readiness.eligible ? colors.success : colors.warning;

  return (
    <ScreenLayout>
      <View className="flex-row items-center border-b px-4 pb-3 pt-8" style={{ backgroundColor: colors.card, borderBottomColor: colors.border }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: isDark ? colors.background : "#f1f5f9" }}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View className="ml-3 flex-1">
          <Text className="font-outfit-bold text-xl" style={{ color: colors.textPrimary }}>Manage Dispatch</Text>
          <Text className="font-outfit-medium text-[13px]" style={{ color: colors.textSecondary }}>{user.name || "Technician"}</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View className="mb-6 rounded-2xl border p-4" style={{ backgroundColor: colors.card, borderColor: readiness.eligible ? colors.success : colors.warning }}>
          <View className="flex-row items-start gap-3">
            {readiness.eligible ? <CircleCheck size={24} color={previewColor} /> : <CircleAlert size={24} color={previewColor} />}
            <View className="flex-1">
              <Text className="font-outfit-bold text-base" style={{ color: colors.textPrimary }}>Dispatch readiness preview</Text>
              <Text className="mt-1 font-outfit-semibold text-[14px]" style={{ color: previewColor }}>{readiness.title}</Text>
              {!readiness.eligible && readiness.blockers.map((blocker) => (
                <Text key={blocker} className="mt-1 font-outfit-medium text-[13px]" style={{ color: colors.textSecondary }}>• {blocker}</Text>
              ))}
            </View>
          </View>
        </View>

        <SectionHeading title="Field Area" description="New Farmer requests are matched against this service area. Changing it does not remove existing assigned work." />
        <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: coversOton }} onPress={() => setCoversOton((value) => !value)} className="mb-6 min-h-16 flex-row items-center rounded-2xl border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          <MapPin size={22} color={coversOton ? BLUE : colors.textMuted} />
          <View className="ml-3 flex-1">
            <Text className="font-outfit-bold text-base" style={{ color: colors.textPrimary }}>Oton, Iloilo</Text>
            <Text className="font-outfit-medium text-[13px]" style={{ color: colors.textSecondary }}>Municipality-level Field Area</Text>
          </View>
          <Checkbox checked={coversOton} borderColor={colors.border} />
        </TouchableOpacity>

        <SectionHeading title="Service Capabilities" description="Choose the request types the Technician is authorized to receive." />
        <View className="mb-6 overflow-hidden rounded-2xl border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          {CAPABILITIES_MAP.map((capability, index) => {
            const checked = selectedCapabilities.includes(capability.id);
            return (
              <TouchableOpacity key={capability.id} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => setSelectedCapabilities((current) => checked ? current.filter((item) => item !== capability.id) : [...current, capability.id])} className="min-h-14 flex-row items-center px-4 py-3" style={{ borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border }}>
                <Text className="flex-1 font-outfit-semibold text-[15px]" style={{ color: colors.textPrimary }}>{capability.label}</Text>
                <Checkbox checked={checked} borderColor={colors.border} />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="mb-3 font-outfit-bold text-lg" style={{ color: colors.textPrimary }}>Technician Availability</Text>
        <View className="rounded-2xl border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          <ReadOnlyRow label="Receive Requests" value={receiveRequests.label} />
          <View className="my-3 h-px" style={{ backgroundColor: colors.border }} />
          <ReadOnlyRow label="Availability" value={availability} />
          <Text className="mt-4 font-outfit-medium text-[13px] leading-5" style={{ color: colors.textSecondary }}>
            Read only. Technicians control Receive Requests and their current availability. Admin changes here do not alter existing assigned work.
          </Text>
        </View>
      </ScrollView>

      <View className="border-t px-5 pb-8 pt-4" style={{ backgroundColor: colors.card, borderTopColor: colors.border }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save dispatch settings" disabled={saveMutation.isPending} onPress={handleSave} className="min-h-12 flex-row items-center justify-center rounded-xl" style={{ backgroundColor: PRIMARY, opacity: saveMutation.isPending ? 0.65 : 1 }}>
          {saveMutation.isPending ? <ActivityIndicator color="#ffffff" /> : <><Save size={20} color="#ffffff" /><Text className="ml-2 font-outfit-bold text-base text-white">Save Dispatch Settings</Text></>}
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  const { colors } = useTheme();
  return <><Text className="mb-2 font-outfit-bold text-lg" style={{ color: colors.textPrimary }}>{title}</Text><Text className="mb-3 font-outfit-medium text-[13px] leading-5" style={{ color: colors.textSecondary }}>{description}</Text></>;
}

function Checkbox({ checked, borderColor }: { checked: boolean; borderColor: string }) {
  return <View className="h-7 w-7 items-center justify-center rounded-lg border-2" style={{ backgroundColor: checked ? BLUE : "transparent", borderColor: checked ? BLUE : borderColor }}>{checked && <Check size={18} color="#ffffff" />}</View>;
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return <View className="flex-row items-start justify-between gap-4"><Text className="font-outfit-medium text-[14px]" style={{ color: colors.textSecondary }}>{label}</Text><Text className="max-w-[60%] text-right font-outfit-bold text-[14px]" style={{ color: colors.textPrimary }}>{value}</Text></View>;
}
