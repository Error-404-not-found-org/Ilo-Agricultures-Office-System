import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import { addToOfflineQueue } from "../lib/offlineQueue";
import NetInfo from "@react-native-community/netinfo";
import { toast } from "sonner-native";

interface OfflineMutationParams {
  url: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  description: string;
}

export function useOfflineMutation<TData = any, TError = any, TVariables = any, TContext = any>(
  params: OfflineMutationParams,
  options?: UseMutationOptions<TData, TError, TVariables, TContext>
) {
  const api = useApi();

  return useMutation({
    ...options,
    mutationFn: async (variables: TVariables) => {
      const state = await NetInfo.fetch();
      
      if (!state.isConnected) {
        // Save to offline queue
        await addToOfflineQueue({
          url: params.url,
          method: params.method,
          data: variables,
          description: params.description,
        });
        
        // Return a mock success response or throw a specific "Offline" error
        // that we can catch in the UI
        throw new Error("OFFLINE_SAVED");
      }

      // If online, proceed normally
      const response = await api({
        method: params.method,
        url: params.url,
        data: variables,
      });
      return response.data;
    },
    onError: (error: any, variables, context) => {
      if (error.message === "OFFLINE_SAVED") {
        toast.success("Saved offline! Will sync when connected.", {
          description: params.description,
          icon: "☁️",
        });
      } else if (options?.onError) {
        // @ts-ignore - Some versions of TanStack Query expect 4 arguments
        options.onError(error, variables, context as any);
      }
    },
  });
}
