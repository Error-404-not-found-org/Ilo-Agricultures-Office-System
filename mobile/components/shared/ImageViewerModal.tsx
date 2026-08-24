import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Download, ImageOff, Share2, X } from "lucide-react-native";
import { toast } from "sonner-native";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { prepareImageFile } from "./imageFileUtils";

export type ImageViewerItem = {
  uri: string;
  fileName?: string;
  accessibilityLabel?: string;
};

type ImageViewerModalProps = {
  visible: boolean;
  images: ImageViewerItem[];
  initialIndex?: number;
  onClose: () => void;
  title?: string;
};

type GalleryImagePageProps = {
  item: ImageViewerItem;
  index: number;
  imageCount: number;
  pageWidth: number;
  stageHeight: number;
  onDimensions: (index: number, dimensions: ImageDimensions) => void;
};

type ImageDimensions = {
  width: number;
  height: number;
};

const GalleryImagePage = memo(function GalleryImagePage({
  item,
  index,
  imageCount,
  pageWidth,
  stageHeight,
  onDimensions,
}: GalleryImagePageProps) {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const accessibilityLabel =
    item.accessibilityLabel || `Photo ${index + 1} of ${imageCount}`;

  return (
    <View
      style={{
        width: pageWidth,
        height: stageHeight,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceSubtle,
      }}
    >
      {!hasError ? (
        <Image
          source={{ uri: item.uri }}
          resizeMode="contain"
          accessibilityLabel={accessibilityLabel}
          onLoadStart={() => setIsLoading(true)}
          onLoad={(event) => {
            const { width, height } = event.nativeEvent.source;
            if (width > 0 && height > 0) {
              onDimensions(index, { width, height });
            }
          }}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          style={{ width: pageWidth, height: stageHeight }}
        />
      ) : (
        <View style={{ alignItems: "center", gap: 8, padding: 24 }}>
          <ImageOff size={28} color={colors.textMuted} />
          <Text
            textRole="body"
            color="secondary"
            style={{ textAlign: "center" }}
          >
            This photo could not be displayed.
          </Text>
        </View>
      )}

      {isLoading && !hasError ? (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={{ position: "absolute" }}
        />
      ) : null}
    </View>
  );
});

function clampIndex(index: number, imageCount: number) {
  if (imageCount === 0) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), imageCount - 1);
}

