import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface RegistryHealthCardProps {
  data?: {
    duplicateEarTags: number;
    missingAnimalData: number;
    archivedRecords: number;
  };
  pendingSync?: number;
}

export function RegistryHealthCard({ data, pendingSync = 0 }: RegistryHealthCardProps) {
  const { colors, isDark } = useTheme();

  const duplicates = data?.duplicateEarTags ?? 0;
  const missing = data?.missingAnimalData ?? 0;
  const archived = data?.archivedRecords ?? 0;

  const isSecure = duplicates === 0 && missing === 0;

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <View
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 24,
          padding: 20,
          shadowColor: "#000",
          shadowOpacity: isDark ? 0 : 0.03,
          shadowRadius: 10,
          elevation: isDark ? 0 : 3,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="clipboard-check-multiple-outline" size={22} color="#7c3aed" />
            <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
              Registry Integrity Status
            </Text>
          </View>
          <View style={{
            backgroundColor: isSecure ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12
          }}>
            <Text style={{
              color: isSecure ? "#10b981" : "#d97706",
              fontSize: 11,
              fontFamily: "Outfit_700Bold"
            }}>{isSecure ? "SECURE" : "ATTENTION"}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          {/* Duplicate Animals */}
          <View style={{ width: "47%", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="alert-decagram" size={20} color={duplicates > 0 ? "#ef4444" : "#10b981"} />
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{duplicates}</Text>
              <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Duplicate Ear Tags</Text>
            </View>
          </View>

          {/* Missing Info */}
          <View style={{ width: "47%", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={missing > 0 ? "#d97706" : "#10b981"} />
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{missing}</Text>
              <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Missing Breed/DOB</Text>
            </View>
          </View>

          {/* Archived Animals */}
          <View style={{ width: "47%", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="archive-outline" size={20} color="#64748b" />
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{archived}</Text>
              <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Archived Records</Text>
            </View>
          </View>

          {/* Unsynced Records */}
          <View style={{ width: "47%", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="cloud-alert" size={20} color={pendingSync > 0 ? "#ef4444" : "#10b981"} />
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{pendingSync}</Text>
              <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Pending Syncs</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
