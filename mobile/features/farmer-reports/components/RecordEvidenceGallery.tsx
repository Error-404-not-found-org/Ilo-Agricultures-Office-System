import React, { useState, useMemo } from "react";
import { ScrollView, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import type { RecordAttachment } from "../types/farmerReports.types";
import { RecordPhotoEvidence } from "./RecordPhotoEvidence";
import { ImageViewerModal, type ImageViewerItem } from "@/components/shared";

interface RecordEvidenceGalleryProps {
  attachments?: RecordAttachment[];
}

export function RecordEvidenceGallery({
  attachments = [],
}: RecordEvidenceGalleryProps) {
  const { colors } = useTheme();
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);

  const galleryImages = useMemo<ImageViewerItem[]>(() => {
    return attachments.map((attachment, index) => ({
      uri: attachment.url,
      fileName: attachment.label || `evidence-photo-${index + 1}`,
      accessibilityLabel: attachment.label || `Evidence photo ${index + 1}`,
    }));
  }, [attachments]);

  if (attachments.length === 0) return null;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text textRole="title" style={{ color: colors.textPrimary }}>
          Record evidence
        </Text>
        <Text textRole="caption" style={{ color: colors.textSecondary }}>
          Only photos saved with this official record are shown.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10 }}
      >
        {attachments.map((attachment, index) => (
          <View
            key={`${attachment.url}-${index}`}
            style={{ width: 148, gap: 6 }}
          >
            <RecordPhotoEvidence
              url={attachment.url}
              label={attachment.label}
              width={148}
              height={104}
              compact
              onPress={() => {
                setGalleryInitialIndex(index);
                setGalleryVisible(true);
              }}
            />
            <Text
              textRole="label"
              numberOfLines={2}
              style={{ color: colors.textSecondary }}
            >
              {attachment.label}
            </Text>
          </View>
        ))}
      </ScrollView>

      <ImageViewerModal
        visible={galleryVisible}
        images={galleryImages}
        initialIndex={galleryInitialIndex}
        title="Record Evidence"
        onClose={() => setGalleryVisible(false)}
      />
    </View>
  );
}
