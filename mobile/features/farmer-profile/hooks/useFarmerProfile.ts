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
import { getFarmerProfile, updateFarmerProfile } from "../services/farmerProfile.service";
import { OTON_BARANGAYS } from "@/lib/constants";
import type { EditMode, ProfileFormData, PasswordForm, SelectModalState } from "../types/farmerProfile.types";

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

  const [selectModal, setSelectModal] = useState<SelectModalState>({
    visible: false,
    title: "",
    options: [],
    onSelect: () => {},
  });

  const [passwordForm, setPasswordForm] = useState<Required<PasswordForm>>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [isSavingFarmLocation, setIsSavingFarmLocation] = useState(false);
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

  const { data: dbUser, isLoading } = useQuery({
    queryKey: ["user", "me"],
    queryFn: () => getFarmerProfile(api),
  });

  const [formData, setFormData] = useState<ProfileFormData>({
    phoneNumber: "",
    street: "",
    barangay: "",
    city: "",
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

      return {
        detectedAddress,
        street: address.street || address.name || "",
        barangay: address.district || "",
        city: address.city || "Oton",
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

  useEffect(() => {
    if (dbUser) {
      setFormData({
        phoneNumber: dbUser.phoneNumber || "",
        street: dbUser.address?.street || "",
        barangay: dbUser.address?.barangay || "",
        city: dbUser.address?.city || "Oton",
        province: dbUser.address?.province || "Iloilo",
        farmLandmark: dbUser.farmLocation?.landmark || "",
        farmDirectionsNote: dbUser.farmLocation?.directionsNote || "",
      });
    }
  }, [dbUser]);

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
    onError: () => toast.error(t("updateFailed") || "Update failed."),
  });

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
    if (mutation.isPending || passwordUpdating) return;

    toast.dismiss();

    if (editMode === "phone") {
      if (!/^09\d{9}$/.test(formData.phoneNumber)) {
        return toast.error(t("invalidPhoneFormat"));
      }
      mutation.mutate({
        phoneNumber: formData.phoneNumber,
      });
    } else if (editMode === "address") {
      if (!formData.barangay) {
        return toast.error(t("requiredBarangay"));
      }
      mutation.mutate({
        address: {
          street: formData.street,
          barangay: formData.barangay,
          city: "Oton",
          province: "Iloilo",
          zipCode: "5020",
          region: "Region VI",
        },
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
    if (mutation.isPending || isSavingFarmLocation || !dbUser?._id) return;

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
      setIsSavingFarmLocation(true);
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
          city: suggestion.city || "Oton",
          province: suggestion.province || "Iloilo",
          zipCode: suggestion.zipCode || "5020",
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
      toast.error("Could not detect contact address", {
        description:
          err.message || "Please try again outdoors or enter it manually.",
      });
    } finally {
      setIsSavingFarmLocation(false);
    }
  };

  const handleSaveCurrentFarmLocation = async () => {
    if (mutation.isPending || isSavingFarmLocation || !dbUser?._id) return;

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
      setIsSavingFarmLocation(true);
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
      toast.error("Could not get current location", {
        description: err.message || "Please try again while you are at the farm.",
      });
    } finally {
      setIsSavingFarmLocation(false);
    }
  };

  const handleSaveFarmLocationNotes = async () => {
    toast.dismiss();
    if (mutation.isPending || isSavingFarmLocation || !dbUser?._id) return;
    const existingLocation = dbUser.farmLocation;
    if (!existingLocation?.latitude || !existingLocation?.longitude) {
      toast.error("Save farm pin first", {
        description: "Use current location before saving landmark or directions.",
      });
      return;
    }

    try {
      setIsSavingFarmLocation(true);
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
      setIsSavingFarmLocation(false);
    }
  };

  const handleUseContactAddressForFarmLocation = async () => {
    const now = Date.now();
    if (now - lastClickRef.current < 1000) return;
    lastClickRef.current = now;

    toast.dismiss();
    if (mutation.isPending || isSavingFarmLocation || !dbUser?._id) return;

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
      setIsSavingFarmLocation(true);
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
      setIsSavingFarmLocation(false);
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
    selectModal,
    setSelectModal,
    passwordForm,
    setPasswordForm,
    passwordUpdating,
    isSavingFarmLocation,
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
    colors,
    isDark,
    t,
  };
};
