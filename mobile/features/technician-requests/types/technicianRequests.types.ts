export interface RequestItem {
  id: string;
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
