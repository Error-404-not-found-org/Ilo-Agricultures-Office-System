export type AnimalTimelineEventType =
  | "animal_registered"
  | "farmer_status_update"
  | "ai_requested"
  | "inseminated"
  | "pregnancy_checked"
  | "pregnancy_confirmed"
  | "calving_recorded"
  | "health_request_created"
  | "health_triaged"
  | "treatment_recorded"
  | "follow_up_due";

export interface AnimalTimelineEvent {
  _id?: string;
  eventType: AnimalTimelineEventType | string;
  occurredAt: string;
  title: string;
  summary?: string;
  sourceType: string;
  sourceId?: string;
  attachments?: string[];
  metadata?: Record<string, unknown>;
}

export interface ReproductionEligibility {
  eligible: boolean;
  code: string;
  reason: string;
  nextActionAt?: string;
}
