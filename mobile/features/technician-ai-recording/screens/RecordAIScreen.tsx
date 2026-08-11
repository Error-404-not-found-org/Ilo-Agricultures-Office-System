import React, { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { AppPageHeader } from "@/components/AppPageHeader";
import { ScreenLayout } from "@/components/ScreenLayout";
import { AsyncState } from "@/components/shared/AsyncState";
import { useTheme } from "@/lib/theme";
import { getAIEligibility } from "@/lib/reproductionEligibility";
import { safeBack } from "@/utils/navigation";
import {
  useWalkInInseminationMutation,
  useCompleteAIRequestMutation,
} from "@/features/technician/hooks/useTechnicianFieldRecords";
import {
  formatLocalCalendarDate,
  formatLocalTime,
  getActualInseminationDefaults,
  getAIRecordingErrorMessage,
  isCanonicalWorkflowId,
  validateAIRecording,
} from "@/features/technician-requests/utils/aiWorkflow";
import { DirectAIRecordForm } from "../components/DirectAIRecordForm";
import { InseminationReviewModal } from "../components/InseminationReviewModal";
import { RequestLinkedAIRecordForm } from "../components/RequestLinkedAIRecordForm";
import { useRecordAIContext } from "../hooks/useRecordAIContext";
import type {
  AIRecordingValues,
  DirectInseminationPayload,
  NormalizedInseminationDetails,
  RequestLinkedInseminationPayload,
  ReviewSnapshot,
  SelectedAnimal,
  SelectedFarmer,
} from "../types/technicianAIRecording.types";

const MY_WORK_PATH = "/(technician)/(tabs)/technician.requests?section=myWork";

const initialValues = (): AIRecordingValues => {
  const defaults = getActualInseminationDefaults();
  return {
    inseminationDate: defaults.inseminationDate,
    inseminationTime: defaults.inseminationTime,
    estrus: "",
    sireBreed: "",
    sireCode: "",
    semenDosesUsed: "1",
    technicianNote: "",
  };
};

export default function RecordAIScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { mode, requestContext, contextError, isRequestLoading, requestError } =
    useRecordAIContext();
  const requestMutation = useCompleteAIRequestMutation(
    mode.kind === "request-linked" ? mode.workflowId : "placeholder",
  );
  const walkInMutation = useWalkInInseminationMutation();
  const submissionLockRef = useRef(false);
  const initializedWorkflowRef = useRef<string | null>(null);
  const [values, setValues] = useState<AIRecordingValues>(initialValues);
  const [
    historicalTimeConfirmationRequired,
    setHistoricalTimeConfirmationRequired,
  ] = useState(false);
  const [reviewSnapshot, setReviewSnapshot] = useState<ReviewSnapshot | null>(
    null,
  );
  const saving = requestMutation.isPending || walkInMutation.isPending;

  useEffect(() => {
    if (
      !requestContext ||
      initializedWorkflowRef.current === requestContext.workflowId
    ) {
      return;
    }
    initializedWorkflowRef.current = requestContext.workflowId;
    const defaults = getActualInseminationDefaults(
      requestContext.scheduledDate,
    );
    setValues((current) => ({
      ...current,
      inseminationDate: defaults.inseminationDate,
      inseminationTime: defaults.inseminationTime,
    }));
    setHistoricalTimeConfirmationRequired(defaults.requiresTimeConfirmation);
  }, [requestContext]);

  const updateValues = (next: Partial<AIRecordingValues>) => {
    if (next.inseminationTime) {
      setHistoricalTimeConfirmationRequired(false);
    }
    setValues((current) => ({ ...current, ...next }));
  };

  const returnToMyWork = () => {
    router.replace(MY_WORK_PATH as any);
  };

  const handleBack = () => {
    if (mode.kind === "request-linked" || mode.kind === "invalid") {
      returnToMyWork();
      return;
    }
    router.back();
  };

  const buildNormalizedDetails = (): NormalizedInseminationDetails | null => {
    if (!values.estrus) {
      toast.error("Select the estrus type observed for this insemination.");
      return null;
    }

    const validationMessage = validateAIRecording({
      estrus: values.estrus,
      sireBreed: values.sireBreed,
      sireCode: values.sireCode,
      semenDosesUsed: values.semenDosesUsed,
      technicianNote: values.technicianNote,
      serviceDate: values.inseminationDate,
      serviceTime: values.inseminationTime,
    });
    if (validationMessage) {
      toast.error(validationMessage);
      return null;
    }

    return {
      inseminationDate: formatLocalCalendarDate(values.inseminationDate),
      time: formatLocalTime(values.inseminationTime),
      estrus: values.estrus,
      sireBreed: values.sireBreed.trim(),
      sireCode: values.sireCode.trim(),
      semenDosesUsed: Number(values.semenDosesUsed.trim()),
      technicianNote: values.technicianNote.trim() || undefined,
    };
  };

  const openReview = (farmer: SelectedFarmer, animal: SelectedAnimal) => {
    toast.dismiss();
    if (historicalTimeConfirmationRequired) {
      toast.error(
        "Confirm the actual historical service time. The visit period is not an exact procedure time.",
      );
      return;
    }
    if (!isCanonicalWorkflowId(farmer?._id)) {
      toast.error("A valid farmer is required before recording this service.");
      return;
    }
    if (!isCanonicalWorkflowId(animal?._id)) {
      toast.error("A valid animal is required before recording this service.");
      return;
    }

    if (mode.kind === "direct") {
      const eligibility = getAIEligibility({ animal });
      if (!eligibility.isEligible) {
        toast.error(
          eligibility.reason || "This animal is not eligible for AI service.",
        );
        return;
      }
    }

    const details = buildNormalizedDetails();
    if (!details) return;
    setReviewSnapshot({ farmer, animal, details });
  };

  const completeRecord = async () => {
    if (submissionLockRef.current || saving || !reviewSnapshot) return;
    submissionLockRef.current = true;
    toast.dismiss();
    let accepted = false;

    try {
      let payload:
        | RequestLinkedInseminationPayload
        | DirectInseminationPayload
        | any;
      if (mode.kind === "request-linked") {
        if (!requestContext || requestContext.workflowId !== mode.workflowId) {
          throw new Error(
            "The official AI request context is no longer available.",
          );
        }
        payload = {
          status: "done",
          ...(mode.taskId ? { taskId: mode.taskId } : {}),
          ...reviewSnapshot.details,
        };
      } else if (mode.kind === "direct") {
        payload = {
          farmerId: reviewSnapshot.farmer._id,
          animalId: reviewSnapshot.animal._id,
          animalDetails: null,
          inseminationDetails: {
            ...reviewSnapshot.details,
            status: "done",
          },
        };
      } else {
        throw new Error("This AI recording link is invalid.");
      }

      let result;
      if (mode.kind === "request-linked") {
        result = await requestMutation.mutateAsync(payload);
      } else {
        result = await walkInMutation.mutateAsync(payload);
      }
      accepted = result.status === "synced" || result.status === "queued";
      if (!accepted) {
        throw new Error("The AI recording was not accepted.");
      }
      if (result.status === "synced") {
        toast.success(
          mode.kind === "request-linked"
            ? "Insemination completed successfully."
            : "Direct AI record saved successfully.",
        );
      }

      setReviewSnapshot(null);
      requestAnimationFrame(() => {
        if (mode.kind === "request-linked") {
          returnToMyWork();
        } else {
          safeBack("/(technician)/(tabs)/technician.dashboard");
        }
      });
    } catch (error: any) {
      console.error("[AI_COMPLETION_PATCH_ERROR]", {
        requestId: mode.kind === "request-linked" ? mode.workflowId : undefined,
        endpoint:
          mode.kind === "request-linked"
            ? `/ai-request/${mode.workflowId}/status`
            : "/technician/walk-in-insemination",
        responseStatus: error?.response?.status,
        code: error?.response?.data?.code,
        message: error?.response?.data?.message || error?.message,
      });
      toast.error(getAIRecordingErrorMessage(error));
    } finally {
      if (!accepted) {
        submissionLockRef.current = false;
      }
    }
  };

  const title =
    mode.kind === "direct" ? "Record Direct AI Service" : "Record Insemination";
  const blockingError =
    mode.kind === "invalid" ? mode.message : requestError || contextError;

  return (
    <ScreenLayout edges={[]}>
      <AppPageHeader title={title} onBack={handleBack} />

      {blockingError ? (
        <View
          style={{ flex: 1, justifyContent: "center", paddingHorizontal: 16 }}
        >
          <AsyncState
            state="error"
            title="Unable to record this AI service"
            message={blockingError}
            actionLabel="Return to My Work"
            onAction={returnToMyWork}
          />
        </View>
      ) : mode.kind === "request-linked" && isRequestLoading ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              backgroundColor: colors.card,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_700Bold",
                fontSize: 14,
              }}
            >
              {[
                mode.fallback.farmerName,
                mode.fallback.animalName,
                mode.fallback.earTag,
              ]
                .filter(Boolean)
                .join(" · ") || "Loading request context"}
            </Text>
            {mode.fallback.scheduleDate ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  marginTop: 5,
                }}
              >
                Scheduled{" "}
                {new Date(mode.fallback.scheduleDate).toLocaleDateString(
                  "en-PH",
                )}
                {mode.fallback.visitPeriod
                  ? ` · ${mode.fallback.visitPeriod}`
                  : ""}
              </Text>
            ) : null}
          </View>
          <AsyncState
            state="loading"
            title="Loading official AI request"
            message="Farmer, animal, schedule, and observations are being verified."
            skeletonCount={3}
          />
        </ScrollView>
      ) : mode.kind === "request-linked" && requestContext ? (
        <RequestLinkedAIRecordForm
          context={requestContext}
          values={values}
          saving={saving}
          historicalTimeConfirmationRequired={
            historicalTimeConfirmationRequired
          }
          onValuesChange={updateValues}
          onReview={() =>
            openReview(requestContext.farmer, requestContext.animal)
          }
        />
      ) : mode.kind === "direct" ? (
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <DirectAIRecordForm
            route={mode}
            values={values}
            saving={saving}
            onValuesChange={updateValues}
            onReview={openReview}
          />
        </ScrollView>
      ) : null}

      <InseminationReviewModal
        visible={Boolean(reviewSnapshot)}
        snapshot={reviewSnapshot}
        saving={saving}
        onGoBack={() => {
          if (!saving) setReviewSnapshot(null);
        }}
        onComplete={() => void completeRecord()}
      />
    </ScreenLayout>
  );
}
