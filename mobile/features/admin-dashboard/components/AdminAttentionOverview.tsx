import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { BellRing, BriefcaseBusiness, ChevronRight, UserRoundCog } from "lucide-react-native";
import { useRouter } from "expo-router";

import { AsyncState } from "@/components/shared";
import { useTheme } from "@/lib/theme";

type AttentionSummary = {
  pendingRequests: number;
  activeWork: number;
  totalTechnicians: number;
  notReadyTechnicians: number;
  setupIncompleteTechnicians: number;
};

export function AdminAttentionOverview({
  data,
  isLoading,
  isError,
  onRetry,
}: {
  data: AttentionSummary;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24, marginTop: 16 }}>
      <Text style={{ fontSize: 18, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 4 }}>
        Needs Attention
      </Text>
      <Text style={{ fontSize: 13, fontFamily: "Outfit_500Medium", color: colors.textSecondary, marginBottom: 12 }}>
        Live operational items that may need an Admin review.
      </Text>

      {isError ? (
        <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
          <AsyncState state="error" title="Attention summary unavailable" message="Pull the latest request and Technician readiness counts again." actionLabel="Retry" onAction={onRetry} />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <AttentionRow
            title="New requests"
            detail="Pending AI and Health requests"
            value={data.pendingRequests}
            loading={isLoading}
            icon={<BellRing size={21} color="#d97706" />}
            onPress={() => router.push("/(admin)/request-monitoring" as any)}
          />
          <AttentionRow
            title="Technicians not ready"
            detail={`${data.setupIncompleteTechnicians} need Field Area or capability setup`}
            value={data.notReadyTechnicians}
            loading={isLoading}
            icon={<UserRoundCog size={21} color="#dc2626" />}
            onPress={() => router.push("/(admin)/(tabs)/admin.users" as any)}
          />
          <AttentionRow
            title="Active work"
            detail={`Across ${data.totalTechnicians} Technician accounts`}
            value={data.activeWork}
            loading={isLoading}
            icon={<BriefcaseBusiness size={21} color="#2563eb" />}
            onPress={() => router.push("/(admin)/technician-workload" as any)}
          />
        </View>
      )}
    </View>
  );
}

function AttentionRow({
  title,
  detail,
  value,
  loading,
  icon,
  onPress,
}: {
  title: string;
  detail: string;
  value: number;
  loading: boolean;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${value}`}
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        minHeight: 68,
        backgroundColor: colors.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{title}</Text>
        <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary, marginTop: 2 }}>{detail}</Text>
      </View>
      {loading ? <ActivityIndicator size="small" color="#2563eb" /> : <Text style={{ fontSize: 22, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{value}</Text>}
      <ChevronRight size={18} color={colors.textMuted} style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}
