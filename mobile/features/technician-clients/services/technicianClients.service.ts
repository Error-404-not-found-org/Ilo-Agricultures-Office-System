import { AxiosInstance } from "axios";
import { ClientsFetchParams, ClientsResponse } from "../types/technicianClients.types";

export const getTechnicianClients = async (
  api: AxiosInstance,
  params: ClientsFetchParams
): Promise<ClientsResponse> => {
  const queryParams = new URLSearchParams({
    role: params.role,
    page: String(params.page),
    limit: String(params.limit),
    ...(params.search ? { search: params.search } : {}),
    ...(params.barangay && params.barangay !== "All" ? { barangay: params.barangay } : {}),
    ...(params.city && params.city !== "All" ? { city: params.city } : {}),
    ...(params.accountStatus && params.accountStatus !== "all"
      ? { accountStatus: params.accountStatus }
      : {}),
  });

  const response = await api.get(`/user?${queryParams.toString()}`);
  return response.data || { data: [], total: 0, totalPages: 1 };
};
