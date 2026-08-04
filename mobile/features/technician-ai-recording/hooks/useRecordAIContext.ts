import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { aiRequestKeys } from "@/lib/queryKeys";
import { getTechnicianRequestDetail } from "@/features/technician/services/technician.service";
import { isCanonicalWorkflowId } from "@/features/technician-requests/utils/aiWorkflow";
import type {
  RecordAIRouteMode,
  RequestLinkedContext,
  RouteDisplayFallback,
} from "../types/technicianAIRecording.types";

type RouteParam = string | string[] | undefined;

const readRouteParam = (value: RouteParam) =>
  Array.isArray(value) ? value[0] : value;

const idOf = (value: any) => {
  if (typeof value === "string") return value;
  return value?._id ? String(value._id) : value?.id ? String(value.id) : "";
};

const uniqueStrings = (values: unknown[]) =>
  Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

const normalizeRequestContext = (
  request: any,
  mode: Extract<RecordAIRouteMode, { kind: "request-linked" }>,
): { context: RequestLinkedContext | null; error: string | null } => {
  const requestId = idOf(request);
  const farmer = request?.farmerId;
  const animal = request?.animalId;
  const farmerId = idOf(farmer);
  const animalId = idOf(animal);

  if (requestId !== mode.workflowId) {
    return {
      context: null,
      error: "The loaded AI request does not match this workflow.",
    };
  }
  if (!isCanonicalWorkflowId(farmerId)) {
    return { context: null, error: "The linked request has no valid farmer." };
  }
  if (!isCanonicalWorkflowId(animalId)) {
    return { context: null, error: "The linked request has no valid animal." };
  }
  if (
    mode.routeFarmerId &&
    (!isCanonicalWorkflowId(mode.routeFarmerId) || mode.routeFarmerId !== farmerId)
  ) {
    return {
      context: null,
      error: "The farmer in this link does not match the official AI request.",
    };
  }
  if (
    mode.routeAnimalId &&
    (!isCanonicalWorkflowId(mode.routeAnimalId) || mode.routeAnimalId !== animalId)
  ) {
    return {
      context: null,
      error: "The animal in this link does not match the official AI request.",
    };
  }

  const status = String(request?.status || "").toLowerCase();
  if (["done", "completed"].includes(status)) {
    return {
      context: null,
      error: "This AI request has already been completed. Open its record from My Work.",
    };
  }
  if (!["scheduled", "in-progress", "in_progress"].includes(status)) {
    return {
      context: null,
      error: "This AI request is not ready for service recording.",
    };
  }

  const previousAttempt = request?.previousAttemptId;
  const previousAttemptId = idOf(previousAttempt);
  const visitPeriod =
    request?.visitPeriod === "morning" || request?.visitPeriod === "afternoon"
      ? request.visitPeriod
      : null;

  return {
    error: null,
    context: {
      workflowId: mode.workflowId,
      farmer: {
        ...farmer,
        _id: farmerId,
        name: farmer?.name || "Farmer",
        phoneNumber: farmer?.phoneNumber || null,
      },
      animal: {
        ...animal,
        _id: animalId,
        name:
          animal?.name ||
          animal?.animalName ||
          animal?.earTag ||
          animal?.animalId ||
          "Animal",
      },
      scheduledDate: request?.scheduledDate || null,
      visitPeriod,
      heatSigns: uniqueStrings([request?.heatSigns]),
      farmerNotes: uniqueStrings([
        request?.comment,
        request?.farmerObservationNotes,
      ]),
      attachmentUrls: uniqueStrings([
        request?.imageUrl,
        request?.evidencePhotos,
      ]),
      attemptNumber:
        Number.isInteger(request?.attemptNumber) && request.attemptNumber > 0
          ? request.attemptNumber
          : null,
      previousAttempt: isCanonicalWorkflowId(previousAttemptId)
        ? {
            id: previousAttemptId,
            attemptNumber:
              Number.isInteger(previousAttempt?.attemptNumber) &&
              previousAttempt.attemptNumber > 0
                ? previousAttempt.attemptNumber
                : null,
            inseminationDate: previousAttempt?.inseminationDate || null,
            outcome: previousAttempt?.outcome || null,
          }
        : null,
      status,
      raw: request,
    },
  };
};

