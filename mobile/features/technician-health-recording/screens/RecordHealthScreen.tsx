import React, { useState } from "react";
import { View, ScrollView, Text } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { toast } from "sonner-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { AppPageHeader } from "@/components/AppPageHeader";
import { ScreenLayout } from "@/components/ScreenLayout";
import { AsyncState } from "@/components/shared/AsyncState";
import { useTheme } from "@/lib/theme";
import { useAnimalContext } from "@/hooks/useAnimalContext";
import RequestLinkedHealthForm from "../components/RequestLinkedHealthForm";
import DirectHealthForm from "../components/DirectHealthForm";
import HealthReviewModal from "../components/HealthReviewModal";
import FarmerAnimalPickers from "../components/FarmerAnimalPickers";
import { useCompleteHealthRequestMutation, useWalkInHealthMutation } from "../hooks/useHealthRecord";
import { useTechnicianClients } from "@/features/technician/hooks/useTechnicianClients";
import { getTechnicianRequestDetail } from "@/features/technician/services/technician.service";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

const MY_WORK_PATH = "/(technician)/(tabs)/technician.requests?section=myWork";

export default function RecordHealthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const netInfo = useNetInfo();
  const { colors } = useTheme();
  const [reviewSnapshot, setReviewSnapshot] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const { clientsQuery } = useTechnicianClients();
  const walkInMutation = useWalkInHealthMutation();
  const api = useApi();

  const {
    selectedFarmer,
    setSelectedFarmer,
    selectedAnimal,
    setSelectedAnimal,
    animals,
    loadingAnimals,
    isLocked,
    requestId,
    taskId,
    handleClearAll,
  } = useAnimalContext();

  const actualRequestId = (params.healthRequestId || params.requestId || requestId) as string;
  const routeVisitPeriod = params.visitPeriod as string;
  const requestMutation = useCompleteHealthRequestMutation(actualRequestId || "");

  const mode = {
    kind: (isLocked && actualRequestId) ? "request-linked" : "direct",
    taskId,
    requestId: actualRequestId,
  };

  const { data: request, isLoading: requestLoading, error: requestError, refetch } = useQuery({
    queryKey: ["technician", "request", actualRequestId],
    queryFn: async () => {
      if (!actualRequestId) return null;
      if (!actualRequestId || actualRequestId === taskId) {
         // Defensive guard against using taskId as request detail ID
         if (taskId && actualRequestId === taskId) return null;
      }
      const res = await getTechnicianRequestDetail(api, "health", actualRequestId);
      return res; // getTechnicianRequestDetail directly returns data in some implementations or response. Check it. Wait.
    },
    enabled: mode.kind === "request-linked" && !!actualRequestId,
  });

  const onReview = (data: any) => {
    if (mode.kind === "direct") {
      if (!selectedFarmer) {
        toast.error("Select a farmer before recording the service.");
        return;
      }
      if (!selectedAnimal) {
        toast.error("Select an animal before recording the service.");
        return;
      }
    }

    setReviewSnapshot({
      farmer: selectedFarmer,
      animal: selectedAnimal,
      details: data,
    });
  };

  const completeRecord = async () => {
    if (saving || !reviewSnapshot) return;
    setSaving(true);
    toast.dismiss();

    try {
      let payload: any;
      if (mode.kind === "request-linked") {
        payload = {
          status: "resolved",
          ...(mode.taskId ? { taskId: mode.taskId } : {}),
          ...reviewSnapshot.details,
        };
        await requestMutation.mutateAsync(payload);
      } else {
        payload = {
          farmerId: reviewSnapshot.farmer._id,
          animalId: reviewSnapshot.animal._id,
          ...reviewSnapshot.details,
        };
        await walkInMutation.mutateAsync(payload);
      }
      
      toast.success(
        mode.kind === "request-linked"
          ? "Health record saved successfully."
          : "Direct Health record saved successfully."
      );
      setReviewSnapshot(null);
      
      requestAnimationFrame(() => {
        if (mode.kind === "request-linked") {
          returnToMyWork();
        } else {
          handleClearAll();
          router.replace("/(technician)/(tabs)/technician.dashboard" as any);
        }
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to save health record.");
    } finally {
      setSaving(false);
    }
  };

  const handleStartService = async () => {
    if (saving) return;
    if (netInfo.isConnected === false) {
      toast.error("Starting a health service requires an internet connection.");
      return;
    }
    setSaving(true);
    try {
      await requestMutation.mutateAsync({ status: "in-progress" });
      toast.success("Service started.");
      await refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to start service.");
    } finally {
      setSaving(false);
    }
  };

  const returnToMyWork = () => {
    router.replace(MY_WORK_PATH as any);
  };

  const handleBack = () => {
    if (mode.kind === "request-linked") {
      returnToMyWork();
      return;
    }
    router.back();
  };

  const title = mode.kind === "direct" ? "Record Direct Health Service" : "Record Health Assistance";

  const isRequestLinked = mode.kind === "request-linked";
  const status = request?.status;
  const isPending = isRequestLinked && ["pending", "approved", "claimed"].includes(status);
  const needsStartService = status === "scheduled";
  const blockingError = requestError ? (requestError as any).message : null;

  return (
    <ScreenLayout edges={[]}>
      <AppPageHeader title={title} onBack={handleBack} />

      {blockingError ? (
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 16 }}>
          <AsyncState
            state="error"
            title="Unable to record this health service"
            message={blockingError}
            actionLabel="Return to My Work"
            onAction={returnToMyWork}
          />
        </View>
      ) : isPending ? (
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 16 }}>
          <AsyncState
            state="error"
            title="Not Scheduled"
            message="This health visit must be scheduled before service can begin."
            actionLabel="Return to My Work"
            onAction={returnToMyWork}
          />
        </View>
      ) : isRequestLinked && requestLoading ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.card }}>
            <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_700Bold", fontSize: 14 }}>Loading request context</Text>
          </View>
          <AsyncState
            state="loading"
            title="Loading official health request"
            message="Farmer, animal, schedule, and observations are being verified."
            skeletonCount={3}
          />
        </ScrollView>
      ) : isRequestLinked && request ? (
        <RequestLinkedHealthForm 
          onSubmit={onReview} 
          request={request} 
          routeVisitPeriod={routeVisitPeriod}
          saving={saving}
          onStartService={handleStartService}
        />
      ) : mode.kind === "direct" ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 72, gap: 14 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FarmerAnimalPickers
            selectedFarmer={selectedFarmer}
            selectedAnimal={selectedAnimal}
            setSelectedFarmer={setSelectedFarmer}
            setSelectedAnimal={setSelectedAnimal}
            farmers={Array.isArray(clientsQuery.data) ? clientsQuery.data : []}
            animals={animals}
            loadingAnimals={loadingAnimals}
            saving={saving}
            clientsLoading={clientsQuery.isPending}
          />
          <DirectHealthForm onSubmit={onReview} saving={saving} />
        </ScrollView>
      ) : null}

      <HealthReviewModal
        visible={Boolean(reviewSnapshot)}
        snapshot={reviewSnapshot}
        saving={saving}
        onGoBack={() => {
          if (!saving) setReviewSnapshot(null);
        }}
        onComplete={completeRecord}
      />
    </ScreenLayout>
  );
}
