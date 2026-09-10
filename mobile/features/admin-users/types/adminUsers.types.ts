export type OperationalUserRole = 'farmer' | 'technician';

export interface UserItem {
  _id: string;
  name?: string;
  email?: string;
  role: string;
  clerkId?: string;
  isVerified?: boolean;
  profileClaimStatus?: "none" | "unclaimed" | "claimed" | "blocked";
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  lastLogin?: string;
  phoneNumber?: string;
  imageUrl?: string;
  address?: {
    houseNumber?: string;
    street?: string;
    barangay?: string;
    city?: string;
    district?: string;
    province?: string;
  };
  deletedAt?: string;
  assignedAnimals?: any[];
  serviceHistory?: any[];
  loginHistory?: any[];
  activityHistory?: any[];
  dispatchProfile?: {
    serviceMunicipalities?: {
      municipalityCode: string;
      municipalityName: string;
      localityType: string;
      provinceCode: string;
      provinceName: string;
    }[];
    serviceCapabilities?: string[];
    availabilityStatus?: string;
    acceptsNewRequests?: boolean;
  };
  dispatchReadiness?: {
    eligible: boolean;
    blockingReasons: string[];
    informationalReasons?: string[];
  };
}