export function useRecordAIContext() {
  const api = useApi();
  const params = useLocalSearchParams<{
    mode?: RouteParam;
    source?: RouteParam;
    workflowId?: RouteParam;
    taskId?: RouteParam;
    farmerId?: RouteParam;
    animalId?: RouteParam;
    farmerName?: RouteParam;
    animalName?: RouteParam;
    earTag?: RouteParam;
    scheduleDate?: RouteParam;
    visitPeriod?: RouteParam;
  }>();

  const routeValues = useMemo(
    () => ({
      mode: readRouteParam(params.mode),
      source: readRouteParam(params.source),
      workflowId: readRouteParam(params.workflowId),
      taskId: readRouteParam(params.taskId),
      farmerId: readRouteParam(params.farmerId),
      animalId: readRouteParam(params.animalId),
      farmerName: readRouteParam(params.farmerName),
      animalName: readRouteParam(params.animalName),
      earTag: readRouteParam(params.earTag),
      scheduleDate: readRouteParam(params.scheduleDate),
      visitPeriod: readRouteParam(params.visitPeriod),
    }),
    [params],
  );

  const mode = useMemo<RecordAIRouteMode>(() => {
    const fallback: RouteDisplayFallback = {
      farmerName: routeValues.farmerName,
      animalName: routeValues.animalName,
      earTag: routeValues.earTag,
      scheduleDate: routeValues.scheduleDate,
      visitPeriod: routeValues.visitPeriod,
    };

    if (routeValues.mode === "request-linked") {
      if (!isCanonicalWorkflowId(routeValues.workflowId)) {
        return {
          kind: "invalid",
          message: "This request-linked AI service is missing a valid workflow ID.",
          fallback,
        };
      }
      return {
        kind: "request-linked",
        workflowId: routeValues.workflowId,
        taskId: isCanonicalWorkflowId(routeValues.taskId)
          ? routeValues.taskId
          : undefined,
        routeFarmerId: routeValues.farmerId,
        routeAnimalId: routeValues.animalId,
        fallback,
      };
    }

    if (
      (routeValues.mode && routeValues.mode !== "direct") ||
      routeValues.workflowId
    ) {
      return {
        kind: "invalid",
        message: "This AI recording link has an unsupported or incomplete workflow mode.",
        fallback,
      };
    }

    return {
      kind: "direct",
      source: routeValues.source,
      farmerId: routeValues.farmerId,
      animalId: routeValues.animalId,
    };
  }, [routeValues]);

  const requestQuery = useQuery({
    queryKey: aiRequestKeys.detail(
      mode.kind === "request-linked" ? mode.workflowId : "disabled",
    ),
    queryFn: () =>
      getTechnicianRequestDetail(
        api,
        "ai",
        mode.kind === "request-linked" ? mode.workflowId : "",
      ),
    enabled: mode.kind === "request-linked",
    staleTime: 30_000,
    retry: 1,
    networkMode: "offlineFirst",
  });

  const normalized = useMemo(() => {
    if (mode.kind !== "request-linked" || !requestQuery.data) {
      return { context: null, error: null };
    }
    return normalizeRequestContext(requestQuery.data, mode);
  }, [mode, requestQuery.data]);

  return {
    mode,
    requestContext: normalized.context,
    contextError: normalized.error,
    isRequestLoading:
      mode.kind === "request-linked" && requestQuery.isPending,
    requestError:
      mode.kind === "request-linked" && requestQuery.isError
        ? (requestQuery.error as any)?.response?.data?.message ||
          (requestQuery.error as Error)?.message ||
          "The official AI request could not be loaded."
        : null,
    retryRequest: requestQuery.refetch,
  };
}
