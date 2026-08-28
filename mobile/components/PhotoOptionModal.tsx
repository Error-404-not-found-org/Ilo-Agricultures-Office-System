import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { Camera, Image as ImageIcon, X } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { AnimatedBottomSheet } from "@/components/shared/AnimatedBottomSheet";

export type PhotoOptionModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectCamera: () => void;
  onSelectLibrary: () => void;
  title?: string;
};

export function PhotoOptionModal({
  visible,
  onClose,
  onSelectCamera,
  onSelectLibrary,
  title = "Select Photo Source",
}: PhotoOptionModalProps) {
  const { colors, isDark } = useTheme();

  return (
    <AnimatedBottomSheet
      visible={visible}
      onClose={onClose}
      backgroundColor={colors.card}
    >
        <View className="p-6 shadow-2xl">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 18,
                color: colors.textPrimary,
              }}
            >
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close photo options"
              className="bg-slate-100 dark:bg-slate-800 rounded-full items-center justify-center min-w-[48px] min-h-[48px]"
            >
              <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            </TouchableOpacity>
          </View>

          {/* Options */}
          <View className="gap-3">
            <TouchableOpacity
              onPress={() => {
                onClose();
                onSelectCamera();
              }}
              className="flex-row items-center p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800/50"
            >
              <View className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-800/50 items-center justify-center mr-4">
                <Camera size={20} color={isDark ? "#34d399" : "#00643B"} />
              </View>
              <View className="flex-1">
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="text-base text-emerald-900 dark:text-emerald-200"
                >
                  Take Photo
                </Text>
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5"
                >
                  Use your device camera to snap a picture
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onClose();
                onSelectLibrary();
              }}
              className="flex-row items-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
            >
              <View className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 items-center justify-center mr-4">
                <ImageIcon size={20} color={isDark ? "#94a3b8" : "#475569"} />
              </View>
              <View className="flex-1">
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="text-base text-slate-800 dark:text-white"
                >
                  Choose from Gallery
                </Text>
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-xs text-slate-500 dark:text-slate-400 mt-0.5"
                >
                  Select an existing photo from your photo library
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
    </AnimatedBottomSheet>
  );
}

export default PhotoOptionModal;
