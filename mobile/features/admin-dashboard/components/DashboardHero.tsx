import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useNetInfo } from "@react-native-community/netinfo";
import { useTheme } from "@/lib/theme";

const PRIMARY = "#1e3a5f";

export function DashboardHero() {
  const { user } = useUser();
  const router = useRouter();
  const netInfo = useNetInfo();
  const { colors, isDark } = useTheme();

  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  };
  const today = new Date().toLocaleDateString("en-GB", dateOptions);

  return (
    <View
      style={{
        backgroundColor: PRIMARY,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        paddingTop: 44,
        paddingBottom: 32,
        paddingHorizontal: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      {/* Top Bar: Profile & Sync Status */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.push("/(admin)/profile")}
            activeOpacity={0.8}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              borderWidth: 2,
              borderColor: "rgba(255, 255, 255, 0.3)",
              overflow: "hidden",
              backgroundColor: "rgba(255,255,255,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <MaterialCommunityIcons name="account" size={26} color="#93c5fd" />
            )}
          </TouchableOpacity>
          <View>
            <Text style={{ color: "#fff", fontSize: 18, fontFamily: "Outfit_700Bold" }}>
              Hello, {user?.firstName || "Admin"}
            </Text>
            <Text style={{ color: "#bfdbfe", fontSize: 11, fontFamily: "Outfit_600SemiBold", textTransform: "uppercase", letterSpacing: 1 }}>
              Administrator
            </Text>
          </View>
        </View>

        {/* Sync Status Badge */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: netInfo.isConnected ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 99,
              borderWidth: 1,
              borderColor: netInfo.isConnected ? "#10b981" : "#f59e0b",
              gap: 4,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: netInfo.isConnected ? "#10b981" : "#f59e0b",
              }}
            />
            <Text style={{ color: "#fff", fontSize: 10, fontFamily: "Outfit_700Bold" }}>
              {netInfo.isConnected ? "ONLINE" : "OFFLINE"}
            </Text>
          </View>
        </View>
      </View>

      {/* Date and Uptime Section */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <View>
          <Text style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: 10, fontFamily: "Outfit_700Bold", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Today's Date
          </Text>
          <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Outfit_600SemiBold", marginTop: 2 }}>
            {today}
          </Text>
        </View>

        {/* System Health Score Display */}
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: 10, fontFamily: "Outfit_700Bold", textTransform: "uppercase", letterSpacing: 0.5 }}>
            System Health
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <MaterialCommunityIcons name="heart-flash" size={16} color="#ef4444" />
            <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Outfit_800ExtraBold" }}>
              98%
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
