export interface UserItem {
  _id: string;
  name?: string;
  email?: string;
  role: 'farmer' | 'technician' | 'admin' | 'veterinarian';
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
    province?: string;
  };
}
