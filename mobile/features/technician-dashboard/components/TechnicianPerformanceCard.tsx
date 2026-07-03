import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { useTheme } from "@/lib/theme";
import { TrendingUp } from "lucide-react-native";
import { useRouter } from "expo-router";

interface TechnicianPerformanceCardProps {
  stats: any;
}

export function TechnicianPerformanceCard({ stats }: TechnicianPerformanceCardProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  return (
    <Card
      onPress={() => router.push("/(technician)/performance" as any)}
      style={{
        padding: 24,
        marginBottom: 24,
        marginTop: 24,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Text variant="black" size={20}>
          This Month
        </Text>
        <TrendingUp size={20} color={colors.primary} />
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: isDark ? "#1f2937" : "#FAF7F2",
            borderRadius: 16,
            padding: 12,
            borderWidth: 1,
            borderColor: isDark ? "#374151" : "#f3f0e9",
          }}
        >
          <Text
            variant="black"
            size={20}
            style={{
              color: colors.primary,
            }}
          >
            {stats.totalInsemMonth || "0"}
          </Text>
          <Text
            variant="bold"
            color="secondary"
            size={10}
            style={{
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            AI Sessions
          </Text>
          <Text
            variant="medium"
            color="muted"
            size={9}
            style={{
              marginTop: 4,
            }}
          >
            Target: 50 visits
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: isDark ? "#1f2937" : "#FAF7F2",
            borderRadius: 16,
            padding: 12,
            borderWidth: 1,
            borderColor: isDark ? "#374151" : "#f3f0e9",
          }}
        >
          <Text
            variant="black"
            size={20}
            style={{
              color: colors.primary,
            }}
          >
            {stats.successRate || "78%"}
          </Text>
          <Text
            variant="bold"
            color="secondary"
            size={10}
            style={{
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            Conception
          </Text>
          <Text
            variant="medium"
            size={9}
            style={{
              color: isDark ? "#34d399" : "#059669",
              marginTop: 4,
            }}
          >
            High Efficiency
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: isDark ? "#1f2937" : "#FAF7F2",
            borderRadius: 16,
            padding: 12,
            borderWidth: 1,
            borderColor: isDark ? "#374151" : "#f3f0e9",
          }}
        >
          <Text
            variant="black"
            size={20}
            style={{
              color: colors.primary,
            }}
          >
            34
          </Text>
          <Text
            variant="bold"
            color="secondary"
            size={10}
            style={{
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            Farms Served
          </Text>
          <Text
            variant="medium"
            color="muted"
            size={9}
            style={{
              marginTop: 4,
            }}
          >
            8 Oton Barangays
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Text variant="bold" color="secondary" size={11}>
          Target Progress
        </Text>
        <Text
          variant="extrabold"
          size={11}
          style={{
            color: colors.primary,
          }}
        >
          36 / 50 Sessions (72%)
        </Text>
      </View>

      <View
        style={{
          height: 8,
          backgroundColor: isDark ? "#374151" : "#f1f5f9",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: "72%",
            height: "100%",
            backgroundColor: colors.primary,
            borderRadius: 4,
          }}
        />
      </View>
    </Card>
  );
}
