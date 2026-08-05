import React from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { AlertTriangle, MapPin, Navigation, Save } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

interface FarmLocationCardProps {
  dbUser: any;
  formData: {
    farmLandmark: string;
    farmDirectionsNote: string;
  };
  setFormData: (data: any) => void;
  isBusy: boolean;
  isSavingCurrentLocation: boolean;
  isSavingNotes: boolean;
  onUseCurrentLocation: () => void;
  onSaveNotes: () => void;
}

const FarmLocationCard = ({
  dbUser,
  formData,
  setFormData,
  isBusy,
  isSavingCurrentLocation,
  isSavingNotes,
  onUseCurrentLocation,
  onSaveNotes,
}: FarmLocationCardProps) => {
  const { colors, isDark } = useTheme();
  const location = dbUser?.farmLocation;
  const hasPin = Boolean(location?.latitude && location?.longitude);
  const accuracy =
    typeof location?.accuracy === "number"
      ? `${Math.round(location.accuracy)}m accuracy`
      : "Accuracy not available";
  const capturedAt = location?.capturedAt
    ? new Date(location.capturedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const detectedAddress = location?.detectedAddress;

  return (
    <View className="px-6 mt-2 gap-4">
      <View>
        <Text
          className="font-outfit-black text-[10px] uppercase tracking-widest mb-3 ml-1"
          style={{ color: colors.textMuted }}
        >
          Farm Location Pin
        </Text>

        <View
          className="rounded-3xl border p-5"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          <View className="flex-row items-start">
            <View
              className="w-11 h-11 rounded-2xl items-center justify-center mr-3"
              style={{
                backgroundColor: hasPin
                  ? (isDark ? "rgba(16,185,129,0.12)" : "#ecfdf5")
                  : (isDark ? "rgba(245,158,11,0.12)" : "#fffbeb"),
              }}
            >
              <MapPin size={21} color={hasPin ? colors.primary : "#d97706"} />
            </View>

            <View className="flex-1">
              <Text
                className="font-outfit-black text-base"
                style={{ color: colors.textPrimary }}
              >
                {hasPin
                  ? "Exact farm location saved"
                  : "Exact farm location not set"}
              </Text>
              <Text
                className="font-outfit-medium text-xs leading-5 mt-1"
                style={{ color: colors.textSecondary }}
              >
                {hasPin
                  ? `${accuracy}${capturedAt ? ` · Updated ${capturedAt}` : ""}`
                  : "Save your location while you are at the farm so technicians can navigate faster."}
              </Text>
              {hasPin && detectedAddress ? (
                <Text
                  className="font-outfit-medium text-xs leading-5 mt-1"
                  style={{ color: colors.textMuted }}
                >
                  Detected near {detectedAddress}
                </Text>
              ) : null}
            </View>
          </View>

          {!hasPin ? (
            <View
              className="rounded-2xl px-3 py-3 mt-4 flex-row items-start"
              style={{
                backgroundColor: isDark ? "rgba(245,158,11,0.08)" : "#fffbeb",
              }}
            >
              <AlertTriangle size={16} color="#d97706" />
              <Text
                className="flex-1 ml-2 font-outfit-semibold text-xs leading-5"
                style={{ color: isDark ? "#fbbf24" : "#92400e" }}
              >
                Technicians will only see your barangay until an exact farm location is saved.
              </Text>
            </View>
          ) : null}

          <View className="mt-5">
            <TouchableOpacity
              onPress={onUseCurrentLocation}
              disabled={isBusy}
              className="rounded-2xl py-3 flex-row items-center justify-center"
              style={{
                backgroundColor: isSavingCurrentLocation
                  ? colors.textMuted
                  : colors.primary,
                opacity: isBusy && !isSavingCurrentLocation ? 0.6 : 1,
              }}
            >
              {isSavingCurrentLocation ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Navigation size={14} color="#fff" />
                  <Text className="text-white font-outfit-bold ml-1.5 text-xs">
                    {hasPin ? "Update GPS Pin" : "Save GPS Pin"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Card 2: Directions & Landmarks */}
      <View>
        <Text
          className="font-outfit-black text-[10px] uppercase tracking-widest mb-3 ml-1"
          style={{ color: colors.textMuted }}
        >
          Directions & Landmarks
        </Text>

        <View
          className="rounded-3xl border p-5"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          {/* Landmark Input */}
          <View className="mb-4">
            <Text
              className="font-outfit-black text-[10px] uppercase tracking-widest mb-1.5 ml-1"
              style={{ color: colors.textMuted }}
            >
              Landmark
            </Text>
            <TextInput
              value={formData.farmLandmark}
              onChangeText={(text) => setFormData({ ...formData, farmLandmark: text })}
              placeholder="Chapel, school, barangay hall, court..."
              placeholderTextColor={colors.textMuted}
              maxLength={80}
              className="border rounded-2xl px-4 py-3 font-outfit-medium text-sm"
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.textPrimary,
              }}
            />
            <Text
              className="font-outfit-medium text-[9px] mt-1.5 ml-1"
              style={{ color: colors.textMuted }}
            >
              Max 80 characters.
            </Text>
          </View>

          {/* Directions Note Input */}
          <View className="mb-4">
            <Text
              className="font-outfit-black text-[10px] uppercase tracking-widest mb-1.5 ml-1"
              style={{ color: colors.textMuted }}
            >
              Directions Note
            </Text>
            <TextInput
              value={formData.farmDirectionsNote}
              onChangeText={(text) => setFormData({ ...formData, farmDirectionsNote: text })}
              placeholder="e.g. Blue gate, second house past the chapel..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              maxLength={250}
              className="border rounded-2xl px-4 py-3 h-20 font-outfit-medium text-sm"
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.textPrimary,
              }}
            />
            <Text
              className="font-outfit-medium text-[9px] mt-1.5 ml-1"
              style={{ color: colors.textMuted }}
            >
              Max 250 characters.
            </Text>
          </View>

          {/* Save Landmark & Directions Button */}
          <TouchableOpacity
            onPress={onSaveNotes}
            disabled={isBusy || !hasPin}
            className="rounded-2xl py-3.5 flex-row items-center justify-center border"
            style={{
              backgroundColor: hasPin && !isSavingNotes ? (isDark ? "rgba(16,185,129,0.08)" : "#f0fdf4") : "transparent",
              borderColor: hasPin && !isSavingNotes ? colors.primary : colors.border,
              opacity: !hasPin || (isBusy && !isSavingNotes) ? 0.5 : 1,
            }}
          >
            {isSavingNotes ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Save size={16} color={hasPin ? colors.primary : colors.textMuted} />
                <Text
                  className="font-outfit-bold ml-2 text-sm"
                  style={{ color: hasPin ? colors.primary : colors.textMuted }}
                >
                  Save Landmark & Directions
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default FarmLocationCard;
