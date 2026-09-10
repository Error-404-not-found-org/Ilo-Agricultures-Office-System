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
  PREGNANCY_DIAGNOSIS_UI,
  getFarmerUpdateCopy,
} from "@/features/breeding/utils/pregnancyDiagnosisPresentation";

type FarmerPregnancyReportCardProps = {
  insemination?: {
    farmerPregnancyReport?: boolean;
    farmerPregnancyReportedAt?: string | Date | null;
    farmerPregnancyNotes?: string | null;
    farmerPregnancyPhotos?: string[] | null;
    pregnancyReportVerificationStatus?: string | null;
  } | null;
};

const formatSubmittedAt = (value?: string | Date | null) => {
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

export function FarmerPregnancyReportCard({
  insemination,
}: FarmerPregnancyReportCardProps) {
  const { colors, isDark } = useTheme();
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);

  const hasReport = Boolean(insemination?.farmerPregnancyReport);
  const submittedAt = formatSubmittedAt(insemination?.farmerPregnancyReportedAt);
  const notes = insemination?.farmerPregnancyNotes?.trim();
  const verificationStatus =
    insemination?.pregnancyReportVerificationStatus || "pending";
  const isAwaitingDiagnosis = verificationStatus === "pending";
  const { subtitle, guidance } = getFarmerUpdateCopy(hasReport);

  const photos = useMemo<ImageViewerItem[]>(
    () =>
      (insemination?.farmerPregnancyPhotos || [])
        .filter(
          (uri): uri is string =>
            Boolean(uri && typeof uri === "string" && uri.trim()),
        )
        .map((uri, index) => ({
          uri: uri.trim(),
          fileName: `farmer-pregnancy-photo-${index + 1}`,
          accessibilityLabel: `Farmer pregnancy report photo ${index + 1}`,
        })),
    [insemination?.farmerPregnancyPhotos],
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
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.primary, marginBottom: 4 },
              ]}
            >
              {PREGNANCY_DIAGNOSIS_UI.PAGE_1.SECTION_FARMER_UPDATE}
            </Text>
            <Text
              style={{
                fontFamily: hasReport ? "Outfit_700Bold" : "Outfit_600SemiBold",
                fontSize: 14,
                color: hasReport ? colors.textPrimary : colors.textSecondary,
                marginTop: 2,
              }}
            >
              {subtitle}
            </Text>
            {hasReport && submittedAt ? (
              <Text textRole="caption" color="muted" style={{ marginTop: 2 }}>
                Submitted {submittedAt}
              </Text>
            ) : null}
          </View>
          {hasReport && photos.length ? (
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

        {hasReport ? (
          <>
            {notes ? (
              <View style={{ marginTop: 14 }}>
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    fontSize: 12,
                    color: colors.textSecondary,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {PREGNANCY_DIAGNOSIS_UI.FARMER_UPDATE.REPORTED_OBSERVATION}
                </Text>
                <Text
                  textRole="body"
                  style={{
                    marginTop: 4,
                    color: colors.textPrimary,
                    lineHeight: 20,
                  }}
                >
                  {notes}
                </Text>
              </View>
            ) : null}

            {photos.length ? (
              <View style={{ marginTop: 14 }}>
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    fontSize: 12,
                    color: colors.textSecondary,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {PREGNANCY_DIAGNOSIS_UI.FARMER_UPDATE.REPORTED_EVIDENCE}
                </Text>
                <View style={styles.photos}>
                  {photos.map((photo, index) => (
                    <Pressable
                      key={`${photo.uri}-${index}`}
                      accessibilityRole="imagebutton"
                      accessibilityLabel={`View Farmer pregnancy report photo ${index + 1} of ${photos.length}`}
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

            {/* Guidance copy */}
            <View
              style={[
                styles.guidanceBox,
                {
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.08)"
                    : "#f0fdf4",
                  borderColor: isDark ? "rgba(16, 185, 129, 0.25)" : "#bbf7d0",
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  color: isDark ? "#34d399" : "#047857",
                  lineHeight: 18,
                }}
              >
                {guidance}
              </Text>
            </View>
          </>
        ) : (
          /* Case B: No report submitted */
          <View
            style={[
              styles.guidanceBox,
              {
                backgroundColor: isDark
                  ? "rgba(30, 41, 59, 0.5)"
                  : "#f8fafc",
                borderColor: colors.border,
                marginTop: 10,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: "Outfit_500Medium",
                fontSize: 13,
                color: colors.textSecondary,
                lineHeight: 18,
              }}
            >
              {guidance}
            </Text>
          </View>
        )}
      </View>

      {hasReport && photos.length ? (
        <ImageViewerModal
          visible={viewerVisible}
          images={photos}
          initialIndex={viewerIndex}
          title="Farmer pregnancy report photos"
          onClose={() => setViewerVisible(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  photoCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  guidanceBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
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
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  photo: {
    width: 76,
    height: 76,
  },
});
