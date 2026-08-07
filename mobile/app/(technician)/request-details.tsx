import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";

import { AppPageHeader } from "@/components/AppPageHeader";
import { Text } from "@/components/ui/Text";
import { AIRequestDetails } from "@/features/technician-requests/components/AIRequestDetails";
import { HealthRequestDetails } from "@/features/technician-health-request/components/HealthRequestDetails";
import {
  getTechnicianRequestDetail,
} from "@/features/technician/services/technician.service";
import { useApi } from "@/lib/api";
import { technicianKeys } from "@/lib/queryKeys";
import { useTheme } from "@/lib/theme";

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default function RequestDetailsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    id?: string | string[];
    type?: string | string[];
    taskId?: string | string[];
    workflowId?: string | string[];
  }>();
  const requestId = firstParam(params.id);
  const requestType = firstParam(params.type) === "health" ? "health" : "ai";
  const routeTaskId = firstParam(params.taskId);
  const routeWorkflowId = firstParam(params.workflowId);
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);

  const fetchRequestDetails = useCallback(
    async (showSkeleton = false) => {
      if (!requestId) {
        setRequest(null);
        setLoading(false);
        return;
      }

      if (showSkeleton) setLoading(true);
      try {
        const requestData = await getTechnicianRequestDetail(
          api,
          requestType,
          requestId,
        );
        setRequest(requestData);

      } catch (error: any) {
        if (error?.response?.status === 403 || error?.response?.status === 404) {
          toast.error(
            "This request is no longer available or is assigned to another technician.",
          );
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: technicianKeys.requests() }),
            queryClient.invalidateQueries({ queryKey: technicianKeys.workQueue() }),
            queryClient.invalidateQueries({ queryKey: technicianKeys.dashboard() }),
            queryClient.invalidateQueries({ queryKey: technicianKeys.tasks() }),
          ]);
          router.back();
          return;
        }
        toast.error(error?.message || "Failed to fetch request details.");
        setRequest(null);
      } finally {
        setLoading(false);
      }
    }, [api, queryClient, requestId, requestType, router],
  );

  useEffect(() => {
    void fetchRequestDetails(true);
  }, [fetchRequestDetails]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppPageHeader title="Request Details" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text textRole="body" style={{ color: colors.textSecondary, marginTop: 12 }}>
            Loading request details…
          </Text>
        </View>
      </View>
    );
  }

  if (!request) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: colors.background,
        }}
      >
        <Text textRole="title" style={{ color: colors.textPrimary, textAlign: "center" }}>
          Request details not found
        </Text>
        <Text textRole="body" style={{ color: colors.textSecondary, textAlign: "center", marginTop: 6 }}>
          The request may have been removed or assigned to another technician.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 18,
            paddingHorizontal: 22,
            borderRadius: 12,
            backgroundColor: colors.primary,
          }}
        >
          <Text textRole="bodyStrong" style={{ color: colors.onPrimary }}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (requestType === "health") {
    return (
      <HealthRequestDetails
        request={request}
        routeTaskId={routeTaskId}
        routeWorkflowId={routeWorkflowId}
        onRefresh={() => fetchRequestDetails()}
        onBack={() => router.back()}
      />
    );
  }

  return (
    <AIRequestDetails
      request={request}
      routeTaskId={routeTaskId}
      routeWorkflowId={routeWorkflowId}
      onRefresh={() => fetchRequestDetails()}
      onBack={() => router.back()}
    />
  );
}
