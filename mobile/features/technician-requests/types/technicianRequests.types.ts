export type VisitPeriod = "morning" | "afternoon";

export type WorkflowType =
  | "AI"
  | "Health"
  | "PD"
  | "Calving"
  | "StandaloneTask";

export type AllowedAction =
  | "CLAIM_AND_SCHEDULE"
  | "RECORD_SERVICE"
  | "VIEW_RECORD"
  | "COMPLETE_TASK"
  | "START_SERVICE"
  | "SCHEDULE_VISIT"
  | "CLAIM"
  | null;

export interface CanonicalSchedule {
  date: string | null;
  visitPeriod: VisitPeriod | null;
}

export interface BaseRequestItem {
  id: string;
  workflowId: string | null;
  taskId: string | null;
  workflowType: WorkflowType;
  allowedAction: AllowedAction;
  actionLabel: string | null;
  schedule: CanonicalSchedule;
  type: "ai" | "health" | "breeding_verification";
  serviceType?: string;
  requestType?: string;
  requestKind?: "initial_ai" | "re_insemination";
  attemptNumber?: number | null;
  previousAttemptId?: any;
  previousAttemptOutcome?: string | null;
  previousAttemptVerified?: boolean;
  status: string;
  urgency: "urgent" | "normal";
  farmer: string;
  animal: string;
  animalId: string;
  earTag: string;
  breed: string;
  species: string;
  preferredDate: string;
  scheduledDate: string | null;
  createdAt: string;
  municipality?: string;
  barangay?: string;
}

export interface CandidateRequestItem extends BaseRequestItem {
  // Candidate-safe items intentionally omit private contact details
  farmerId?: never;
  farmerPhone?: never;
  farmerImageUrl?: string;
  location?: never;
  locationLabel?: never;
  distanceKm?: never;
  hasFarmPin?: never;
  farmPinStatus?: never;
  phone?: never;
  farmerDetails?: never;
  assignedTechnician?: never;
  raw?: never;
  heatSigns?: string[];
  requestSubmissionDate?: string;
  attachments?: {
    primaryUrl: string | null;
    urls: string[];
    count: number;
  };
  farmerObservation?: {
    reportType?: string | null;
    reportedAt?: string | null;
    signs?: string[];
    notes?: string;
    evidencePhotos?: string[];
    verificationRequested?: boolean;
    verificationStatus?: string;
  } | null;
}

export interface AssignedRequestItem extends BaseRequestItem {
  farmerId: string;
  farmerImageUrl?: string;
  location: string;
  locationLabel?: string;
  distanceKm?: number | null;
  hasFarmPin?: boolean;
  farmPinStatus?: string;
  assignedTechnician: string;
  farmerPhone?: string | null;
  phone?: string | null;
  farmerDetails?: {
    id: string | null;
    name: string;
    phone: string | null;
    location: string;
  };
  heatSigns?: string[];
  requestSubmissionDate?: string;
  attachments?: {
    primaryUrl: string | null;
    urls: string[];
    count: number;
  };
  farmerObservation?: {
    reportType?: string | null;
    reportedAt?: string | null;
    signs?: string[];
    notes?: string;
    evidencePhotos?: string[];
    verificationRequested?: boolean;
    verificationStatus?: string;
  } | null;
  raw: any;
}

export type RequestItem = CandidateRequestItem | AssignedRequestItem;

export interface WorkQueueParty {
  id: string | null;
  name: string;
  phone?: string | null;
  location?: string;
  earTag?: string | null;
  imageUrl?: string | null;
}

export interface WorkQueueItem {
  id: string;
  workflowId: string | null;
  taskId: string | null;
  workflowType: WorkflowType;
  serviceType: string;
  status: string;
  allowedAction: AllowedAction;
  actionLabel: string | null;
  farmer: WorkQueueParty;
  farmerImageUrl?: string | null;
  animal: WorkQueueParty;
  schedule: CanonicalSchedule;
  requestedAt: string | null;
  completedAt: string | null;
  category?: string;
  taskType?: string;
  urgent?: boolean;
  overdue?: boolean;
  farmerimageUrl?: string | null;
  notes?: string;
  raw?: any;
  requestKind?: "initial_ai" | "re_insemination";
  attemptNumber?: number | null;
  previousAttemptId?: string | null;
  attemptSeriesId?: string | null;
  previousAttemptOutcome?: string | null;
  previousAttemptVerified?: boolean;
  [key: string]: any;
}

export type TechnicianWorkType =
  | "ai"
  | "health"
  | "pregnancy_check"
  | "calving"
  | "breeding_follow_up"
  | "task";

export type TechnicianWorkTimingKind =
  | "scheduled_visit"
  | "confirmation_due"
  | "expected_event"
  | "task_due"
  | "unscheduled";

export type TechnicianWorkState =
  | "needs_scheduling"
  | "scheduled"
  | "needs_confirmation"
  | "monitoring"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface TechnicianWorkItem {
  id: string;
  workflowId: string | null;
  taskId: string | null;
  workType: TechnicianWorkType;
  timingKind: TechnicianWorkTimingKind;
  state: TechnicianWorkState;
  status: string;
  title: string;
  statusLabel: string;
  actionLabel: string;
  scheduledDate: string | null;
  visitPeriod: VisitPeriod | null;
  dueDate: string | null;
  expectedDate: string | null;
  completedAt: string | null;
  serviceStartedAt: string | null;
  farmerName: string | null;
  farmerImageUrl?: string | null;
  animalName: string | null;
  animalTag: string | null;
  location: string | null;
  timingLabel: string | null;
  isReadyToday: boolean;
  needsAttention: boolean;
  overdue: boolean;
  allowedAction: AllowedAction;
  readinessMessage?: string | null;
  requestKind:
    | "initial_ai"
    | "re_insemination"
    | "health"
    | "pregnancy_confirmation"
    | "breeding_observation_review"
    | "calving_monitoring"
    | "task";
  attemptNumber: number | null;
  previousAttemptId: string | null;
  previousAttemptOutcome: string | null;
  previousAttemptVerified: boolean;
}

export interface RequestsResponse {
  requests: RequestItem[];
  pagination: PaginationInfo;
}
export interface RequestFilters {
  type:
    | "all"
    | "ai"
    | "health"
    | "breeding_verification"
    | "calving"
    | "breeding_follow_up";
  status:
    | "all"
    | "pending"
    | "approved"
    | "scheduled"
    | "in_progress"
    | "completed"
    | "declined"
    | "active";
  urgency: "all" | "urgent";
  assignment: "all" | "mine" | "unassigned";
  search: string;
  page: number;
  limit: number;
  nearLat?: string;
  nearLng?: string;
  sortBy?: "newest" | "distance" | "preferredDate" | "oldest";
  municipality?: string;
  barangay?: string;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
