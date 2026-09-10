import type { QueuedMutation } from "../lib/offlineQueue";
import type { FarmerHealthRequestDetails } from "../features/farmer-requests/utils/healthRequestInput";

export type UserRole = "admin" | "technician" | "farmer";

export type UserStatus = "active" | "on-site" | "on-leave" | "inactive";

export type AnimalSex = "Male" | "Female";

export type ReproductiveStatus =
  | "Normal"
  | "In Heat"
  | "Inseminated"
  | "Pregnant"
  | "Post-partum"
  | "Lactating"
  | "Dry"
  | "Calved"
  | "Open"
  | "Likely Pregnant";

export type RequestStatus =
  | "pending"
  | "active"
  | "triaged"
  | "assigned"
  | "approved"
  | "scheduled"
  | "in-progress"
  | "in_progress"
  | "done"
  | "completed"
  | "resolved"
  | "cancelled"
  | "rejected"
  | "claimed"
  | "unassigned"
  | "declined";

export type CanonicalHealthRequestStatus =
  | "pending"
  | "active"
  | "in-progress"
  | "resolved"
  | "cancelled";

export type CanonicalHealthRequestType =
  | "health_concern"
  | "medicine_request"
  | "preventive_care"
  | "other";

export type HealthHandlingMethod = "advice" | "office_pickup" | "farm_visit";

export type HealthPriority = "normal" | "urgent";

export type ServiceType = "ai" | "health";

export type OfflineMutationStatus = QueuedMutation["status"];

export interface Coordinates {
  lat?: number;
  lng?: number;
}

export interface Address {
  houseNumber?: string;
  street?: string;
  subdivision?: string;
  barangay: string;
  city: string;
  district?: string;
  province: string;
  region?: string;
  zipCode?: string;
  phoneNumber?: string;
  landmark?: string;
  detectedAddress?: string;
  locationCapturedAt?: string;
  coordinates?: Coordinates;
  isDefault?: boolean;
}

export interface FarmLocation {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  landmark?: string;
  directionsNote?: string;
  detectedAddress?: string;
  sameAsContactAddress?: boolean;
  isConfirmed?: boolean;
  confirmedAt?: string;
  capturedAt?: string;
  source?: "farmer_current_location" | "technician_current_location" | "manual";
}

