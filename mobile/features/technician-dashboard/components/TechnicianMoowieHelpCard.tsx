import React from "react";
import { View, Image } from "react-native";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { useTheme } from "@/lib/theme";
import { ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";

export function TechnicianMoowieHelpCard() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  return (
    <Card
      onPress={() => router.push("/ask-moowie" as any)}
      style={{
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 16,
        marginTop: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          backgroundColor: isDark ? "rgba(16,185,129,0.1)" : "#f0fdf4",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={{
            uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png",
          }}
          style={{ width: 46, height: 46 }}
          resizeMode="contain"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="black" size={16}>
          Need a second opinion?
        </Text>
        <Text
          variant="medium"
          color="secondary"
          size={11}
          style={{
            lineHeight: 15,
            marginTop: 2,
          }}
        >
          Moowie can help diagnose symptoms or suggest protocols.
        </Text>
      </View>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "#f0fdf4",
          borderWidth: 1,
          borderColor: isDark ? "rgba(16,185,129,0.22)" : "#dcfce7",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronRight size={22} color={colors.primary} />
      </View>
    </Card>
  );
}
