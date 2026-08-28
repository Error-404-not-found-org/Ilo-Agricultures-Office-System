import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import { addToOfflineQueue, createStableId, createTemporaryId } from "../lib/offlineQueue";
import NetInfo from "@react-native-community/netinfo";
import { AxiosInstance } from "axios";
import { toast } from "sonner-native";
import { useUser } from "@clerk/clerk-expo";
import { queryClient } from "../lib/queryClient";
import { getBootstrapUserQueryKey } from "@/features/auth/hooks/useBootstrapUser";

const OFFLINE_FALLBACK_TIMEOUT_MS = 7000;
const CONNECTIVITY_CHECK_TIMEOUT_MS = 1500;
const RECONCILIATION_TIMEOUT_MS = 30000;
const RECONCILIATION_REQUEST_TIMEOUT_MS = 10000;
const RECONCILIATION_RETRY_DELAY_MS = 750;

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
  reconcileOnTimeout?: boolean;
}

export type OfflineMutationLifecycleState =
  | "idle"
  | "submitting"
  | "reconciling"
  | "replaying"
  | "queued"
  | "synced";

export interface MutationResult<TData = any> {
  status: "synced" | "queued";
  data?: TData;
}

type OfflineMutationOptions<TData, TError, TVariables, TContext> =
  UseMutationOptions<MutationResult<TData>, TError, TVariables, TContext> & {
    onLifecycleStateChange?: (state: OfflineMutationLifecycleState) => void;
  };

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const isNetworkFailure = (error: any) =>
  !error?.response &&
  (Boolean(error?.request) ||
    error?.code === "ERR_NETWORK" ||
    error?.code === "ECONNABORTED" ||
    error?.code === "ETIMEDOUT" ||
    error?.code === "OFFLINE_FALLBACK_TIMEOUT");

const refreshConnectivity = async () => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), CONNECTIVITY_CHECK_TIMEOUT_MS);
  });
  const state = await Promise.race([NetInfo.refresh(), timeout]);
  if (timer) clearTimeout(timer);
  return state;
};

export const getOfflineMutationOwner = (clerkUserId?: string) => {
  const dbUserResponse = queryClient.getQueryData(
    getBootstrapUserQueryKey(clerkUserId),
  ) as any;
  return {
    ownerUserId: dbUserResponse?.user?._id as string | undefined,
    ownerRole: dbUserResponse?.user?.role as string | undefined,
  };
};

export async function executeOfflineMutation<TData = any, TVariables = any>(
  api: AxiosInstance,
  params: OfflineMutationParams,
  variables: TVariables,
  idempotencyKeyInput?: string,
  onLifecycleStateChange?: (state: OfflineMutationLifecycleState) => void,
  ownerUserId?: string,
  ownerRole?: string,
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
      ownerUserId,
      ownerRole,
    });

    onLifecycleStateChange?.("queued");
    return { status: "queued", data: { ...queuedItem, _id: tempId } as any };
  };

  // Some Android devices leave NetInfo.refresh() pending until connectivity
  // returns. A connectivity check must never be allowed to block a form.
  onLifecycleStateChange?.("submitting");
  const state = await refreshConnectivity();
  
  const isDefinitelyOffline =
    state?.isConnected === false ||
    state?.isInternetReachable === false;

  if (isDefinitelyOffline) {
    return queueMutation();
  }

  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

  const sendRequest = (timeout: number) =>
    api({
      method: params.method,
      url: params.url,
      data: variables,
      timeout,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    });

  const reconcileTimedOutRequest = async (): Promise<MutationResult<TData>> => {
    const deadline = Date.now() + RECONCILIATION_TIMEOUT_MS;
    onLifecycleStateChange?.("reconciling");

    while (Date.now() < deadline) {
      await wait(RECONCILIATION_RETRY_DELAY_MS);
      onLifecycleStateChange?.("replaying");
      try {
        const response = await sendRequest(RECONCILIATION_REQUEST_TIMEOUT_MS);
        onLifecycleStateChange?.("synced");
        return { status: "synced", data: response.data };
      } catch (error: any) {
        if (error?.response?.data?.code === "IDEMPOTENCY_IN_PROGRESS") {
          onLifecycleStateChange?.("reconciling");
          continue;
        }
        if (!isNetworkFailure(error)) throw error;

        const currentState = await refreshConnectivity();
        if (
          currentState?.isConnected === false ||
          currentState?.isInternetReachable === false
        ) {
          return queueMutation(idempotencyKey);
        }
        onLifecycleStateChange?.("reconciling");
      }
    }

    // The outcome is still ambiguous. Persist the exact same operation/key for
    // background replay and keep the form locked against a fresh submission.
    return queueMutation(idempotencyKey);
  };

  try {
    const request = sendRequest(params.reconcileOnTimeout ? 12000 : 5000);

    // Axios/React Native can leave a request pending indefinitely when the
    // device loses internet. Enforce our own deadline so the form can finish
    // locally instead of waiting for connectivity to return.
    const fallback = new Promise<never>((_, reject) => {
      fallbackTimer = setTimeout(
        () => reject(new OfflineFallbackTimeoutError()),
        params.reconcileOnTimeout ? 15000 : OFFLINE_FALLBACK_TIMEOUT_MS,
      );
    });

    const response = await Promise.race([request, fallback]);
    onLifecycleStateChange?.("synced");
    return { status: "synced", data: response.data };
  } catch (error: any) {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = undefined;
    }
    if (isNetworkFailure(error)) {
      if (params.reconcileOnTimeout) {
        return reconcileTimedOutRequest();
      }
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
  options?: OfflineMutationOptions<TData, TError, TVariables, TContext>,
) {
  const api = useApi();
  const { user } = useUser();
  const { onLifecycleStateChange, ...mutationOptions } = options || {};

  return useMutation({
    ...mutationOptions,
    mutationFn: async (variables: TVariables): Promise<MutationResult<TData>> => {
      const { ownerUserId, ownerRole } = getOfflineMutationOwner(user?.id);
      if (!ownerUserId) {
        throw new Error("Cannot execute offline mutation without an authoritative user session");
      }
      return executeOfflineMutation<TData, TVariables>(
        api,
        params,
        variables,
        undefined,
        onLifecycleStateChange,
        ownerUserId,
        ownerRole
      );
    },
    onSuccess: (data, variables, context, mutation) => {
      if (data.status === "queued") {
        toast.success("Submission saved safely", {
          description: params.reconcileOnTimeout
            ? "It will continue syncing with the original operation ID. Do not submit it again."
            : "It will sync automatically when you reconnect.",
          duration: 4000,
          id: `offline-queued-${params.entityType || params.url}`,
        });
      }

      if (mutationOptions.onSuccess) {
        mutationOptions.onSuccess(data, variables, context as any, mutation);
      }
    },
  });
}
