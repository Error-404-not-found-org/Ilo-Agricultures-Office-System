import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import { addToOfflineQueue, createStableId } from "../lib/offlineQueue";
import NetInfo from "@react-native-community/netinfo";
import { toast } from "sonner-native";

interface OfflineMutationParams {
  url: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  description: string;
}

export interface MutationResult<TData = any> {
  status: "synced" | "queued";
  data?: TData;
}

export function useOfflineMutation<TData = any, TError = any, TVariables = any, TContext = any>(
  params: OfflineMutationParams,
  options?: UseMutationOptions<MutationResult<TData>, TError, TVariables, TContext>
) {
  const api = useApi();

  return useMutation({
    ...options,
    mutationFn: async (variables: TVariables): Promise<MutationResult<TData>> => {
      const state = await NetInfo.fetch();
      
      if (!state.isConnected) {
        const queuedItem = await addToOfflineQueue({
          url: params.url,
          method: params.method,
          data: variables,
          description: params.description,
        });
        
        return { status: "queued", data: queuedItem as any };
      }

      // Generate a stable idempotency key for online mutations too
      const idempotencyKey = createStableId();

      const response = await api({
        method: params.method,
        url: params.url,
        data: variables,
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
      });
      return { status: "synced", data: response.data };
    },
    onSuccess: (data, variables, context, mutation) => {
      if (data.status === "queued") {
        toast.success("Saved offline! Will sync when connected.", {
          description: params.description,
          icon: "☁️",
        });
      }
      if (options?.onSuccess) {
        options.onSuccess(data, variables, context as any, mutation);
      }
    },
  });
}
