export type UserRole = "admin" | "technician" | "veterinarian" | "farmer";

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
  | "triaged"
  | "assigned"
  | "approved"
  | "scheduled"
  | "in-progress"
  | "in_progress"
  | "done"
  | "cancelled"
  | "rejected";

export type ServiceType = "ai" | "health";

export type OfflineMutationStatus = "pending" | "syncing" | "failed" | "synced";

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

export interface Veterinarian extends AppUser {
  role: "veterinarian";
  assignedBarangays?: string[];
}

export interface FarmerStats {
  totalAnimals: number;
  activePregnancies: number;
  upcomingCalvings: number;
  pendingResults: number;
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
}

export interface ServiceRequest {
  _id: string;
  animalId?: string | Animal;
  farmerId?: string | Farmer;
  status: RequestStatus;
  serviceType?: ServiceType;
  preferredDate?: string;
  scheduledDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AIRequest extends ServiceRequest {
  serviceType?: "ai";
  inseminationDate?: string;
  isSuccess?: boolean | null;
  approvedBy?: string | Technician;
  technicianId?: string | Technician;
}

export interface HealthRequest extends ServiceRequest {
  serviceType?: "health";
  symptoms?: string;
  handledBy?: string | Technician;
  requestType?: string;
  urgency?: "low" | "medium" | "high" | "emergency";
  photos?: string[];
  farmerNotes?: string;
  findings?: string;
  diagnosis?: string;
  treatment?: string;
  medicineGiven?: string;
  dosage?: string;
  followUpDate?: string;
  assignedTechnicianId?: string | Technician;
  assignedVeterinarianId?: string | Veterinarian;
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

export interface OfflineMutation {
  id: string;
  idempotencyKey: string;
  url: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  data: unknown;
  description: string;
  status: OfflineMutationStatus;
  retryCount: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}
