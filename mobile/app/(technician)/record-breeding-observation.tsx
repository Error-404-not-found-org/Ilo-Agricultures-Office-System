import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { AppPageHeader } from "@/components/AppPageHeader";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { ReturnToHeatReviewForm } from "@/features/breeding/components/ReturnToHeatReviewForm";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";

const OUTCOME_OPTIONS = [
  {
    id: "possible_pregnancy",
    label: "No heat noticed",
    description: "No heat signs were reported. Pregnancy still requires professional confirmation.",
    icon: "check-circle",
    tone: "#10b981",
  },
  {
    id: "return_to_heat",
    label: "Returned to heat",
    description: "Return-to-heat signs were observed or reported.",
    icon: "alert-circle",
    tone: "#ef4444",
  },
  {
    id: "unsure",
    label: "Not sure",
    description: "Unable to determine whether the animal returned to heat.",
    icon: "help-circle",
    tone: "#f59e0b"
  },
  {
    id: "unable_to_contact",
    label: "Unable to contact farmer",
    description: "No reproductive observation will be recorded.",
    icon: "phone-off",
    tone: "#6b7280",
  },
] as const;

export default function RecordBreedingObservationScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { taskId, inseminationId } = useLocalSearchParams();
  const api = useApi();
  const queryClient = useQueryClient();

  const [reportType, setReportType] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use the fetched authoritative insemination state to determine if we are professionally verifying a return_to_heat
  const { data: requestRes, isLoading: isLoadingInsem } = useQuery({
    queryKey: ["technician", "requests", inseminationId],
    queryFn: () => api.get(`/ai-request/${inseminationId}`).then((res) => res.data),
    enabled: !!inseminationId,
  });

  const { data: taskRes, isLoading: isLoadingTask } = useQuery({
    queryKey: ["technician", "tasks", "detail", taskId],
    queryFn: () => api.get(`/tasks/${taskId}`).then((res) => res.data),
    enabled: !!taskId,
  });

  const isLoading = isLoadingInsem || isLoadingTask;
  const insem = requestRes?.data;
  const task = taskRes?.data;
  const isTerminalTask = task && ["completed", "cancelled", "rejected", "resolved"].includes(String(task.status || "").toLowerCase());
  const isVerificationMode = insem?.farmerOutcomeReport === "return_to_heat" && insem?.observationSource === "farmer";

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post(
        `/ai-request/${inseminationId}/technician-observation`,
        data,
      );
      return res.data;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["technician", "requests"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "work-queue"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "tasks"] });
      if (taskId) {
        queryClient.invalidateQueries({
          queryKey: ["technician", "tasks", "detail", taskId],
        });
      }
      toast.success("Breeding follow-up recorded");
      router.back();
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message || "Failed to record observation",
      );
    },
  });

  const handleSubmit = () => {
    if (!reportType) {
      toast.error(isVerificationMode ? "Please select a verification result." : "Please select an outcome");
      return;
    }

    setIsSubmitting(true);

    // For Verification Mode, use the authoritative verify-breeding-observation endpoint
    if (isVerificationMode) {
      api.post(`/ai-request/${inseminationId}/verify-breeding-observation`, {
        verificationResult: reportType,
        technicianNotes: notes.trim() || undefined,
        taskId,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["technician", "requests"] });
        queryClient.invalidateQueries({ queryKey: ["technician", "work-queue"] });
        queryClient.invalidateQueries({ queryKey: ["technician", "tasks"] });
        if (taskId) {
          queryClient.invalidateQueries({
            queryKey: ["technician", "tasks", "detail", taskId],
          });
        }
        toast.success("Farmer update reviewed.");
        router.back();
      }).catch((err: any) => {
        toast.error(err.response?.data?.message || "Failed to verify update.");
      }).finally(() => {
        setIsSubmitting(false);
      });
      return;
    }

    // For standard observation, use technician-observation
    submitMutation.mutate(
      {
        reportType,
        notes: notes.trim() || undefined,
      },
      {
        onSettled: () => setIsSubmitting(false),
      },
    );
  };

  const isObservationOutcome = [
    "possible_pregnancy",
    "return_to_heat",
    "unsure",
  ].includes(reportType || "");

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppPageHeader title={isVerificationMode ? "Review Farmer Update" : "Record Follow-up"} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {!isVerificationMode && (
          <Text
            style={{
              fontSize: 14,
              fontFamily: "Outfit_400Regular",
              color: colors.textSecondary,
              marginBottom: 24,
            }}
          >
            Select the outcome based on your contact with the farmer.
          </Text>
        )}

        {isVerificationMode ? (
          <ReturnToHeatReviewForm
            insem={insem}
            verificationResult={reportType}
            setVerificationResult={setReportType}
            notes={notes}
            setNotes={setNotes}
          />
        ) : (
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: "Outfit_600SemiBold",
                color: colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Follow-up Outcome
            </Text>
            <View style={{ gap: 12 }}>
              {OUTCOME_OPTIONS.map((option) => {
                const isSelected = reportType === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    activeOpacity={0.7}
                    onPress={() => setReportType(option.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 16,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: isSelected ? option.tone : colors.border,
                      backgroundColor: isSelected
                        ? isDark
                          ? `${option.tone}20`
                          : `${option.tone}10`
                        : colors.card,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: isDark
                          ? `${option.tone}30`
                          : `${option.tone}20`,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <Feather
                        name={option.icon as any}
                        size={20}
                        color={option.tone}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontFamily: isSelected
                            ? "Outfit_600SemiBold"
                            : "Outfit_500Medium",
                          color: isSelected ? option.tone : colors.textPrimary,
                          marginBottom: 4,
                        }}
                      >
                        {option.label}
                      </Text>
                      <Text style={{ fontSize: 13, fontFamily: "Outfit_400Regular", color: colors.textSecondary, lineHeight: 18 }}>
                        {option.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {isObservationOutcome && !isVerificationMode && (
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: "Outfit_600SemiBold",
                color: colors.textPrimary,
                marginBottom: 8,
              }}
            >
              Notes (Optional)
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: 16,
                minHeight: 100,
                textAlignVertical: "top",
                fontFamily: "Outfit_400Regular",
                color: colors.textPrimary,
                fontSize: 16,
              }}
              placeholder="Add any additional details or observations..."
              placeholderTextColor={colors.textMuted}
              multiline
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        )}
      </ScrollView>

      <View
        style={{
          padding: 16,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        {isTerminalTask ? (
          <View style={{ padding: 16, backgroundColor: isDark ? "rgba(245, 158, 11, 0.1)" : "#FEF3C7", borderRadius: 8, alignItems: "center" }}>
            <Text style={{ color: "#D97706", fontFamily: "Outfit_600SemiBold" }}>This follow-up has already been resolved.</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={{
              backgroundColor:
                !reportType || isSubmitting ? colors.border : colors.primary,
              padding: 16,
              borderRadius: 8,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
            }}
            disabled={!reportType || isSubmitting}
            activeOpacity={0.7}
            onPress={handleSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" style={{ marginRight: 8 }} />
            ) : null}
            <Text
              style={{
                color: "white",
                fontSize: 16,
                fontFamily: "Outfit_600SemiBold",
              }}
            >
              {isSubmitting ? "Saving..." : "Submit Follow-up"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
