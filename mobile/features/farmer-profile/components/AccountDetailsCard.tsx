import React from "react";
import { ActivityIndicator, View, Text, TouchableOpacity } from "react-native";
import { Mail, Phone, MapPin, Navigation } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "../../../contexts/TranslationContext";
import DetailRow from "./DetailRow";

interface AccountDetailsCardProps {
  clerkUser: any;
  dbUser: any;
  onEditPhone: () => void;
  onUseCurrentContactAddress: () => void;
  isSavingLocation: boolean;
}

const Divider = () => {
  const { colors } = useTheme();
  return (
    <View
      className="h-[1px] ml-16"
      style={{ backgroundColor: colors.border }}
    />
  );
};

const AccountDetailsCard = ({
  clerkUser,
  dbUser,
  onEditPhone,
  onUseCurrentContactAddress,
  isSavingLocation,
}: AccountDetailsCardProps) => {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <View className="px-6 mt-8">
      {/* Personal Information */}
      <Text
        className="font-outfit-black text-[10px] uppercase tracking-widest mb-3 ml-1"
        style={{ color: colors.textMuted }}
      >
        Account & Contact Address
      </Text>

      <View
        className="rounded-3xl overflow-hidden border mb-6"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
      >
        <DetailRow
          icon={<Mail size={18} color={colors.textMuted} />}
          label={t("emailAddress")}
          value={clerkUser?.primaryEmailAddress?.emailAddress}
        />
        <Divider />
        <DetailRow
          icon={<Phone size={18} color={colors.textMuted} />}
          label={t("phoneNumber")}
          value={dbUser?.phoneNumber || t("notSet")}
          onPress={onEditPhone}
        />
        <Divider />
        <DetailRow
          icon={<MapPin size={18} color={colors.textMuted} />}
          label="Home / Contact Address"
          value={
            dbUser?.address?.barangay
              ? `${dbUser.address.street ? dbUser.address.street + ", " : ""}${dbUser.address.barangay}, ${dbUser.address.city}, ${dbUser.address.province}`
              : t("notSet")
          }
        />
        <View
          className="px-5 pb-5"
          style={{ backgroundColor: colors.card }}
        >
          {dbUser?.address?.detectedAddress ? (
            <Text
              className="font-outfit-medium text-xs leading-5 mb-3"
              style={{ color: colors.textMuted, marginLeft: 52 }}
            >
              Detected near {dbUser.address.detectedAddress}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={onUseCurrentContactAddress}
            disabled={isSavingLocation}
            className="rounded-2xl py-3 flex-row items-center justify-center border"
            style={{
              backgroundColor: isSavingLocation
                ? colors.card
                : isDark ? "rgba(16, 185, 129, 0.08)" : "#f0fdf4",
              borderColor: isSavingLocation ? colors.border : (isDark ? "rgba(16, 185, 129, 0.3)" : "#bbf7d0"),
            }}
          >
            {isSavingLocation ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Navigation size={14} color={colors.primary} />
                <Text className="font-outfit-bold ml-2 text-xs" style={{ color: colors.primary }}>
                  Update Address with Current GPS
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default AccountDetailsCard;
