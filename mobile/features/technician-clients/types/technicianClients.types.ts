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
