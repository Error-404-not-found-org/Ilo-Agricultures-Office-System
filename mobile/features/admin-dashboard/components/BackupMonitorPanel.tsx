import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { toast } from "sonner-native";

interface BackupMonitorProps {
  data?: {
    lastBackup: string;
    backupStatus: string;
    storageUsage: string;
  };
  onTriggerBackup: () => Promise<any>;
  isBackingUp: boolean;
}

export function BackupMonitorPanel({ data, onTriggerBackup, isBackingUp }: BackupMonitorProps) {
  const { colors, isDark } = useTheme();

  const formatLastBackup = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " " + d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const handleBackup = async () => {
    try {
      await onTriggerBackup();
      toast.success("System database snapshot compiled and saved successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger backup.");
    }
  };

  const renderStatusBadge = (status?: string) => {
    const s = status?.toLowerCase() || "completed";
    let label = "Completed";
    let color = "#10B981";
    let bg = "rgba(16,185,129,0.15)";

    if (s === "started" || s === "running") {
      label = "Started";
      color = "#3b82f6";
      bg = "rgba(59, 130, 246, 0.15)";
    } else if (s === "failed") {
      label = "Failed";
      color = "#ef4444";
      bg = "rgba(239, 68, 68, 0.15)";
    }

    return (
      <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 }}>
        <Text style={{ color, fontSize: 10, fontFamily: "Outfit_700Bold", textTransform: "uppercase" }}>{label}</Text>
      </View>
    );
  };

  const lastBackup = formatLastBackup(data?.lastBackup);
  const storageUsage = data?.storageUsage ?? "0.0 MB";

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
            <MaterialCommunityIcons name="cloud-upload-outline" size={22} color="#7c3aed" />
            <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
              Backup & Storage Monitor
            </Text>
          </View>
          <View style={{ backgroundColor: "rgba(124, 58, 237, 0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: "#7c3aed", fontSize: 11, fontFamily: "Outfit_700Bold" }}>STORAGE</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
          <View style={{ flex: 1.2 }}>
            <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Last Backup Event</Text>
            <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginTop: 2 }}>{lastBackup}</Text>
          </View>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Status</Text>
            {renderStatusBadge(data?.backupStatus)}
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Database Size</Text>
            <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginTop: 2 }}>{storageUsage}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleBackup}
          disabled={isBackingUp}
          activeOpacity={0.8}
          style={{
            backgroundColor: isBackingUp ? colors.border : "#7c3aed",
            paddingVertical: 12,
            borderRadius: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {isBackingUp ? (
            <>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={{ color: "#ffffff", fontSize: 13, fontFamily: "Outfit_700Bold" }}>Compiling Snapshot...</Text>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="database-export" size={18} color="#ffffff" />
              <Text style={{ color: "#ffffff", fontSize: 13, fontFamily: "Outfit_700Bold" }}>Trigger Database Backup</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
