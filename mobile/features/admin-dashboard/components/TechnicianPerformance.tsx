import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export function TechnicianPerformance() {
  const { colors, isDark } = useTheme();

  const mockTechs = [
    { name: "John Doe", visits: 124, ai: 85, preg: 42, response: "2.4 hrs" },
    { name: "Jane Smith", visits: 98, ai: 60, preg: 35, response: "1.8 hrs" },
    { name: "Mark Wilson", visits: 110, ai: 72, preg: 38, response: "3.1 hrs" },
  ];

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 12 }}>
        Technician Performance
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {mockTechs.map((item) => (
          <View
            key={item.name}
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 20,
              padding: 16,
              width: 220,
              shadowColor: "#000",
              shadowOpacity: isDark ? 0 : 0.02,
              shadowRadius: 8,
              elevation: isDark ? 0 : 2,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialCommunityIcons name="account-tie" size={18} color={isDark ? colors.primary : "#1e3a5f"} />
              </View>
              <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                {item.name}
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Visits Completed:</Text>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{item.visits}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>AI Procedures:</Text>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{item.ai}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Pregnancy Checks:</Text>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{item.preg}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Avg Response Time:</Text>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: "#d97706" }}>{item.response}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
