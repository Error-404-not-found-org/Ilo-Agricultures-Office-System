import type { Farmer } from "@/types";

export interface FarmerProfileData extends Farmer {}

export type EditMode = "phone" | "password" | "address" | null;

export interface ProfileFormData {
  phoneNumber: string;
  houseNumber?: string;
  purokSitio?: string;
  street: string;
  subdivision?: string;
  barangay: string;
  city: string;
  district: string;
  province: string;
  zipCode?: string;
  farmLandmark: string;
  farmDirectionsNote: string;
}

export interface PasswordForm {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export interface SelectModalState {
  visible: boolean;
  title: string;
  options: string[];
  onSelect: (val: string) => void;
}
