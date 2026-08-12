import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  View,
  type DimensionValue,
  type ImageResizeMode,
  StyleSheet,
} from "react-native";
import { ImageOff, RefreshCw } from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";

interface RecordPhotoEvidenceProps {
  url: string;
  label: string;
  height?: number;
  width?: DimensionValue;
  compact?: boolean;
  resizeMode?: ImageResizeMode;
  onPress: () => void;
}

export function RecordPhotoEvidence({
  url,
  label,
  height = 180,
  width = "100%",
  compact = false,
  resizeMode = "cover",
  onPress,
}: RecordPhotoEvidenceProps) {
  const { isDark } = useTheme();
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = useState(0);

  // Design system mapped colors
  const primaryColor = isDark ? "#10B981" : "#00643B";
  const surfaceBg = isDark ? "#111827" : "#FFFFFF";
  const surfaceSubtle = isDark ? "#1F2937" : "#F3F4F6";
  const borderColor = isDark ? "#374151" : "#E5E7EB";
  const modalBackdrop = isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";
  const textMuted = isDark ? "#6B7280" : "#9CA3AF";

  const retry = () => {
    setLoadState("loading");
    setReloadKey((value) => value + 1);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${label}`}
        accessibilityState={{ disabled: loadState !== "loaded" }}
        disabled={loadState !== "loaded"}
        onPress={onPress}
        style={({ pressed }) => ({
          width,
          height,
          flexShrink: 0,
          overflow: "hidden",
          borderRadius: 12,
          backgroundColor: surfaceSubtle,
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <Image
          key={`${url}-${reloadKey}`}
          source={{ uri: url }}
          resizeMode={resizeMode}
          accessibilityLabel={label}
          onLoadStart={() => setLoadState("loading")}
          onLoad={() => setLoadState("loaded")}
          onError={() => setLoadState("error")}
          style={[styles.imageFull, { height }]}
        />

        {loadState === "loading" ? (
          <View
            accessibilityLabel={`Loading ${label}`}
            style={[styles.overlay, { backgroundColor: surfaceSubtle }]}
          >
            <ActivityIndicator color={primaryColor} />
            {!compact ? (
              <Text
                style={[
                  styles.captionText,
                  { color: textSecondary, marginTop: 8 },
                ]}
              >
                Loading saved photo…
              </Text>
            ) : null}
          </View>
        ) : null}

        {loadState === "error" ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.overlay,
              { backgroundColor: surfaceSubtle, padding: compact ? 8 : 16 },
            ]}
          >
            <ImageOff size={24} color={textMuted} />
            {!compact ? (
              <Text
                style={[
                  styles.captionText,
                  {
                    color: textSecondary,
                    textAlign: "center",
                    marginTop: 8,
                  },
                ]}
              >
                This saved photo could not be loaded.
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Retry loading ${label}`}
              onPress={retry}
              style={({ pressed }) => ({
                minHeight: 44, // 44px minimum touch target
                marginTop: compact ? 2 : 8,
                paddingHorizontal: compact ? 10 : 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: borderColor,
                backgroundColor: surfaceBg,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <RefreshCw size={16} color={primaryColor} />
              <Text style={[styles.labelText, { color: primaryColor }]}>
                {compact ? "Retry" : "Try Again"}
              </Text>
            </Pressable>
          </View>
        ) : null}

      </Pressable>
    </>
  );
}

// --- Styles (Design System aligned) ---

const styles = StyleSheet.create({
  imageFull: {
    width: "100%",
  },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  captionText: {
    fontFamily: "Outfit_400Regular", // Caption
    fontSize: 12,
    lineHeight: 16,
  },
  labelText: {
    fontFamily: "Outfit_600SemiBold", // Label (SemiBold)
    fontSize: 14,
    lineHeight: 20,
  },
});
