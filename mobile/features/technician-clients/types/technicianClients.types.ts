export interface ClientAddress {
  houseNumber?: string;
  street?: string;
  subdivision?: string;
  barangay?: string;
  district?: string;
  city?: string;
  municipality?: string;
  province?: string;
  detectedAddress?: string;
}

export interface Client {
  _id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  clerkId?: string;
  registeredByTechnician?: boolean;
  profileClaimStatus?: "none" | "unclaimed" | "claimed" | "blocked";
  profileClaimedAt?: string | Date | null;
  phoneVerification?: {
    isVerified?: boolean;
    verifiedAt?: string | Date | null;
  };
  isVerified?: boolean;
  imageUrl?: string;
  address?: string | ClientAddress;
  farmLocation?: {
    latitude?: number;
    longitude?: number;
    detectedAddress?: string;
    landmark?: string;
  } | null;
  animalsCount?: number;
  activeCount?: number;
  nextVisit?: string | Date | null;
}

export interface ClientsFetchParams {
  role: string;
  page: number;
  limit: number;
  search?: string;
  barangay?: string;
  city?: string;
  accountStatus?: string;
}

export interface ClientsResponse {
  data: Client[];
  total: number;
  totalPages: number;
}
