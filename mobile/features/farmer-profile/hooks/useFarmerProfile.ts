import { useState, useEffect, useRef } from "react";
import { useClerk, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useColorScheme } from "nativewind";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { toast } from "sonner-native";
import { useTheme } from "@/lib/theme";
import { useApi } from "@/lib/api";
import { useTranslation } from "../../../contexts/TranslationContext";
import {
  getFarmerProfile,
  sendPhoneOtp,
  updateFarmerProfile,
  verifyPhoneOtp,
} from "../services/farmerProfile.service";
import type { EditMode, ProfileFormData, PasswordForm } from "../types/farmerProfile.types";
import {
  formatBarangayWithDistrict,
  ILOILO_CITY_BARANGAYS_BY_DISTRICT,
  ILOILO_CITY_NAME,
} from "@/constants/address";

const LOCATION_CAPTURE_COOLDOWN_MS = 5 * 60 * 1000;
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
    "contact-gps" | "farm-gps" | "farm-notes" | "same-as-home" | null
  >(null);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [phoneOtpCooldown, setPhoneOtpCooldown] = useState(0);
  const [sameAsHomeClicks, setSameAsHomeClicks] = useState(0);
  const [sameAsHomeCooldownEnd, setSameAsHomeCooldownEnd] = useState<number | null>(null);
  const lastClickRef = useRef(0);

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
    if (editMode !== "phone") {
      setPhoneOtpSent(false);
      setPhoneOtpCode("");
      setPhoneOtpCooldown(0);
    }
  }, [editMode]);

  useEffect(() => {
    if (phoneOtpCooldown <= 0) return;
    const timer = setTimeout(() => {
      setPhoneOtpCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [phoneOtpCooldown]);

  const { data: dbUser, isLoading } = useQuery({
    queryKey: ["user", "me"],
    queryFn: () => getFarmerProfile(api),
  });

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
    const rawBarangay = address.barangay || "";
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

      // SPECIAL PARSER FOR Highly Urbanized Cities (Iloilo City)
      if (resolvedCity.toLowerCase() === "iloilo city" || resolvedCity.toLowerCase() === "jaro") {
        resolvedCity = ILOILO_CITY_NAME;
        const district = address.district || "Jaro";
        resolvedDistrict = district;
        const normalizeAddressPart = (value = "") =>
          value
            .toLowerCase()
            .replace(/\b(street|st|road|rd|avenue|ave|barangay|brgy)\b/g, "")
            .replace(/[^a-z0-9]/g, "");

        const candidates = [
          address.name,
          address.street,
          address.district,
        ].filter(Boolean) as string[];
        const districtBarangays =
          ILOILO_CITY_BARANGAYS_BY_DISTRICT[district] || [];
        const normalizedCandidates = candidates.map(normalizeAddressPart);

        const matchedBarangay = districtBarangays.find((barangay) => {
          const normalizedBarangay = normalizeAddressPart(barangay);
          return normalizedCandidates.some(
            (candidate) =>
              candidate &&
              normalizedBarangay &&
              (candidate.includes(normalizedBarangay) ||
                normalizedBarangay.includes(candidate)),
          );
        });

        resolvedBarangay = matchedBarangay || "";
      }

      return {
        detectedAddress,
        street: address.street || address.name || "",
        barangay: resolvedBarangay,
        city: resolvedCity,
        district: resolvedDistrict,
        province: address.region || "Iloilo",
        zipCode: address.postalCode || "5020",
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
      street: user.address?.street || "",
      barangay: normalizedAddress.barangay,
      city: user.address?.city || "",
      district: normalizedAddress.district,
      province: user.address?.province || "Iloilo",
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
    if (editMode === null && dbUser) {
      setFormData(buildProfileFormData(dbUser));
    }
  }, [editMode, dbUser]);

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
      toast.error(t("updateFailed") || "Update failed.", {
        description: getApiErrorMessage(error, "Please try again."),
      });
    },
  });

  const sendPhoneOtpMutation = useMutation({
    mutationFn: (phoneNumber: string) => sendPhoneOtp(api, phoneNumber),
    onSuccess: (result) => {
      setPhoneOtpSent(true);
      setPhoneOtpCooldown(60);
      toast.success(result?.message || "OTP sent successfully.", {
        description: result?.data?.phoneNumber
          ? `Sent to ${result.data.phoneNumber}`
          : undefined,
      });
    },
    onError: (error: any) => {
      const retryAfter = error.response?.data?.retryAfterSeconds;
      if (retryAfter) setPhoneOtpCooldown(Number(retryAfter));
      toast.error(error.response?.data?.message || "Failed to send OTP.");
    },
  });

  const verifyPhoneOtpMutation = useMutation({
    mutationFn: (payload: { phoneNumber: string; otpCode: string }) =>
      verifyPhoneOtp(api, payload.phoneNumber, payload.otpCode),
    onSuccess: (result) => {
      toast.success(result?.message || "Phone number verified.");
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      setPhoneOtpSent(false);
      setPhoneOtpCode("");
      setEditMode(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Invalid or expired OTP.");
    },
  });

  const handleResendOtp = () => {
    if (phoneOtpCooldown > 0 || sendPhoneOtpMutation.isPending) return;
    sendPhoneOtpMutation.mutate(formData.phoneNumber);
  };

  const handleChangePhoneNumber = () => {
    setPhoneOtpSent(false);
    setPhoneOtpCode("");
    setPhoneOtpCooldown(0);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
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

  const handleTakePhoto = async () => {
    setPhotoModalVisible(false);
    if (!clerkUser) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      toast.error("Permission denied", {
        description: "Camera permission is required to take a photo.",
      });
      return;
    }
    try {
      let result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]?.base64) {
        setUploadingImage(true);
        const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await clerkUser.setProfileImage({ file: base64Data });
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

  const handleChooseFromGallery = async () => {
    setPhotoModalVisible(false);
    if (!clerkUser) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      toast.error("Permission denied", {
        description: "Gallery permission is required to choose a photo.",
      });
      return;
    }
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]?.base64) {
        setUploadingImage(true);
        const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await clerkUser.setProfileImage({ file: base64Data });
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
        return toast.error(t("invalidPhoneFormat"));
      }
      if (!phoneOtpSent) {
        sendPhoneOtpMutation.mutate(formData.phoneNumber);
        return;
      }
      if (!/^\d{4,8}$/.test(phoneOtpCode.trim())) {
        return toast.error("Please enter the OTP code sent to your phone.");
      }
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
    }
  };

  const handleUseCurrentContactAddress = async () => {
    if (mutation.isPending || locationAction || !dbUser?._id) return;

    const cooldownMessage = getLocationCooldownMessage(
      dbUser.address?.locationCapturedAt,
      "Contact address location",
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
        description: "Enable location access to detect your contact address.",
      });
      return;
    }

    let locationToastId: string | number | undefined;
    try {
      setLocationAction("contact-gps");
      locationToastId = toast.info("Detecting contact address...");
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const suggestion = await getAddressSuggestion({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
      const nextBarangay = suggestion.barangay || formData.barangay || "N/A";

      if (locationToastId !== undefined) toast.dismiss(locationToastId);
      await mutation.mutateAsync({
        address: {
          street: suggestion.street || formData.street,
          barangay: nextBarangay,
          city: suggestion.city || formData.city || "",
          district: suggestion.district || formData.district || "",
          province: suggestion.province || "Iloilo",
          zipCode: suggestion.zipCode || "",
          region: "Region VI",
          detectedAddress: suggestion.detectedAddress,
          coordinates: {
            lat: current.coords.latitude,
            lng: current.coords.longitude,
          },
          locationCapture: true,
        },
      });
    } catch (err: any) {
      if (locationToastId !== undefined) toast.dismiss(locationToastId);
      const status = err?.response?.status;
      toast.error(status === 429 ? "Please wait before updating" : "Could not detect contact address", {
        description: getApiErrorMessage(
          err,
          "Please try again outdoors or enter it manually.",
        ),
      });
    } finally {
      setLocationAction(null);
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
        description: "Enable location access to save your farm pin.",
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
          sameAsContactAddress: false,
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
      toast.error("Save farm pin first", {
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
          sameAsContactAddress: existingLocation.sameAsContactAddress || false,
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

  const handleUseContactAddressForFarmLocation = async () => {
    const now = Date.now();
    if (now - lastClickRef.current < 1000) return;
    lastClickRef.current = now;

    toast.dismiss();
    if (mutation.isPending || locationAction || !dbUser?._id) return;

    if (sameAsHomeCooldownEnd) {
      const remainingMs = sameAsHomeCooldownEnd - Date.now();
      if (remainingMs > 0) {
        const remainingSec = Math.ceil(remainingMs / 1000);
        toast.error("Please wait before trying again", {
          description: `Too many attempts. Please wait ${remainingSec}s before copying address again.`,
        });
        return;
      } else {
        setSameAsHomeCooldownEnd(null);
        setSameAsHomeClicks(0);
      }
    }

    const nextClicks = sameAsHomeClicks + 1;
    if (nextClicks >= 5) {
      setSameAsHomeCooldownEnd(Date.now() + 30 * 1000); // 30 seconds cooldown
      toast.error("Too many attempts", {
        description: "Limit reached. Please wait 30s before copying address again.",
      });
      return;
    }
    setSameAsHomeClicks(nextClicks);

    const contactCoordinates = dbUser.address?.coordinates;
    if (
      typeof contactCoordinates?.lat !== "number" ||
      typeof contactCoordinates?.lng !== "number"
    ) {
      toast.error("Contact location pin missing", {
        description:
          `Use current location for your contact address before copying it. (Attempt ${nextClicks}/5)`,
      });
      return;
    }

    try {
      setLocationAction("same-as-home");
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
          latitude: contactCoordinates.lat,
          longitude: contactCoordinates.lng,
          landmark,
          directionsNote,
          detectedAddress:
            dbUser.address?.detectedAddress ||
            [
              dbUser.address?.street,
              dbUser.address?.barangay,
              dbUser.address?.city,
              dbUser.address?.province,
            ]
              .filter(Boolean)
              .join(", "),
          sameAsContactAddress: true,
          isConfirmed: true,
        },
      });
      setSameAsHomeClicks(0);
    } catch (err: any) {
      toast.error("Could not copy contact location", {
        description:
          err.message || "Please review your contact address and try again.",
      });
    } finally {
      setLocationAction(null);
    }
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
    isCopyingContactAddressToFarm: locationAction === "same-as-home",
    phoneOtpSent,
    phoneOtpCode,
    setPhoneOtpCode,
    phoneOtpCooldown,
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
    handleUseCurrentContactAddress,
    handleSaveCurrentFarmLocation,
    handleSaveFarmLocationNotes,
    handleUseContactAddressForFarmLocation,
    handleResendOtp,
    handleChangePhoneNumber,
    colors,
    isDark,
    t,
  };
};
