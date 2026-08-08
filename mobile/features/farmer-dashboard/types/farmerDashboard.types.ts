import type {
  AIRequest,
  Animal,
  AppNotification,
  Farmer,
  FarmerStats,
  HealthRequest,
} from "@/types";

export interface FarmerDashboardProfile extends Farmer {
  stats?: FarmerStats;
}

export interface UpcomingVisitBase {
  _id: string;
  serviceType: "ai" | "health";
  status?: string;
  scheduledDate?: string;
  preferredDate?: string;
  createdAt?: string;
  technician?: string | null;
  animalId?: string | Animal;
}

export type UpcomingVisit =
  | (AIRequest & UpcomingVisitBase & { serviceType: "ai" })
  | (HealthRequest & UpcomingVisitBase & { serviceType: "health" });

export interface FarmerActivity {
  id?: string;
  _id?: string;
  type?: string;
  title?: string;
  description?: string;
  message?: string;
  date?: string;
  animalId?: string | Animal;
  details?: Record<string, any>;
  createdAt?: string;
}

export interface FarmerMilestone {
  type?: string;
  title?: string;
  animal?: Animal;
  date?: string;
  daysLeft?: number;
  priority?: string;
  relatedId?: string;
  resolved?: boolean;
  status?: string;
  taskId?: string | null;
  pregnancyReadiness?: {
    isEligible?: boolean;
    reason?: string;
    availableDate?: string | null;
    availableDateLabel?: string | null;
    daysPostAI?: number | null;
    minimumDays?: number | null;
  } | null;
  farmerObservation?: {
    reportType?: "possible_pregnancy" | "return_to_heat" | "unsure" | null;
    verificationStatus?: string | null;
    reportedAt?: string | null;
  } | null;
}

export interface FarmerAttentionItem extends FarmerMilestone {
  displayTitle: string;
  displaySubtitle: string;
  urgency: "overdue" | "due_today" | "actionable" | "awaiting";
  animalReference: string;
  guidance: string;
  actionLabel: string;
  actionKind:
    | "report_signs"
    | "request_pregnancy_check"
    | "record_calving"
    | "view_animal";
}

export interface FarmerActivityPresentation {
  id: string;
  title: string;
  outcome: string;
  date?: string;
  type: string;
  animalId?: string | Animal;
  fullAnimalReference: string;
}

export interface FarmerDashboardData {
  profile?: FarmerDashboardProfile;
  unreadCount: number;
  upcomingVisits: UpcomingVisit[];
  pendingOutcomes: AIRequest[];
  milestones: FarmerMilestone[];
  myAnimals: Animal[];
  activityFeed: FarmerActivity[];
}

export interface FarmerDashboardNotificationSummary {
  count: number;
  notifications?: AppNotification[];
}
