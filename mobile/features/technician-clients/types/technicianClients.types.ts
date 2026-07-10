export interface ClientAddress {
  barangay?: string;
  municipality?: string;
  province?: string;
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
}

export interface ClientsResponse {
  data: Client[];
  total: number;
  totalPages: number;
}
