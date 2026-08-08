export interface FarmerAIRequestPayload {
  animalId: string;
  imageUrl?: string | null;
  comment: string;
  heatSigns: string[];
}

export function buildFarmerAIRequestPayload(
  animalId: string,
  imageUrl: string | null,
  comment: string,
  heatSigns: string[],
  heatSignsMap: { id: string; label: string }[]
): FarmerAIRequestPayload {
  const selectedLabels = heatSignsMap
    .filter((s) => heatSigns.includes(s.id))
    .map((s) => `• ${s.label}`);
    
  const formattedComment = [
    "Observed Heat Signs:\n" + selectedLabels.join("\n"),
    comment.trim() ? `Additional Notes:\n${comment.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    animalId,
    imageUrl: imageUrl || null,
    comment: formattedComment,
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
}

export function buildFarmerHealthRequestPayload(
  animalId: string,
  requestType: string,
  symptoms: string,
  urgency: string,
  farmerNotes: string,
  photos: string[]
): FarmerHealthRequestPayload {
  return {
    animalId,
    requestType,
    symptoms: symptoms.trim(),
    urgency,
    farmerNotes: farmerNotes.trim(),
    photos: photos.slice(0, 5),
  };
}
