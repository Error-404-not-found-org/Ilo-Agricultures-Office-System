import React from "react";
import { Text, View } from "react-native";
import { Info } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

type RequestDetailCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function RequestDetailCard({
  title,
  description,
  children,
}: RequestDetailCardProps) {
  const { colors } = useTheme();

  return (
    <View
      className="mx-5 mt-4 border"
      style={{
        borderRadius: 18,
        backgroundColor: colors.card,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      <View className="px-4 pt-4">
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: "Outfit_700Bold",
            fontSize: 14,
            lineHeight: 19,
          }}
        >
          {title}
        </Text>
        {description ? (
          <Text
            className="mt-1"
            style={{
              color: colors.textMuted,
              fontFamily: "Outfit_500Medium",
              fontSize: 11,
              lineHeight: 16,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>

      <View className="p-4">{children}</View>
    </View>
  );
}

type RequestDetailRowProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  isLast?: boolean;
};

export function RequestDetailRow({
  icon,
  label,
  value,
  isLast = false,
}: RequestDetailRowProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      className="flex-row items-center py-3"
      style={{
        borderBottomWidth: isLast ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center"
        style={{
          backgroundColor: isDark ? colors.background : "#F0FDF4",
        }}
      >
        {icon}
      </View>
      <View className="ml-3 flex-1">
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: "Outfit_700Bold",
            fontSize: 9,
            letterSpacing: 0.7,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <Text
          className="mt-1"
          style={{
            color: colors.textPrimary,
            fontFamily: "Outfit_600SemiBold",
            fontSize: 12,
            lineHeight: 17,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

type RequestDetailFieldProps = {
  label: string;
  value: string;
};

export function RequestDetailField({ label, value }: RequestDetailFieldProps) {
  const { colors } = useTheme();

  return (
    <View>
      <Text
        style={{
          color: colors.textMuted,
          fontFamily: "Outfit_700Bold",
          fontSize: 9,
          letterSpacing: 0.7,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        className="mt-1"
        style={{
          color: colors.textPrimary,
          fontFamily: "Outfit_500Medium",
          fontSize: 12,
          lineHeight: 18,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function RequestDetailNotice({ message }: { message: string }) {
  const { colors, isDark } = useTheme();

  return (
    <View
      className="flex-row items-start p-3"
      style={{
        borderRadius: 12,
        backgroundColor: isDark ? colors.background : "#F8FAFC",
      }}
    >
      <Info size={15} color={colors.textMuted} style={{ marginTop: 1 }} />
      <Text
        className="ml-2 flex-1"
        style={{
          color: colors.textSecondary,
          fontFamily: "Outfit_500Medium",
          fontSize: 11,
          lineHeight: 16,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
