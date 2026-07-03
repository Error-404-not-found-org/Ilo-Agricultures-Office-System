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
        backgroundColor: isDark ? "#1f2937" : "#FAF7F2",
        borderRadius: 28,
        padding: 20,
        marginTop: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        borderWidth: 1,
        borderColor: isDark ? "#374151" : "#f3f0e9",
      }}
    >
      <View style={{ width: 60, height: 60 }}>
        <Image
          source={{
            uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png",
          }}
          style={{ width: "100%", height: "100%" }}
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
          borderRadius: 22,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronRight size={24} color="#fff" />
      </View>
    </Card>
  );
}
