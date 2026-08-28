import { useState, useEffect, useRef } from "react";
import { useClerk, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { pickImageFromSource } from "@/lib/imagePickerHelper";
import * as Location from "expo-location";
import { useColorScheme } from "nativewind";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { toast } from "sonner-native";
import { useTheme } from "@/lib/theme";
import { useApi } from "@/lib/api";
import { signOutWithPushCleanup } from "@/lib/notifications";
import { useTranslation } from "../../../contexts/TranslationContext";
import {
  getFarmerProfile,
  sendPhoneOtp,
  updateFarmerProfile,
  verifyPhoneOtp,
} from "../services/farmerProfile.service";
import { PHONE_OTP_CODE_LENGTH } from "../constants";
import type { EditMode, ProfileFormData, PasswordForm } from "../types/farmerProfile.types";
import {
  findIloiloCityBarangay,
  ILOILO_CITY_BARANGAYS_BY_DISTRICT,
  ILOILO_CITY_NAME,
  isAddressPlaceholder,
  normalizeContactAddress,
} from "@/constants/address";

const LOCATION_CAPTURE_COOLDOWN_MS = 5 * 60 * 1000;
const DEFAULT_PHONE_OTP_EXPIRY_MINUTES = 5;

export const useFarmerProfile = () => {
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  const [uploadingImage, setUploadingImage] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>(null);



  const [passwordForm, setPasswordForm] = useState<Required<PasswordForm>>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [locationAction, setLocationAction] = useState<
    "contact-gps" | "farm-gps" | "farm-notes" | null
  >(null);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [phoneOtpCooldown, setPhoneOtpCooldown] = useState(0);
  const [phoneOtpExpiresAt, setPhoneOtpExpiresAt] = useState<number | null>(
    null,
  );
  const [phoneOtpRemainingSeconds, setPhoneOtpRemainingSeconds] = useState(0);
  const [isChangingPhoneNumber, setIsChangingPhoneNumber] = useState(false);
  const [phoneError, setPhoneError] = useState("");


  useEffect(() => {
    if (editMode === "password") {
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }
  }, [editMode]);

  useEffect(() => {
    if (phoneOtpCooldown <= 0) return;
    const timer = setTimeout(() => {
      setPhoneOtpCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [phoneOtpCooldown]);

  useEffect(() => {
    if (!phoneOtpSent || !phoneOtpExpiresAt) {
      setPhoneOtpRemainingSeconds(0);
      return;
    }

    const updateRemainingTime = () => {
      const remainingSeconds = Math.max(
        0,
        Math.ceil((phoneOtpExpiresAt - Date.now()) / 1000),
      );
      setPhoneOtpRemainingSeconds(remainingSeconds);

      if (remainingSeconds === 0) {
        setPhoneOtpSent(false);
        setPhoneOtpCode("");
        setPhoneOtpExpiresAt(null);
        setPhoneError(
          "The verification code expired. Request a new code to continue.",
        );
      }
    };

    updateRemainingTime();
    const timer = setInterval(updateRemainingTime, 1000);
    return () => clearInterval(timer);
  }, [phoneOtpExpiresAt, phoneOtpSent]);

  const { data: dbUser, isLoading } = useQuery({
    queryKey: ["user", "me"],
    queryFn: () => getFarmerProfile(api),
  });
  const hasPhoneNumber = Boolean(dbUser?.phoneNumber);
  const hasVerifiedPhone = Boolean(
    hasPhoneNumber && dbUser?.phoneVerification?.isVerified,
  );

  const [formData, setFormData] = useState<ProfileFormData>({
    phoneNumber: "",
    street: "",
    barangay: "",
    city: "",
    district: "",
    province: "",
    farmLandmark: "",
    farmDirectionsNote: "",
  });

  const cleanFarmLocationText = (
    value: string,
    label: string,
    maxLength: number,
  ) => {
    const text = value.replace(/\s+/g, " ").trim();
    if (!text) return "";
    if (text.length > maxLength) {
      throw new Error(`${label} must be ${maxLength} characters or less.`);
    }
    if (/https?:\/\/|www\./i.test(text)) {
      throw new Error(`${label} cannot contain links.`);
    }

    const compact = text.replace(/[\s.,!?'"-]/g, "");
    const uniqueCharacters = new Set(compact.toLowerCase()).size;
    const hasLetter = /[a-zA-Z]/.test(text);
    if (
      compact.length >= 4 &&
      (!hasLetter ||
        uniqueCharacters <= 2 ||
        /^(test|asdf|qwer|none|n\/a)$/i.test(compact))
    ) {
      throw new Error(`Please enter a clear ${label.toLowerCase()}.`);
    }

    return text;
  };

  const getLocationCooldownMessage = (
    capturedAt?: string | Date | null,
    label = "Location",
  ) => {
    if (!capturedAt) return null;
    const elapsedMs = Date.now() - new Date(capturedAt).getTime();
    if (elapsedMs >= LOCATION_CAPTURE_COOLDOWN_MS) return null;
    const remainingMs = LOCATION_CAPTURE_COOLDOWN_MS - elapsedMs;
    const remainingMin = Math.floor(remainingMs / 60000);
    const remainingSec = Math.ceil((remainingMs % 60000) / 1000);
    const timeString = remainingMin > 0
      ? `${remainingMin}m ${remainingSec}s`
      : `${remainingSec}s`;
    return `${label} was just updated. Please wait ${timeString} before updating again.`;
  };

  const getApiErrorMessage = (error: any, fallback: string) =>
    error?.response?.data?.message || error?.message || fallback;

  const normalizeIloiloCityAddressForForm = (address: any = {}) => {
    const city = address.city || "";
    const rawBarangay = isAddressPlaceholder(address.barangay)
      ? ""
      : address.barangay || "";
    let district = address.district || "";
    let barangay = rawBarangay;

    if (city !== ILOILO_CITY_NAME) {
      return { barangay, district };
    }

    const suffixMatch = rawBarangay.match(/^(.+?)\s*\((.+?)\)$/);
    if (suffixMatch) {
      barangay = suffixMatch[1].trim();
      district = district || suffixMatch[2].trim();
    }

    const knownDistricts = Object.keys(ILOILO_CITY_BARANGAYS_BY_DISTRICT);
    if (knownDistricts.includes(rawBarangay)) {
      district = rawBarangay;
      barangay = "";
    }

    if (district && barangay && !ILOILO_CITY_BARANGAYS_BY_DISTRICT[district]?.includes(barangay)) {
      const normalizeAddressPart = (value = "") =>
        value
          .toLowerCase()
          .replace(/\b(street|st|road|rd|avenue|ave|barangay|brgy)\b/g, "")
          .replace(/[^a-z0-9]/g, "");
      const normalizedBarangay = normalizeAddressPart(barangay);
      const matchedBarangay = ILOILO_CITY_BARANGAYS_BY_DISTRICT[district]?.find(
        (option) => {
          const normalizedOption = normalizeAddressPart(option);
          return (
            normalizedBarangay &&
            normalizedOption &&
            (normalizedBarangay.includes(normalizedOption) ||
              normalizedOption.includes(normalizedBarangay))
          );
        },
      );
      barangay = matchedBarangay || "";
    }

    return { barangay, district };
  };

  const getAddressSuggestion = async (coords: {
    latitude: number;
    longitude: number;
  }) => {
    try {
      const [address] = await Location.reverseGeocodeAsync(coords);
      if (!address) {
        return {
          detectedAddress: "",
          street: "",
          barangay: "",
          city: "",
          province: "",
        };
      }
      const detectedAddress = [
        address.name,
        address.street,
        address.district,
        address.city,
        address.subregion,
        address.region,
      ]
        .filter(Boolean)
        .filter((part, index, list) => list.indexOf(part) === index)
        .join(", ");

      let resolvedCity = address.city || address.subregion || "";
      let resolvedBarangay = "";
      let resolvedDistrict = "";

      // Iloilo City reverse-geocoding can return either the city or a district
      // (for example, Jaro) in the city field. Match against all 180 barangays
      // first, then derive the district from the matched barangay.
      const normalizedLocalities = [address.city, address.subregion]
        .filter((locality): locality is string => Boolean(locality?.trim()))
        .map((locality) => locality.trim().toLowerCase());
      const isIloiloCity =
        normalizedLocalities.includes("iloilo city") ||
        normalizedLocalities.some((locality) =>
          Object.keys(ILOILO_CITY_BARANGAYS_BY_DISTRICT).some(
            (district) => district.toLowerCase() === locality,
          ),
        );
      if (isIloiloCity) {
        resolvedCity = ILOILO_CITY_NAME;
        const match = findIloiloCityBarangay(
          [address.name, address.street, address.district, address.subregion],
          address.district || address.city || "",
        );
        resolvedBarangay = match?.barangay || "";
        resolvedDistrict = match?.district || "";
      }

      return {
        detectedAddress,
        street: address.street || address.name || "",
        barangay: resolvedBarangay,
        city: resolvedCity,
        district: resolvedDistrict,
        province: isIloiloCity ? "Iloilo" : address.region || "Iloilo",
        zipCode: address.postalCode || "",
      };
    } catch {
      return {
        detectedAddress: "",
        street: "",
        barangay: "",
        city: "",
        province: "",
      };
    }
  };

  const buildProfileFormData = (user: any): ProfileFormData => {
    if (!user) {
      return {
        phoneNumber: "",
        street: "",
        barangay: "",
        city: "",
        district: "",
        province: "",
        farmLandmark: "",
        farmDirectionsNote: "",
      };
    }

    const normalizedAddress = normalizeIloiloCityAddressForForm(user.address);
    return {
      phoneNumber: user.phoneNumber || "",
      houseNumber: user.address?.houseNumber || "",
      purokSitio: user.address?.purokSitio || "",
      street: user.address?.street || "",
      subdivision: user.address?.subdivision || "",
      barangay: normalizedAddress.barangay,
      city: user.address?.city || "",
      district: normalizedAddress.district,
      province: user.address?.province || "Iloilo",
      zipCode: user.address?.zipCode || "",
      farmLandmark: user.farmLocation?.landmark || "",
      farmDirectionsNote: user.farmLocation?.directionsNote || "",
    };
  };

  useEffect(() => {
    if (dbUser) {
      setFormData(buildProfileFormData(dbUser));
    }
  }, [dbUser]);

  useEffect(() => {
    if (editMode === null && dbUser && !phoneOtpSent) {
      setFormData(buildProfileFormData(dbUser));
    }
  }, [editMode, dbUser, phoneOtpSent]);

  const mutation = useMutation({
    mutationFn: (updatedData: any) => {
      if (!dbUser?._id) throw new Error("No user ID");
      return updateFarmerProfile(api, dbUser._id, updatedData);
    },
    onSuccess: () => {
      toast.dismiss();
      toast.success(t("profileUpdated") || "Profile Updated!");
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      setEditMode(null);
    },
    onError: (error: any) => {
      toast.dismiss();
      const code = error?.response?.data?.code;
      const message = error?.response?.data?.message;

      if (code === "BARANGAY_REQUIRED") {
        toast.error("Please select your barangay before saving.", {
          description: message || "Barangay is required to update your contact address.",
        });
        return;
      }

      toast.error(t("updateFailed") || "Update failed.", {
        description: getApiErrorMessage(error, "Please try again."),
      });
    },
  });

  const sendPhoneOtpMutation = useMutation({
    mutationFn: (phoneNumber: string) => sendPhoneOtp(api, phoneNumber),
    onSuccess: (result) => {
      setPhoneError("");
      const expiresInMinutes = Number(
        result?.data?.expiresInMinutes || DEFAULT_PHONE_OTP_EXPIRY_MINUTES,
      );
      const expiryDurationMs =
        Math.max(1, expiresInMinutes) * 60 * 1000;

      setPhoneOtpSent(true);
      setPhoneOtpCooldown(60);
      setPhoneOtpExpiresAt(Date.now() + expiryDurationMs);
      setPhoneOtpRemainingSeconds(Math.ceil(expiryDurationMs / 1000));
    },
    onError: (error: any) => {
      const retryAfter = error.response?.data?.retryAfterSeconds;
      if (retryAfter) setPhoneOtpCooldown(Number(retryAfter));
      setPhoneError(
        error.response?.data?.message ||
          "The verification code could not be sent. Please try again.",
      );
    },
  });

  const verifyPhoneOtpMutation = useMutation({
    mutationFn: (payload: { phoneNumber: string; otpCode: string }) =>
      verifyPhoneOtp(api, payload.phoneNumber, payload.otpCode),
    onSuccess: (result) => {
      setPhoneError("");
      toast.success(result?.message || "Phone number verified.");
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      setPhoneOtpSent(false);
      setPhoneOtpCode("");
      setPhoneOtpExpiresAt(null);
      setPhoneOtpRemainingSeconds(0);
      setIsChangingPhoneNumber(false);
      setEditMode(null);
    },
    onError: (error: any) => {
      setPhoneError(
        error.response?.data?.message ||
          "The verification code is invalid or has expired.",
      );
    },
  });

  const handleResendOtp = () => {
    if (phoneOtpCooldown > 0 || sendPhoneOtpMutation.isPending) return;
    setPhoneError("");
    sendPhoneOtpMutation.mutate(formData.phoneNumber);
  };

  const handleChangePhoneNumber = () => {
    setPhoneError("");
    setPhoneOtpSent(false);
    setPhoneOtpCode("");
    setPhoneOtpCooldown(0);
    setPhoneOtpExpiresAt(null);
    setPhoneOtpRemainingSeconds(0);
  };

  const handleStartPhoneNumberChange = () => {
    setPhoneError("");
    setPhoneOtpSent(false);
    setPhoneOtpCode("");
    setPhoneOtpCooldown(0);
    setPhoneOtpExpiresAt(null);
    setPhoneOtpRemainingSeconds(0);
    setIsChangingPhoneNumber(true);
    setFormData((current) => ({ ...current, phoneNumber: "" }));
  };

  const handleOpenPhoneEditor = () => {
    if (!phoneOtpSent) {
      setPhoneError("");
      setIsChangingPhoneNumber(false);
      setFormData((current) => ({
        ...current,
        phoneNumber: dbUser?.phoneNumber || "",
      }));
    }
    setEditMode("phone");
  };

  const handleCloseProfileEditor = () => {
    setEditMode(null);
    setPhoneError("");
    if (!phoneOtpSent) {
      setIsChangingPhoneNumber(false);
      setFormData((current) => ({
        ...current,
        phoneNumber: dbUser?.phoneNumber || "",
      }));
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutWithPushCleanup(api, signOut);
      router.replace("/(auth)");
    } catch (e) {}
  };

  const handleToggleTheme = async () => {
    const newScheme = colorScheme === "dark" ? "light" : "dark";
    toggleColorScheme();
    try {
      await AsyncStorage.setItem("theme_preference", newScheme);
    } catch (e) {}
  };

  const handleSelectProfileImage = async (source: "camera" | "library") => {
    setPhotoModalVisible(false);
    if (!clerkUser) return;
    try {
      const result = await pickImageFromSource(source, { aspect: [1, 1], quality: 0.7 });
      if (result) {
        setUploadingImage(true);
        await clerkUser.setProfileImage({ file: result.base64 });
        toast.success("Profile picture updated!");
      }
    } catch (err: any) {
      toast.error("Upload failed", {
        description: err.message || "Failed to update profile image.",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleTakePhoto = () => handleSelectProfileImage("camera");
  const handleChooseFromGallery = () => handleSelectProfileImage("library");

  const handleChangeProfileImage = () => {
    if (!clerkUser) return;
    setPhotoModalVisible(true);
  };

  const handleUpdate = async () => {
    if (
      mutation.isPending ||
      passwordUpdating ||
      sendPhoneOtpMutation.isPending ||
      verifyPhoneOtpMutation.isPending
    ) return;

    toast.dismiss();

    if (editMode === "phone") {
      if (!/^09\d{9}$/.test(formData.phoneNumber)) {
        setPhoneError(t("invalidPhoneFormat"));
        return;
      }
      if (!phoneOtpSent) {
        setPhoneError("");
        sendPhoneOtpMutation.mutate(formData.phoneNumber);
        return;
      }
      if (
        !new RegExp(`^\\d{${PHONE_OTP_CODE_LENGTH}}$`).test(
          phoneOtpCode.trim(),
        )
      ) {
        setPhoneError(
          `Enter the ${PHONE_OTP_CODE_LENGTH}-digit verification code sent to your phone.`,
        );
        return;
      }
      setPhoneError("");
      verifyPhoneOtpMutation.mutate({
        phoneNumber: formData.phoneNumber,
        otpCode: phoneOtpCode.trim(),
      });

    } else if (editMode === "password") {
      const { currentPassword, newPassword, confirmPassword } = passwordForm;
      if (!currentPassword || !newPassword || !confirmPassword) {
        return toast.error(t("passwordRequiredError"));
      }
      if (newPassword.length < 8) {
        return toast.error(t("passwordLengthError"));
      }
      if (newPassword !== confirmPassword) {
        return toast.error(t("passwordMismatchError"));
      }

      setPasswordUpdating(true);
      try {
        await clerkUser?.updatePassword({
          newPassword: newPassword,
          currentPassword: currentPassword,
        });
        toast.success(t("passwordUpdated"));
        setEditMode(null);
      } catch (err: any) {
        console.warn("Password update failed:", err.message || err);
        const errMsg =
          err.errors?.[0]?.message ||
          err.message ||
          "Failed to update password.";
        toast.error(t("updateFailed"), { description: errMsg });
      } finally {
        setPasswordUpdating(false);
      }
    } else if (editMode === "address") {
      if (!formData.barangay || isAddressPlaceholder(formData.barangay)) {
        return toast.error("Please select your barangay before saving.");
      }
      try {
        await mutation.mutateAsync({
          address: {
            houseNumber: formData.houseNumber || "",
            purokSitio: formData.purokSitio || "",
            street: formData.street || "",
            subdivision: formData.subdivision || "",
            barangay: formData.barangay,
            city: formData.city || "",
            district: formData.district || "",
            province: formData.province || "Iloilo",
            zipCode: formData.zipCode || "",
            region: "Region VI",
          },
        });
      } catch (err) {
        // Error toast handled by mutation.onError
      }
    }
  };


  const handleSaveCurrentFarmLocation = async () => {
    if (mutation.isPending || locationAction || !dbUser?._id) return;

    const cooldownMessage = getLocationCooldownMessage(
      dbUser.farmLocation?.capturedAt,
      "Farm location",
    );
    if (cooldownMessage) {
      toast.dismiss();
      toast.error("Please wait before updating", {
        description: cooldownMessage,
      });
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      toast.error("Location permission denied", {
        description: "Enable location access to save your farm location.",
      });
      return;
    }

    let locationToastId: string | number | undefined;
    try {
      setLocationAction("farm-gps");
      locationToastId = toast.info("Getting current location...");
      const landmark = cleanFarmLocationText(
        formData.farmLandmark,
        "Farm landmark",
        80,
      );
      const directionsNote = cleanFarmLocationText(
        formData.farmDirectionsNote,
        "Directions note",
        250,
      );
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const suggestion = await getAddressSuggestion({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });

      if (locationToastId !== undefined) toast.dismiss(locationToastId);
      await mutation.mutateAsync({
        farmLocation: {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          accuracy: current.coords.accuracy,
          landmark,
          directionsNote,
          detectedAddress: suggestion.detectedAddress,
          isConfirmed: true,
          locationCapture: true,
        },
      });
    } catch (err: any) {
      if (locationToastId !== undefined) toast.dismiss(locationToastId);
      const status = err?.response?.status;
      toast.error(status === 429 ? "Please wait before updating" : "Could not get current location", {
        description: getApiErrorMessage(
          err,
          "Please try again while you are at the farm.",
        ),
      });
    } finally {
      setLocationAction(null);
    }
  };

  const handleSaveFarmLocationNotes = async () => {
    toast.dismiss();
    if (mutation.isPending || locationAction || !dbUser?._id) return;
    const existingLocation = dbUser.farmLocation;
    if (!existingLocation?.latitude || !existingLocation?.longitude) {
      toast.error("Save farm location first", {
        description: "Use current location before saving landmark or directions.",
      });
      return;
    }

    try {
      setLocationAction("farm-notes");
      const landmark = cleanFarmLocationText(
        formData.farmLandmark,
        "Farm landmark",
        80,
      );
      const directionsNote = cleanFarmLocationText(
        formData.farmDirectionsNote,
        "Directions note",
        250,
      );

      await mutation.mutateAsync({
        farmLocation: {
          latitude: existingLocation.latitude,
          longitude: existingLocation.longitude,
          accuracy: existingLocation.accuracy,
          landmark,
          directionsNote,
          detectedAddress: existingLocation.detectedAddress || "",
          isConfirmed: true,
        },
      });
    } catch (err: any) {
      toast.error("Could not save farm location notes", {
        description: err.message || "Please review the landmark and directions.",
      });
    } finally {
      setLocationAction(null);
    }
  };



  const handleOpenAddressEditor = () => {
    setEditMode("address");
  };

  return {
    clerkUser,
    dbUser,
    isLoading,
    uploadingImage,
    photoModalVisible,
    setPhotoModalVisible,
    editMode,
    setEditMode,
    passwordForm,
    setPasswordForm,
    passwordUpdating,
    isSavingFarmLocation: Boolean(locationAction),
    isSavingContactAddressLocation: locationAction === "contact-gps",
    isSavingFarmGpsPin: locationAction === "farm-gps",
    isSavingFarmLocationNotes: locationAction === "farm-notes",
    phoneOtpSent,
    phoneOtpCode,
    setPhoneOtpCode,
    phoneOtpCooldown,
    phoneOtpRemainingSeconds,
    phoneError,
    setPhoneError,
    hasPhoneNumber,
    hasVerifiedPhone,
    isChangingPhoneNumber,
    isPhoneOtpSending: sendPhoneOtpMutation.isPending,
    isPhoneOtpVerifying: verifyPhoneOtpMutation.isPending,
    formData,
    setFormData,
    mutation,
    handleSignOut,
    handleToggleTheme,
    handleTakePhoto,
    handleChooseFromGallery,
    handleChangeProfileImage,
    handleUpdate,
    handleSaveCurrentFarmLocation,
    handleSaveFarmLocationNotes,
    handleResendOtp,
    handleChangePhoneNumber,
    handleStartPhoneNumberChange,
    handleOpenPhoneEditor,
    handleOpenAddressEditor,
    handleCloseProfileEditor,
    colors,
    isDark,
    t,
  };
};
