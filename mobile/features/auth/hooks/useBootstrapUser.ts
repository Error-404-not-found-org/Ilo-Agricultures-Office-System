import { useQuery } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

interface BootstrapUser {
  _id: string;
  isVerified: boolean;
  role: string;
}

interface BootstrapUserResponse {
  user: BootstrapUser;
}

interface UseBootstrapUserOptions {
  api: AxiosInstance;
  isSignedIn: boolean;
  userId?: string;
}

export const getBootstrapUserQueryKey = (userId?: string) =>
  ["mongodb-user", userId] as const;

export const useBootstrapUser = ({
  api,
  isSignedIn,
  userId,
}: UseBootstrapUserOptions) => {
  const query = useQuery({
    queryKey: getBootstrapUserQueryKey(userId),
    queryFn: async () => {
      const response = await api.post<BootstrapUserResponse>("/user/bootstrap");
      return response.data;
    },
    enabled: Boolean(isSignedIn && userId),
    retry: false,
  });

  return {
    dbUser: query.data?.user,
    bootstrapError: query.error,
    isBootstrapLoading: query.isLoading,
    retryBootstrap: query.refetch,
  };
};
