import { AxiosInstance } from "axios";

/**
 * @deprecated No active screen calls this legacy Technician deletion helper.
 * Official reproductive records are immutable; Admin correction uses the
 * protected Admin archive workflow. Retained only for compatibility cleanup.
 */
export const deleteLedgerRecord = async (
  api: AxiosInstance,
  { id, type }: { id: string; type: string }
) => {
  const endpoint =
    type === "health-request"
      ? `/health-request/${id}`
      : type === "insemination"
        ? `/insemination/${id}`
        : type === "pregnancy"
          ? `/technician/pregnancy-checks/${id}`
          : type === "calving"
            ? `/technician/calvings/${id}`
            : `/ai-request/${id}`;
  const response = await api.delete(endpoint);
  return response.data;
};
