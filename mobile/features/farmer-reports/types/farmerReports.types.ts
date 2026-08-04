export interface Animal {
  _id: string;
  animalId: string;
  earTag?: string;
  breed: string;
  species: string;
  reproductiveStatus?: string;
}

export interface Milestone {
  type: "calving" | "heat_check" | "pd_check";
  title: string;
  animal?: {
    _id: string;
    earTag?: string;
    breed?: string;
    species?: string;
  };
  date: string;
  daysLeft: number;
  priority: "high" | "medium";
  relatedId: string;
}

export interface ActivityFeedItem {
  id: string;
  title: string;
  description: string;
  date: string;
  type: "ai" | "health" | "pregnancy" | "calving";
  animalId?: {
    _id: string;
    earTag?: string;
    breed?: string;
    species?: string;
  };
  details?: {
    sireBreed?: string;
    sireCode?: string;
    attemptNumber?: number;
    estrus?: string;
    status?: string;
    outcome?: string;
    technician?: string;
    technicianPhone?: string;
    technicianNote?: string;
    outcomeVerificationStatus?: string;
    outcomeConfirmationSource?: string;
    outcomeConfirmedAt?: string;
    previousAttemptNumber?: number;
    previousAttemptDate?: string;
    inseminationDate?: string;
    scheduledDate?: string;
    preferredDate?: string;
    requestedAt?: string;
    serviceDate?: string;
    entryDate?: string;
    isHistoricalEntry?: boolean;
    performedByName?: string;
    lateEntryReason?: string;

    requestType?: string;
    symptoms?: string;
    urgency?: string;
    diagnosis?: string;
    treatment?: string;
    advice?: string;
    targetCalvingDate?: string;

    calvingEase?: string;
    numberOfCalves?: number;
    calves?: {
      sex: string;
      earTag?: string;
      weight?: number;
      imageUrl?: string;
    }[];
  };
}

export interface RecordStats {
  total: number;
  ai: number;
  health: number;
  calving: number;
}
