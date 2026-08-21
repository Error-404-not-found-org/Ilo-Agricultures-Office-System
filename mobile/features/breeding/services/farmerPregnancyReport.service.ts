import type { AxiosInstance } from "axios";

export type FarmerPregnancyReportPayload = {
  notes?: string;
  evidencePhotos?: string[];
};

export const submitFarmerPregnancyReport = async (
  api: AxiosInstance,
  requestId: string,
  payload: FarmerPregnancyReportPayload,
  idempotencyKey: string,
) => {
  const response = await api.post(
    `/ai-request/${requestId}/farmer-pregnancy-report`,
    payload,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return response.data;
};
