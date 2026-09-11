import type { FarmerHealthRequestDetails } from "./healthRequestInput";

export interface FarmerAIRequestPayload {
  animalId: string;
  photos: string[];
  comment: string;
  heatSigns: string[];
}

export function buildFarmerAIRequestPayload(
  animalId: string,
  photos: string[],
  comment: string,
  heatSigns: string[],
  _heatSignsMap?: { id: string; label: string }[]
): FarmerAIRequestPayload {
  return {
    animalId,
    photos: photos.slice(0, 5),
    comment: comment?.trim() || "",
    heatSigns,
  };
}

export interface FarmerHealthRequestPayload {
  animalId: string;
  requestType: string;
  symptoms: string;
  urgency: string;
  farmerNotes: string;
  photos: string[];
  requestDetails?: FarmerHealthRequestDetails;
}

export function buildFarmerHealthRequestPayload(
  animalId: string,
  requestType: string,
  symptoms: string,
  urgency: string,
  farmerNotes: string,
  photos: string[],
  requestDetails?: FarmerHealthRequestDetails
): FarmerHealthRequestPayload {
  return {
    animalId,
    requestType,
    symptoms: symptoms.trim(),
    urgency,
    farmerNotes: farmerNotes.trim(),
    photos: photos.slice(0, 5),
    ...(requestDetails ? { requestDetails } : {}),
  };
}
