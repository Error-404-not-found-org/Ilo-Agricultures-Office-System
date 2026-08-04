import * as ImagePicker from "expo-image-picker";
import { toast } from "sonner-native";

export type PickImageSource = "camera" | "library";

export type PickedImageResult = {
  uri: string;
  base64: string;
  mimeType: string;
  fileName?: string;
  fileSize?: number;
};

export type PickImageOptions = {
  aspect?: [number, number];
  quality?: number;
  allowsEditing?: boolean;
};

/**
 * Detects the MIME type of a selected image asset based on its asset metadata or file extension.
 */
function getAssetMimeType(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType && asset.mimeType.startsWith("image/")) {
    return asset.mimeType;
  }

  const uriLower = (asset.uri || "").toLowerCase();
  if (uriLower.endsWith(".png")) return "image/png";
  if (uriLower.endsWith(".heic") || uriLower.endsWith(".heif")) return "image/heic";
  if (uriLower.endsWith(".webp")) return "image/webp";
  if (uriLower.endsWith(".gif")) return "image/gif";
  
  return "image/jpeg";
}

/**
 * Safely requests permissions and picks an image from either the camera or media library.
 * Fully handles permission states, exceptions, base64 formatting, and memory compression.
 */
export async function pickImageFromSource(
  source: PickImageSource,
  options: PickImageOptions = {}
): Promise<PickedImageResult | null> {
  const {
    aspect = [1, 1],
    quality = 0.5,
    allowsEditing = true,
  } = options;

  try {
    // 1. Permission Handling
    if (source === "camera") {
      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        if (!canAskAgain) {
          toast.error("Camera access is disabled. Please enable it in device Settings.");
        } else {
          toast.error("Camera permission is required to take photos.");
        }
        return null;
      }
    } else {
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        if (!canAskAgain) {
          toast.error("Photo library access is disabled. Please enable it in device Settings.");
        } else {
          toast.error("Photo library permission is required to choose photos.");
        }
        return null;
      }
    }

    // 2. Launch Image Picker
    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing,
      aspect,
      quality,
      base64: true,
    };

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];

    if (!asset.uri) {
      toast.error("Failed to acquire image path.");
      return null;
    }

    // 3. MIME-Type and Base64 Construction
    const mimeType = getAssetMimeType(asset);

    let base64Formatted = "";
    if (asset.base64) {
      // Clean up any existing data URI prefix if present
      const cleanBase64 = asset.base64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
      base64Formatted = `data:${mimeType};base64,${cleanBase64}`;
    } else {
      // Fallback URI if base64 is unavailable
      base64Formatted = asset.uri;
    }

    return {
      uri: asset.uri,
      base64: base64Formatted,
      mimeType,
      fileName: asset.fileName || undefined,
      fileSize: asset.fileSize || undefined,
    };
  } catch (error: any) {
    console.error(`[imagePickerHelper] Error picking image from ${source}:`, error);
    toast.error("An error occurred while opening the image picker.");
    return null;
  }
}
