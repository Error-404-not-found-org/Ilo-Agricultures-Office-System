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
  _id?: string;
  type?: string;
  title?: string;
  message?: string;
  details?: Record<string, any>;
  createdAt?: string;
}

export interface FarmerDashboardData {
  profile?: FarmerDashboardProfile;
  unreadCount: number;
  upcomingVisits: UpcomingVisit[];
  pendingOutcomes: AIRequest[];
  milestones: unknown[];
  myAnimals: Animal[];
  activityFeed: FarmerActivity[];
}

export interface FarmerDashboardNotificationSummary {
  count: number;
  notifications?: AppNotification[];
}
