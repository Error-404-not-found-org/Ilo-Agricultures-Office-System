import React, { useState } from "react";
import { View, Text, TouchableOpacity, LayoutAnimation } from "react-native";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SkeletonMoowieCard } from "./SkeletonLoader";

interface MoowieInsightsProps {
  data?: {
    pregnancySuccessRate: number;
    aiSuccessRate: number;
    barangaysNeedingAttention: Array<{
      barangay: string;
      totalRequests: number;
      criticalRequests: number;
    }>;
    technicianWorkloads: Array<{
      name: string;
      activeRequests: number;
    }>;
    duplicateEarTags: number;
    inactiveFarmers: number;
    animalsNeedingUpdates: number;
  };
}

/**
 * Mini progress bar for displaying success rate metrics.
 */
function ProgressBar({ value, color, trackColor }: { value: number; color: string; trackColor: string }) {
  return (
    <View style={{ height: 4, borderRadius: 2, backgroundColor: trackColor, marginTop: 4 }}>
      <View
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: color,
          width: `${Math.min(Math.max(value, 0), 100)}%`,
        }}
      />
    </View>
  );
}

export function MoowieInsightsCard({ data }: MoowieInsightsProps) {
  const { colors, isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);

  // Show skeleton when data hasn't loaded yet
  if (!data) {
    return <SkeletonMoowieCard />;
  }

  const pregSuccess = data.pregnancySuccessRate ?? 82;
  const aiSuccess = data.aiSuccessRate ?? 78;
  const inactiveFarmers = data.inactiveFarmers ?? 0;
  const animalsNeedingUpdates = data.animalsNeedingUpdates ?? 0;

  const hotspots = data.barangaysNeedingAttention || [];
  const workloads = data.technicianWorkloads || [];

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <View
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 24,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOpacity: isDark ? 0 : 0.03,
          shadowRadius: 10,
          elevation: isDark ? 0 : 3,
        }}
      >
        {/* Accent strip */}
        <View style={{ height: 3, backgroundColor: "#2563eb" }} />

        <View style={{ padding: 20 }}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  backgroundColor: "#2563eb",
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#2563eb",
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 4,
                }}
              >
                <MaterialCommunityIcons name="robot" size={20} color="#ffffff" />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                  Moowie AI Insights
                </Text>
                <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
                  Executive Summary & Advisor
                </Text>
              </View>
            </View>
            <View
              style={{
                backgroundColor: "rgba(37, 99, 235, 0.12)",
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "rgba(37, 99, 235, 0.2)",
              }}
            >
              <Text style={{ color: "#2563eb", fontSize: 10, fontFamily: "Outfit_700Bold", letterSpacing: 0.5 }}>
                ANALYTICS
              </Text>
            </View>
          </View>

          {/* Advisor Speech Bubble */}
          <View
            style={{
              backgroundColor: isDark ? "rgba(37, 99, 235, 0.08)" : "rgba(37, 99, 235, 0.04)",
              padding: 14,
              borderRadius: 16,
              borderLeftWidth: 4,
              borderLeftColor: "#2563eb",
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: "#2563eb",
                  marginTop: 5,
                }}
              />
              <Text style={{ flex: 1, fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textPrimary, fontStyle: "italic", lineHeight: 19 }}>
                "Pregnancy checks maintain a {pregSuccess}% confirmation success rate. Hotspot monitoring flags {hotspots.length > 0 ? hotspots[0].barangay : "no"} barangays with active health warnings."
              </Text>
            </View>
          </View>

          {/* Grid Stats with Progress Bars */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: expanded ? 16 : 0 }}>
            {/* Pregnancy Success Rate */}
            <View style={{ width: "47%" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons name="piggy-bank" size={20} color="#10b981" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{pregSuccess}%</Text>
                  <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Pregnancy PD Success</Text>
                  <ProgressBar value={pregSuccess} color="#10b981" trackColor={isDark ? "rgba(16,185,129,0.15)" : "#d1fae5"} />
                </View>
              </View>
            </View>

            {/* AI Success Rate */}
            <View style={{ width: "47%" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons name="trending-up" size={20} color="#059669" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{aiSuccess}%</Text>
                  <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Insemination Success</Text>
                  <ProgressBar value={aiSuccess} color="#059669" trackColor={isDark ? "rgba(5,150,105,0.15)" : "#d1fae5"} />
                </View>
              </View>
            </View>

            {/* Inactive Farmers */}
            <View style={{ width: "47%" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons name="account-alert" size={20} color="#d97706" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{inactiveFarmers}</Text>
                  <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Inactive Farmers</Text>
                </View>
              </View>
            </View>

            {/* Animals Needing Updates */}
            <View style={{ width: "47%" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons name="database-edit" size={20} color="#3b82f6" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{animalsNeedingUpdates}</Text>
                  <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Incomplete Profiles</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Expandable Section for Hotspots & Workloads */}
          {expanded && (
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
              {/* Barangay Hotspots */}
              <Text style={{ fontSize: 12, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 8 }}>
                Barangays Needing Attention
              </Text>
              {hotspots.length === 0 ? (
                <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 12 }}>
                  No active hotspot warnings.
                </Text>
              ) : (
                hotspots.map((item, index) => (
                  <View key={index} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>
                      {index + 1}. Barangay {item.barangay}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
                      {item.totalRequests} reports ({item.criticalRequests} critical)
                    </Text>
                  </View>
                ))
              )}

              {/* Technician Workload */}
              <Text style={{ fontSize: 12, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginTop: 12, marginBottom: 8 }}>
                Technician Active Workload
              </Text>
              {workloads.length === 0 ? (
                <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
                  No active assignments.
                </Text>
              ) : (
                workloads.map((tech, index) => (
                  <View key={index} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>
                      {tech.name}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
                        {tech.activeRequests} active jobs
                      </Text>
                      <View style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: tech.activeRequests > 4 ? "#ef4444" : tech.activeRequests > 2 ? "#f59e0b" : "#10b981"
                      }} />
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Toggle Button */}
          <TouchableOpacity
            onPress={handleToggle}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: expanded ? 0 : 1,
              borderTopColor: colors.border
            }}
          >
            <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: "#2563eb" }}>
              {expanded ? "Show Less" : "Expand Insights"}
            </Text>
            <MaterialCommunityIcons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={16}
              color="#2563eb"
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
