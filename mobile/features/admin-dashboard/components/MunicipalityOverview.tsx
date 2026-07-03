import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export function MunicipalityOverview() {
  const { colors, isDark } = useTheme();

  const mockBarangays = [
    { name: "Trapiche", farmers: 45, animals: 120, pregRate: "78%", aiSuccess: "82%" },
    { name: "Santa Rita", farmers: 32, animals: 84, pregRate: "74%", aiSuccess: "79%" },
    { name: "Poblacion", farmers: 28, animals: 65, pregRate: "82%", aiSuccess: "85%" },
    { name: "Tagbak", farmers: 38, animals: 98, pregRate: "71%", aiSuccess: "75%" },
    { name: "Bita Norte", farmers: 24, animals: 52, pregRate: "76%", aiSuccess: "80%" },
  ];

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 12 }}>
        Municipality Overview (Oton)
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {mockBarangays.map((item) => (
          <View
            key={item.name}
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 20,
              padding: 16,
              width: 200,
              shadowColor: "#000",
              shadowOpacity: isDark ? 0 : 0.02,
              shadowRadius: 8,
              elevation: isDark ? 0 : 2,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                Brgy. {item.name}
              </Text>
              <MaterialCommunityIcons name="map-marker-radius" size={18} color="#1e3a5f" />
            </View>

            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Farmers:</Text>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{item.farmers}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Animals:</Text>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{item.animals}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Pregnancy Rate:</Text>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: "#16a34a" }}>{item.pregRate}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>AI Success Rate:</Text>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: "#2563EB" }}>{item.aiSuccess}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