export function ImageViewerModal({
  visible,
  images,
  initialIndex = 0,
  onClose,
  title = "Photos",
}: ImageViewerModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const listRef = useRef<FlatList<ImageViewerItem>>(null);
  const permissionRequestedRef = useRef(false);
  const safeInitialIndex = clampIndex(initialIndex, images.length);
  const [activeIndex, setActiveIndex] = useState(safeInitialIndex);
  const [imageDimensions, setImageDimensions] = useState<
    Record<number, ImageDimensions>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const cardWidth = Math.max(1, Math.min(width - 32, 640));
  const pageWidth = Math.max(1, cardWidth - 2);
  const modalTopPadding = Math.max(insets.top, 16);
  const modalBottomPadding = Math.max(insets.bottom, 16);
  const fixedViewerHeight = 64 + (images.length > 1 ? 32 : 0) + 74 + 2;
  const maxImageHeight = Math.max(
    160,
    height - modalTopPadding - modalBottomPadding - fixedViewerHeight,
  );
  const placeholderHeight = Math.min(260, maxImageHeight);
  const activeDimensions = imageDimensions[activeIndex];
  const naturalImageHeight = activeDimensions
    ? pageWidth * (activeDimensions.height / activeDimensions.width)
    : placeholderHeight;
  const stageHeight = Math.min(naturalImageHeight, maxImageHeight);
  const isNarrow = cardWidth < 340;
  const imageSignature = useMemo(
    () =>
      images
        .map(
          (item, index) =>
            `${index}:${item.uri.length}:${item.uri.slice(0, 48)}:${item.uri.slice(-24)}`,
        )
        .join("\u001f"),
    [images],
  );

  useEffect(() => {
    if (!visible) return;
    const nextIndex = clampIndex(initialIndex, images.length);
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: nextIndex * pageWidth,
        animated: false,
      });
    });
  }, [imageSignature, images.length, initialIndex, pageWidth, visible]);

  useEffect(() => {
    setImageDimensions({});
  }, [imageSignature]);

  const handleImageDimensions = useCallback(
    (index: number, dimensions: ImageDimensions) => {
      setImageDimensions((current) => {
        const existing = current[index];
        if (
          existing?.width === dimensions.width &&
          existing.height === dimensions.height
        ) {
          return current;
        }
        return { ...current, [index]: dimensions };
      });
    },
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ImageViewerItem; index: number }) => (
      <GalleryImagePage
        item={item}
        index={index}
        imageCount={images.length}
        pageWidth={pageWidth}
        stageHeight={stageHeight}
        onDimensions={handleImageDimensions}
      />
    ),
    [handleImageDimensions, images.length, pageWidth, stageHeight],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<ImageViewerItem> | null | undefined, index: number) => ({
      length: pageWidth,
      offset: pageWidth * index,
      index,
    }),
    [pageWidth],
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = clampIndex(
        Math.round(event.nativeEvent.contentOffset.x / pageWidth),
        images.length,
      );
      setActiveIndex(nextIndex);
    },
    [images.length, pageWidth],
  );

  const getActionItem = () => {
    const item = images[activeIndex];
    if (!item) {
      toast.error("No photo is available.");
      return null;
    }
    return { item, index: activeIndex };
  };

  const handleSave = async () => {
    if (isSaving) return;
    const selected = getActionItem();
    if (!selected) return;

    setIsSaving(true);
    try {
      let permission = await MediaLibrary.getPermissionsAsync(true, ["photo"]);
      if (!permission.granted) {
        if (!permission.canAskAgain) {
          toast.error(
            "Photo access is disabled. Enable it in your device settings to save photos.",
          );
          return;
        }
        if (permissionRequestedRef.current) {
          toast.error("Allow photo access in your device settings to save photos.");
          return;
        }

        permissionRequestedRef.current = true;
        permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
        if (!permission.granted) {
          toast.error("Photo access is required to save this image.");
          return;
        }
      }

      const prepared = await prepareImageFile(
        selected.item.uri,
        selected.item.fileName || `photo-${selected.index + 1}`,
      );
      await MediaLibrary.createAssetAsync(prepared.localUri);
      toast.success("Photo saved to device.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The photo could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (isSharing) return;
    const selected = getActionItem();
    if (!selected) return;

    setIsSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing photos is not available on this device.");
      }
      const prepared = await prepareImageFile(
        selected.item.uri,
        selected.item.fileName || `photo-${selected.index + 1}`,
      );
      await Sharing.shareAsync(prepared.localUri, {
        dialogTitle: "Share photo",
        mimeType: prepared.mimeType,
        UTI: "public.image",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The photo could not be shared.",
      );
    } finally {
      setIsSharing(false);
    }
  };

  const activeItem = images[activeIndex];
  const actionInProgress = isSaving || isSharing;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
          paddingHorizontal: 16,
          backgroundColor: colors.modalBackdrop,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close photo gallery"
          onPress={onClose}
          style={{ position: "absolute", inset: 0 }}
        />

        <View
          style={{
            width: cardWidth,
            alignSelf: "center",
            overflow: "hidden",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <View
            style={{
              minHeight: 64,
              paddingLeft: 16,
              paddingRight: 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text textRole="title" numberOfLines={1}>
                {title}
              </Text>
              {images.length > 1 ? (
                <Text textRole="caption" color="secondary">
                  {activeIndex + 1} of {images.length}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close photo gallery"
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={4}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surfaceSubtle,
              }}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {images.length ? (
            <FlatList
              key={`gallery-${visible}-${safeInitialIndex}-${imageSignature}`}
              ref={listRef}
              data={images}
              horizontal
              pagingEnabled
              bounces={false}
              initialScrollIndex={safeInitialIndex}
              initialNumToRender={Math.min(images.length, 3)}
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) =>
                `${item.fileName || "gallery-photo"}-${index}`
              }
              renderItem={renderItem}
              getItemLayout={getItemLayout}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              style={{ width: pageWidth, height: stageHeight }}
            />
          ) : (
            <View
              style={{
                width: pageWidth,
                height: stageHeight,
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: colors.surfaceSubtle,
              }}
            >
              <ImageOff size={28} color={colors.textMuted} />
              <Text textRole="body" color="secondary">
                No photos are available.
              </Text>
            </View>
          )}

          {images.length > 1 ? (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                minHeight: 32,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {images.map((item, index) => (
                <View
                  key={`${item.fileName || "gallery-photo"}-dot-${index}`}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor:
                      index === activeIndex ? colors.primary : colors.outline,
                  }}
                />
              ))}
            </View>
          ) : null}

          <View
            style={{
              padding: 12,
              paddingTop: images.length > 1 ? 4 : 12,
              flexDirection: "row",
              gap: 8,
            }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Save ${activeItem?.accessibilityLabel || "current photo"} to device`}
              onPress={handleSave}
              disabled={!activeItem || actionInProgress}
              activeOpacity={0.8}
              style={{
                minHeight: 50,
                flex: 1,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: !activeItem || actionInProgress ? 0.55 : 1,
                backgroundColor: colors.primary,
              }}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Download size={18} color={colors.onPrimary} />
              )}
              <Text textRole="bodyStrong" style={{ color: colors.onPrimary }}>
                {isSaving ? "Saving..." : isNarrow ? "Save" : "Save to device"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Share ${activeItem?.accessibilityLabel || "current photo"}`}
              onPress={handleShare}
              disabled={!activeItem || actionInProgress}
              activeOpacity={0.8}
              style={{
                minHeight: 50,
                flex: 1,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: !activeItem || actionInProgress ? 0.55 : 1,
                backgroundColor: colors.card,
              }}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Share2 size={18} color={colors.primary} />
              )}
              <Text textRole="bodyStrong" color="brand">
                {isSharing ? "Preparing..." : "Share"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
