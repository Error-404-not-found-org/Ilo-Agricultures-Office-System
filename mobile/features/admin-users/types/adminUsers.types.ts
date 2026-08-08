export interface UserItem {
  _id: string;
  name?: string;
  email?: string;
  role: 'farmer' | 'technician' | 'admin';
  clerkId?: string;
  isVerified?: boolean;
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
}
