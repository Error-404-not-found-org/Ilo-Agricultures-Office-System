import React from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Camera, ShieldCheck, User } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "../../../contexts/TranslationContext";

interface ProfileHeaderProps {
  clerkUser: any;
  uploadingImage: boolean;
  onChangeProfileImage: () => void;
}

const ProfileHeader = ({
  clerkUser,
  uploadingImage,
  onChangeProfileImage,
}: ProfileHeaderProps) => {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      className="pt-14 pb-20 px-6 rounded-b-[40px] items-center relative shadow-lg"
      style={{ backgroundColor: "#00643B" }}
    >
      {/* Profile Picture & Info */}
      <View className="relative mt-4">
        <View className="w-24 h-24 rounded-full border-4 border-white/20 overflow-hidden bg-slate-100 items-center justify-center">
          {uploadingImage ? (
            <ActivityIndicator size="small" color="#00643B" />
          ) : clerkUser?.imageUrl ? (
            <Image
              source={{ uri: clerkUser.imageUrl }}
              className="w-full h-full"
            />
          ) : (
            <User size={48} color="#94a3b8" />
          )}
        </View>
        <TouchableOpacity
          onPress={onChangeProfileImage}
          disabled={uploadingImage}
          className="absolute bottom-0 right-0 w-8 h-8 rounded-full items-center justify-center shadow-md"
          style={{ backgroundColor: colors.card }}
        >
          {uploadingImage ? (
            <ActivityIndicator
              size="small"
              color={isDark ? colors.primary : "#00643B"}
            />
          ) : (
            <Camera size={14} color={isDark ? colors.primary : "#00643B"} />
          )}
        </TouchableOpacity>
      </View>

      <Text className="text-white font-outfit-bold text-xl mt-4">
        {clerkUser?.fullName ||
          clerkUser?.username ||
          clerkUser?.primaryEmailAddress?.emailAddress}
      </Text>

      <View className="flex-row items-center gap-1.5 mt-1 bg-white/10 px-3 py-1 rounded-full">
        <ShieldCheck size={12} color="#34d399" />
        <Text className="text-emerald-100 text-[10px] font-outfit-bold uppercase tracking-wider">
          {t("registeredFarmer")}
        </Text>
      </View>
    </View>
  );
};

export default ProfileHeader;
