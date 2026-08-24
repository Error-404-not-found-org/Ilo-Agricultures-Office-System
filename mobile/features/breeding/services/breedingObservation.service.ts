import type { AxiosInstance } from "axios";

export type BreedingObservationType = "possible_pregnancy" | "return_to_heat" | "unsure";

export type BreedingObservationPayload = {
  reportType: BreedingObservationType;
  signs: string[];
  notes?: string;
  evidencePhotos?: string[];
  verificationRequested?: boolean;
};

export const submitBreedingObservation = async (
  api: AxiosInstance,
  requestId: string,
  payload: BreedingObservationPayload,
  idempotencyKey: string,
) => {
  const response = await api.post(
    `/ai-request/${requestId}/farmer-observation`,
    payload,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return response.data;
};
