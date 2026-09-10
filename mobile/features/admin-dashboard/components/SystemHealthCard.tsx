import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface SystemHealthProps {
  data?: {
    onlineDevices: number;
    offlineDevices: number;
    pendingSync: number;
    lastBackup: string;
    serverStatus: string;
  };
}

export function SystemHealthCard({ data }: SystemHealthProps) {
  const { colors, isDark } = useTheme();

  const formatLastBackup = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " " + d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const online = data?.onlineDevices ?? 0;
  const offline = data?.offlineDevices ?? 0;
  const pending = data?.pendingSync ?? 0;
  const lastBackup = formatLastBackup(data?.lastBackup);
  const serverOnline = data?.serverStatus === "online";

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
            <MaterialCommunityIcons name="heart-pulse" size={22} color="#059669" />
            <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
              System Health & Status
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: serverOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: serverOnline ? "#10b981" : "#ef4444" }} />
            <Text style={{ color: serverOnline ? "#10b981" : "#ef4444", fontSize: 12, fontFamily: "Outfit_700Bold" }}>
              {serverOnline ? "API ONLINE" : "OFFLINE"}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          {/* Online Devices */}
          <View style={{ width: "47%", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="cellphone-link" size={20} color="#10b981" />
            <View>
              <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{online}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Online Devices</Text>
            </View>
          </View>

          {/* Offline Devices */}
          <View style={{ width: "47%", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="cellphone-off" size={20} color="#64748b" />
            <View>
              <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{offline}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Offline Devices</Text>
            </View>
          </View>

          {/* Pending Sync */}
          <View style={{ width: "47%", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="sync" size={20} color="#3b82f6" />
            <View>
              <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{pending}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Pending Sync</Text>
            </View>
          </View>

          {/* Last Backup */}
          <View style={{ width: "47%", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="database-check" size={20} color="#7c3aed" />
            <View style={{ flexShrink: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{lastBackup}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Last Backup</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
