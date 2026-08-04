import React, { useState } from "react";
import { View, Text, TouchableOpacity, LayoutAnimation } from "react-native";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface AlertItem {
  type: "danger" | "warning" | "info" | "success";
  category: string;
  message: string;
  details?: string;
}

interface AlertsPanelProps {
  alerts?: AlertItem[];
}

export function AlertsPanel({ alerts = [] }: AlertsPanelProps) {
  const { colors, isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (alerts.length === 0) return null;

  // Show first 2 alerts by default
  const displayedAlerts = expanded ? alerts : alerts.slice(0, 2);

  const getAlertColors = (type: string) => {
    switch (type) {
      case "danger":
        return { bg: "rgba(239, 68, 68, 0.1)", border: "#fca5a5", text: "#ef4444", icon: "alert-octagon" };
      case "warning":
        return { bg: "rgba(245, 158, 11, 0.1)", border: "#fde047", text: "#d97706", icon: "alert" };
      case "success":
        return { bg: "rgba(16, 185, 129, 0.1)", border: "#6ee7b7", text: "#10b981", icon: "check-circle" };
      case "info":
      default:
        return { bg: "rgba(59, 130, 246, 0.1)", border: "#93c5fd", text: "#3b82f6", icon: "information" };
    }
  };

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
            <MaterialCommunityIcons name="bell-ring-outline" size={22} color="#ef4444" />
            <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
              System Alerts & Telemetry
            </Text>
          </View>
          <View style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: "#ef4444", fontSize: 11, fontFamily: "Outfit_700Bold" }}>
              {alerts.length} WARNINGS
            </Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          {displayedAlerts.map((alert, index) => {
            const styles = getAlertColors(alert.type);
            return (
              <View
                key={index}
                style={{
                  backgroundColor: styles.bg,
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.05)" : styles.border,
                  borderRadius: 16,
                  padding: 12,
                  flexDirection: "row",
                  gap: 10,
                }}
              >
                <MaterialCommunityIcons name={styles.icon as any} size={20} color={styles.text} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <Text style={{ fontSize: 9, fontFamily: "Outfit_800ExtraBold", color: styles.text, textTransform: "uppercase", backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      {alert.category}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: colors.textPrimary, marginBottom: 2 }}>
                    {alert.message}
                  </Text>
                  {alert.details && (
                    <Text style={{ fontSize: 10, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                      {alert.details}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {alerts.length > 2 && (
          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setExpanded(!expanded);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              marginTop: 16,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: colors.border
            }}
          >
            <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: colors.textSecondary }}>
              {expanded ? "Show Less Alerts" : `View All ${alerts.length} Alerts`}
            </Text>
            <MaterialCommunityIcons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
