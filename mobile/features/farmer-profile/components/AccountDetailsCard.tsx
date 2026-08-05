import React from "react";
import { ActivityIndicator, View, Text, TouchableOpacity } from "react-native";
import { Mail, Phone, MapPin, Navigation } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "../../../contexts/TranslationContext";
import DetailRow from "./DetailRow";
import { isAddressPlaceholder } from "@/constants/address";

interface AccountDetailsCardProps {
  clerkUser: any;
  dbUser: any;
  onEditPhone: () => void;
  onEditAddress: () => void;
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
  onEditAddress,
}: AccountDetailsCardProps) => {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const addressParts = [
    dbUser?.address?.street,
    dbUser?.address?.barangay,
    dbUser?.address?.district,
    dbUser?.address?.city,
    dbUser?.address?.province,
  ].filter((part, index, parts): part is string =>
    Boolean(part) &&
    !isAddressPlaceholder(part) &&
    parts.indexOf(part) === index,
  );
  const hasPhoneNumber = Boolean(dbUser?.phoneNumber);
  const hasVerifiedPhone = Boolean(
    hasPhoneNumber && dbUser?.phoneVerification?.isVerified,
  );
  const phoneLabel = hasVerifiedPhone
    ? `${t("phoneNumber")} • Verified`
    : hasPhoneNumber
      ? `${t("phoneNumber")} • Verification required`
      : t("phoneNumber");

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
          label={phoneLabel}
          value={dbUser?.phoneNumber || t("notSet")}
          onPress={onEditPhone}
        />
        <Divider />
        <DetailRow
          icon={<MapPin size={18} color={colors.textMuted} />}
          label="Home / Contact Address"
          value={addressParts.length ? addressParts.join(", ") : t("notSet")}
          onPress={onEditAddress}
        />
        <View
          className="px-5 pb-5"
          style={{ backgroundColor: colors.card }}
        >
          <TouchableOpacity
            onPress={onEditAddress}
            className="rounded-2xl py-3 flex-row items-center justify-center border"
            style={{
              backgroundColor: isDark ? "rgba(16, 185, 129, 0.08)" : "#f0fdf4",
              borderColor: isDark ? "rgba(16, 185, 129, 0.3)" : "#bbf7d0",
            }}
          >
            <MapPin size={14} color={colors.primary} />
            <Text className="font-outfit-bold ml-2 text-xs" style={{ color: colors.primary }}>
              Edit Contact Address
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default AccountDetailsCard;
