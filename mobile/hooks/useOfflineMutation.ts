import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import { addToOfflineQueue, createStableId, createTemporaryId } from "../lib/offlineQueue";
import NetInfo from "@react-native-community/netinfo";
import { AxiosInstance } from "axios";
import { toast } from "sonner-native";

const OFFLINE_FALLBACK_TIMEOUT_MS = 7000;
const CONNECTIVITY_CHECK_TIMEOUT_MS = 1500;

class OfflineFallbackTimeoutError extends Error {
  code = "OFFLINE_FALLBACK_TIMEOUT";

  constructor() {
    super("The request did not complete before the offline fallback deadline.");
    this.name = "OfflineFallbackTimeoutError";
  }
}

export interface OfflineMutationParams {
  url: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  description: string;
  entityType?: string;
}

export interface MutationResult<TData = any> {
  status: "synced" | "queued";
  data?: TData;
}

export async function executeOfflineMutation<TData = any, TVariables = any>(
  api: AxiosInstance,
  params: OfflineMutationParams,
  variables: TVariables,
  idempotencyKeyInput?: string
): Promise<MutationResult<TData>> {
  const idempotencyKey = idempotencyKeyInput || createStableId();
  const queueMutation = async (
    queueIdempotencyKey = idempotencyKey,
  ): Promise<MutationResult<TData>> => {
    const tempId =
      params.method === "POST" ? createTemporaryId(params.entityType) : undefined;
    const queuedItem = await addToOfflineQueue({
      url: params.url,
      method: params.method,
      data: variables,
      description: params.description,
      tempId,
      entityType: params.entityType,
      idempotencyKey: queueIdempotencyKey,
    });

    return { status: "queued", data: { ...queuedItem, _id: tempId } as any };
  };

  // Some Android devices leave NetInfo.refresh() pending until connectivity
  // returns. A connectivity check must never be allowed to block a form.
  let connectivityTimer: ReturnType<typeof setTimeout> | undefined;
  const connectivityTimeout = new Promise<null>((resolve) => {
    connectivityTimer = setTimeout(
      () => resolve(null),
      CONNECTIVITY_CHECK_TIMEOUT_MS,
    );
  });
  const state = await Promise.race([NetInfo.refresh(), connectivityTimeout]);
  if (connectivityTimer) clearTimeout(connectivityTimer);
  
  const isDefinitelyOffline =
    state === null ||
    state.isConnected === false ||
    state.isInternetReachable === false;

  if (isDefinitelyOffline) {
    return queueMutation();
  }

  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

  try {
    const request = api({
      method: params.method,
      url: params.url,
      data: variables,
      timeout: 5000,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    });

    // Axios/React Native can leave a request pending indefinitely when the
    // device loses internet. Enforce our own deadline so the form can finish
    // locally instead of waiting for connectivity to return.
    const fallback = new Promise<never>((_, reject) => {
      fallbackTimer = setTimeout(
        () => reject(new OfflineFallbackTimeoutError()),
        OFFLINE_FALLBACK_TIMEOUT_MS,
      );
    });

    const response = await Promise.race([request, fallback]);
    return { status: "synced", data: response.data };
  } catch (error: any) {
    const isNetworkFailure =
      !error?.response &&
      (Boolean(error?.request) ||
        error?.code === "ERR_NETWORK" ||
        error?.code === "ECONNABORTED" ||
        error?.code === "ETIMEDOUT" ||
        error?.code === "OFFLINE_FALLBACK_TIMEOUT");

    if (isNetworkFailure) {
      // Preserve the original key in case the request reached the server but
      // its response was lost. Sync retries remain idempotent.
      return queueMutation(idempotencyKey);
    }

    throw error;
  } finally {
    if (fallbackTimer) clearTimeout(fallbackTimer);
  }
}

export function useOfflineMutation<TData = any, TError = any, TVariables = any, TContext = any>(
  params: OfflineMutationParams,
  options?: UseMutationOptions<MutationResult<TData>, TError, TVariables, TContext>
) {
  const api = useApi();

  return useMutation({
    ...options,
    mutationFn: async (variables: TVariables): Promise<MutationResult<TData>> => {
      return executeOfflineMutation<TData, TVariables>(api, params, variables);
    },
    onSuccess: (data, variables, context, mutation) => {
      if (data.status === "queued") {
        toast.success("Record saved on this device", {
          description: "It will sync automatically when you reconnect.",
          duration: 4000,
          id: `offline-queued-${params.entityType || params.url}`,
        });
      }

      if (options?.onSuccess) {
        options.onSuccess(data, variables, context as any, mutation);
      }
    },
  });
}
