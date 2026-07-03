import type { Farmer } from "@/types";

export interface FarmerProfileData extends Farmer {}

export type EditMode = "phone" | "address" | "password" | null;

export interface ProfileFormData {
  phoneNumber: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
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
