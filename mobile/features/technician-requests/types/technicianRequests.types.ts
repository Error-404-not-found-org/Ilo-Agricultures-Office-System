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

export interface RequestItem {
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
  status: string;
  urgency: "urgent" | "normal";
  farmer: string;
  farmerId: string;
  farmerImageUrl?: string;
  animal: string;
  animalId: string;
  earTag: string;
  breed: string;
  species: string;
  location: string;
  locationLabel?: string;
  distanceKm?: number | null;
  hasFarmPin?: boolean;
  farmPinStatus?: string;
  preferredDate: string;
  scheduledDate: string | null;
  assignedTechnician: string;
  createdAt: string;
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

export interface WorkQueueParty {
  id: string | null;
  name: string;
  phone?: string | null;
  location?: string;
  earTag?: string | null;
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
  animal: WorkQueueParty;
  schedule: CanonicalSchedule;
  requestedAt: string | null;
  completedAt: string | null;
  category?: string;
  taskType?: string;
  urgent?: boolean;
  overdue?: boolean;
  notes?: string;
  raw?: any;
  [key: string]: any;
}

export interface RequestFilters {
  type: "all" | "ai" | "health" | "breeding_verification";
  status: "all" | "pending" | "approved" | "scheduled" | "in_progress" | "completed" | "declined";
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

export interface RequestsResponse {
  requests: RequestItem[];
  pagination: PaginationInfo;
}