export interface AppUser {
  _id: string;
  clerkId?: string;
  email?: string;
  name: string;
  imageUrl?: string;
  phoneNumber?: string;
  phoneVerification?: {
    pendingPhoneNumber?: string;
    pendingNormalizedPhoneNumber?: string;
    isVerified?: boolean;
    verifiedAt?: string | null;
    lastOtpSentAt?: string | null;
    failedAttempts?: number;
  };
  address?: Address;
  farmLocation?: FarmLocation | null;
  role: UserRole;
  isVerified?: boolean;
  status?: UserStatus;
  pushToken?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type User = AppUser;

export interface Farmer extends AppUser {
  role: "farmer";
  stats?: FarmerStats;
}

export interface Technician extends AppUser {
  role: "technician";
  assignedBarangays?: string[];
}

export interface FarmerStats {
  totalAnimals: number;
  activePregnancies: number;
  upcomingCalvings: number;
  pendingResults: number;
}

export type ReproductionPhase =
  | "AVAILABLE"
  | "AI_REQUESTED"
  | "AI_SCHEDULED"
  | "HEAT_RETURN_MONITORING"
  | "PREGNANCY_CHECK_DUE"
  | "PREGNANCY_MONITORING"
  | "PREGNANT"
  | "CALVING_DUE"
  | "RECOVERY_PERIOD";

export type ReproductionNextActionType =
  | "SCHEDULE_AI_SERVICE"
  | "ATTEND_AI_VISIT"
  | "MONITOR_RETURN_TO_HEAT"
  | "VERIFY_BREEDING_OUTCOME"
  | "PERFORM_PREGNANCY_DIAGNOSIS"
  | "PREPARE_FOR_CALVING"
  | "WAIT_FOR_POSTPARTUM_RECOVERY";

export type ReproductionNextActionDateKind =
  | "confirmed"
  | "requested"
  | "calculated";

export interface ReproductionNextAction {
  phase: ReproductionPhase;
  type: ReproductionNextActionType;
  label: string;
  at: string | null;
  dateKind: ReproductionNextActionDateKind | null;
  source: string | null;
  isOverdue: boolean;
}

export interface Animal {
  _id: string;
  animalId?: string;
  earTag?: string;
  name?: string;
  species?: string;
  breed?: string;
  color?: string;
  sex?: AnimalSex;
  birthDate?: string;
  owner?: string | Farmer;
  reproductiveStatus?: ReproductiveStatus;
  effectiveReproductiveStatus?: ReproductiveStatus;
  pregnancyStatus?: ReproductiveStatus;
  lastInseminationDate?: string;
  expectedCalvingDate?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  gender?: string;
  parity?: number;
  lastCalvingDate?: string;
  brand?: string;
  motherId?: any;
  offspring?: any[];
  pregnancyConfirmedAt?: string;
  imageUrl?: string;
  inseminations?: any[];
  calvings?: any[];
  farmerId?: any;
  nextAction?: ReproductionNextAction | null;
  nextActionAt?: string | null;
}

export interface ServiceRequest {
  _id: string;
  animalId?: string | Animal;
  farmerId?: string | Farmer;
  status: RequestStatus;
  serviceType?: ServiceType;
  preferredDate?: string;
  scheduledDate?: string;
  visitPeriod?: "morning" | "afternoon" | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AIRequest extends ServiceRequest {
  serviceType?: "ai";
  comment?: string | null;
  sireBreed?: string | null;
  sireCode?: string | null;
  estrus?: string | null;
  heatSigns?: string[];
  imageUrl?: string | null;
  technicianNote?: string | null;
  cancellationStatus?:
    | "requested"
    | "approved"
    | "rejected"
    | "cancelled"
    | "canceled"
    | null;
  cancellationReason?: string | null;
  cancellationResponseReason?: string | null;
  inseminationDate?: string;
  entryMode?: "history_only" | "continue_tracking";
  isSuccess?: boolean | null;
  attemptNumber?: number;
  previousAttemptId?: string | AIRequest;
  attemptSeriesId?: string;
  outcome?: string;
  outcomeVerificationStatus?: "pending" | "reported" | "verified";
  outcomeConfirmationSource?: string | null;
  outcomeConfirmedAt?: string;
  farmerOutcomeReport?:
    | "possible_pregnancy"
    | "return_to_heat"
    | "unsure"
    | null;
  farmerOutcomeReportedAt?: string;
  farmerObservationSigns?: string[];
  farmerObservationNotes?: string | null;
  evidencePhotos?: string[];
  farmerPregnancyReport?: boolean;
  pregnancyReportVerificationStatus?:
    | "pending"
    | "more_info_requested"
    | "accepted"
    | "rejected"
    | null;
  pregnancyReportReviewedBy?: string | Technician | null;
  farmerPregnancyNotes?: string | null;
  farmerPregnancyPhotos?: string[];
  verificationRequested?: boolean;
  verificationStatus?: "not_requested" | "pending" | "verified" | "rejected";
  verificationTaskId?: string;
  approvedBy?: string | Technician;
  technicianId?: string | Technician;
  technicianDisplayName?: string;
  nextAction?: ReproductionNextAction | null;
  nextActionAt?: string | null;
  pregnancyFollowUpTask?: Record<string, any> | null;
}

export interface HealthRequest extends ServiceRequest {
  serviceType?: "health";
  symptoms?: string;
  imageUrl?: string | null;
  handledBy?: string | Technician;
  requestType?: string;
  urgency?: "low" | "medium" | "high" | "emergency" | "critical";
  handlingMethod?: HealthHandlingMethod;
  photos?: string[];
  farmerNotes?: string;
  requestDetails?: FarmerHealthRequestDetails;
  findings?: string;
  diagnosis?: string;
  treatment?: string;
  medicineGiven?: string;
  dosage?: string;
  followUpDate?: string;
  advice?: string;
  technicianResponse?: {
    pickup?: {
      item?: string;
      availabilityConfirmed?: boolean;
      instructions?: string;
      dosageOrUseInstructions?: string;
      withdrawalGuidance?: string;
    };
  };
    assignedTechnicianId?: string | Technician;
    technicianDisplayName?: string;
    medicalRecordId?: string | null;
  }

export interface PregnancyRecord {
  _id: string;
  animalId: string | Animal;
  inseminationDate?: string;
  expectedCalvingDate?: string;
  actualCalvingDate?: string;
  isSuccessful?: boolean;
  createdAt?: string;
}

export interface AppNotification {
  _id: string;
  title: string;
  message?: string;
  type?: string;
  isRead?: boolean;
  data?: Record<string, unknown>;
  createdAt?: string;
}

export type OfflineMutation = QueuedMutation;
