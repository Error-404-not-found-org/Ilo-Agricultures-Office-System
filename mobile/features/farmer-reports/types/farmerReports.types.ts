export interface Animal {
  _id: string;
  animalId: string;
  earTag?: string;
  breed: string;
  species: string;
  reproductiveStatus?: string;
  imageUrl?: string;
}

export type OfficialRecordKind =
  | "insemination"
  | "pregnancy"
  | "calving"
  | "health_request"
  | "medical_record";

export interface RecordAttachment {
  url: string;
  category:
    | "request_evidence"
    | "follow_up_evidence"
    | "farmer_evidence"
    | "medical_record_evidence"
    | "offspring_identity";
  label: string;
  animalId?: string | null;
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
  sourceId?: string;
  sourceKind?: OfficialRecordKind;
  title: string;
  description: string;
  date: string;
  dateLabel?: string;
  datePrecision?: "date" | "datetime";
  attachments?: RecordAttachment[];
  type: "ai" | "health" | "pregnancy" | "calving";
  animalId?: {
    _id: string;
    earTag?: string;
    breed?: string;
    species?: string;
    reproductiveStatus?: string;
    imageUrl?: string;
  };
  details?: {
    sireBreed?: string;
    sireCode?: string;
    semenDosesUsed?: number;
    attemptNumber?: number;
    estrus?: string;
    status?: string;
    outcome?: string;
    failureReason?: string;
    technician?: string;
    technicianPhone?: string;
    technicianNote?: string;
    outcomeVerificationStatus?: string;
    outcomeConfirmationSource?: string;
    outcomeConfirmedBy?: string;
    outcomeConfirmedAt?: string;
    previousAttemptNumber?: number;
    previousAttemptDate?: string;
    previousAttemptOutcome?: string;
    previousAttemptFailureReason?: string;
    inseminationDate?: string;
    scheduledDate?: string;
    visitPeriod?: "morning" | "afternoon" | null;
    serviceStartedAt?: string | null;
    completedAt?: string | null;
    completedAtLabel?: string;
    earlyStartMinutes?: number;
    preferredDate?: string;
    requestedAt?: string;
    requestedAtLabel?: string;
    serviceDate?: string;
    serviceDateLabel?: string;
    entryDate?: string;
    entryDateLabel?: string;
    isHistoricalEntry?: boolean;
    performedByName?: string;
    lateEntryReason?: string;

    requestType?: string;
    symptoms?: string;
    urgency?: string;
    farmerNotes?: string;
    diagnosis?: string;
    treatment?: string;
    medicine?: string;
    dosage?: string;
    advice?: string;
    followUpDate?: string;
    withdrawalPeriod?: string;
    withdrawalPeriodDays?: number;
    withdrawalEndDate?: string;
    targetCalvingDate?: string;
    diagnosticMethod?: string | null;
    confirmationStage?: string;
    confirmedAt?: string;
    policyVersion?: string;
    relatedAttempt?: number;
    recheckRequired?: boolean;
    recheckDueAt?: string | null;
    recheckStatus?: string;

    calvingEase?: string;
    numberOfCalves?: number;
    calvingOutcome?: string;
    livingCalfCount?: number;
    stillbornCount?: number;
    relatedPregnancyId?: string | null;
    relatedInseminationId?: string | null;
    farmerOutcomeReport?: string | null;
    farmerOutcomeReportedAt?: string;
    farmerObservationSigns?: string[];
    farmerObservationNotes?: string;
    pregnancyLinked?: boolean;
    pregnancyResult?: string;
    pregnancyDiagnosisDate?: string;
    pregnancyConfirmationMethod?: string | null;
    nonLivingCalves?: {
      sex: string;
      earTag?: string;
      color?: string;
      brand?: string;
    }[];
    calves?: {
      sex: string;
      earTag?: string;
      animalId?: string | null;
      weight?: number;
      imageUrl?: string;
    }[];
  };
}

export interface OfficialRecordDetail extends ActivityFeedItem {
  sourceId: string;
  sourceKind: OfficialRecordKind;
  datePrecision: "date" | "datetime";
  technician?: {
    id: string | null;
    name: string;
  } | null;
  actions: {
    reportPreviewAvailable: boolean;
    reportId?: string | null;
    pregnancyTrackerAvailable: boolean;
  };
}

export interface RecordStats {
  total: number;
  ai: number;
  health: number;
  calving: number;
}
