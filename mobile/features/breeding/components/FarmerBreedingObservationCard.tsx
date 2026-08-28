import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Camera } from "lucide-react-native";

import {
  ImageViewerModal,
  type ImageViewerItem,
} from "@/components/shared/ImageViewerModal";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import {
  getBreedingObservationLabel,
  getBreedingObservationSignLabel,
  type BreedingObservationAttempt,
} from "../utils/breedingObservationPresentation";

type FarmerBreedingObservationCardProps = {
  observation: BreedingObservationAttempt;
  title?: string;
};

const formatSubmittedAt = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export function FarmerBreedingObservationCard({
  observation,
  title = "Farmer Update",
}: FarmerBreedingObservationCardProps) {
  const { colors } = useTheme();
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const submittedAt = formatSubmittedAt(observation.farmerOutcomeReportedAt);
  const photos = useMemo<ImageViewerItem[]>(
    () =>
      (observation.evidencePhotos || [])
        .filter((uri): uri is string => Boolean(uri?.trim()))
        .map((uri, index) => ({
          uri: uri.trim(),
          fileName: `farmer-update-photo-${index + 1}`,
          accessibilityLabel: `Farmer update photo ${index + 1}`,
        })),
    [observation.evidencePhotos],
  );

  return (
    <>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.headingRow}>
          <View style={{ flex: 1 }}>
            <Text textRole="label" color="brand">
              {title.toUpperCase()}
            </Text>
            {submittedAt ? (
              <Text textRole="caption" color="muted" style={{ marginTop: 3 }}>
                Submitted {submittedAt}
              </Text>
            ) : null}
          </View>
          {photos.length ? (
            <View
              style={[
                styles.photoCount,
                { backgroundColor: colors.surfaceSubtle },
              ]}
            >
              <Camera size={15} color={colors.textSecondary} />
              <Text textRole="label" color="secondary">
                {photos.length}
              </Text>
            </View>
          ) : null}
        </View>

        {observation.farmerOutcomeReport ? (
          <Text textRole="title" style={{ marginTop: 14 }}>
            {getBreedingObservationLabel(observation.farmerOutcomeReport)}
          </Text>
        ) : null}

        {observation.farmerObservationSigns?.length ? (
          <View style={{ marginTop: 16 }}>
            <Text textRole="label" color="secondary">
              Signs observed
            </Text>
            <View style={styles.signs}>
              {observation.farmerObservationSigns.map((sign) => (
                <View
                  key={sign}
                  style={[
                    styles.sign,
                    { backgroundColor: colors.surfaceSubtle },
                  ]}
                >
                  <Text textRole="caption" color="secondary">
                    {getBreedingObservationSignLabel(sign)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {observation.farmerObservationNotes ? (
          <View style={{ marginTop: 16 }}>
            <Text textRole="label" color="secondary">
              Farmer notes
            </Text>
            <Text textRole="body" style={{ marginTop: 5 }}>
              {observation.farmerObservationNotes}
            </Text>
          </View>
        ) : null}

        {photos.length ? (
          <View style={{ marginTop: 16 }}>
            <Text textRole="label" color="secondary">
              Photo evidence
            </Text>
            <View style={styles.photos}>
              {photos.map((photo, index) => (
                <Pressable
                  key={`${photo.uri}-${index}`}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`View Farmer update photo ${index + 1} of ${photos.length}`}
                  hitSlop={4}
                  onPress={() => {
                    setViewerIndex(index);
                    setViewerVisible(true);
                  }}
                  style={({ pressed }) => [
                    styles.photoButton,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    resizeMode="cover"
                    fadeDuration={0}
                    style={styles.photo}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: 24, padding: 12, backgroundColor: colors.surfaceSubtle, borderRadius: 12 }}>
          <Text textRole="caption" color="secondary" style={{ textAlign: "center" }}>
            Farmer-reported observations for supporting context.
          </Text>
        </View>
      </View>

      <ImageViewerModal
        visible={viewerVisible}
        images={photos}
        initialIndex={viewerIndex}
        title="Farmer update photos"
        onClose={() => setViewerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  photoCount: {
    minWidth: 44,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  signs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  sign: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  photos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  photoButton: {
    width: 76,
    height: 76,
    flexShrink: 0,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  photo: {
    width: 76,
    height: 76,
  },
});
