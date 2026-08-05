import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useNetInfo } from "@react-native-community/netinfo";
import { useTheme } from "@/lib/theme";
import { Bell } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { notificationKeys } from "@/lib/queryKeys";

const PRIMARY = "#1e3a5f";

export function DashboardHero() {
  const { user } = useUser();
  const router = useRouter();
  const netInfo = useNetInfo();
  const { colors, isDark } = useTheme();
  const api = useApi();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const response = await api.get("/notifications/unread-count");
      return response.data;
    },
    enabled: !!user,
  });
  const unreadCount = unreadData?.count || 0;

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
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
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
              <Image
                source={{ uri: user.imageUrl }}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <MaterialCommunityIcons
                name="account"
                size={26}
                color="#93c5fd"
              />
            )}
          </TouchableOpacity>
          <View>
            <Text
              style={{
                color: "#fff",
                fontSize: 18,
                fontFamily: "Outfit_700Bold",
              }}
            >
              Hello, {user?.firstName || "Admin"}
            </Text>
            <Text
              style={{
                color: "#bfdbfe",
                fontSize: 11,
                fontFamily: "Outfit_600SemiBold",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Administrator
            </Text>
          </View>
        </View>

      
        {/* Notifications Button */}
        <TouchableOpacity
          onPress={() => router.push("/notifications")}
          className="w-10 h-10 bg-white/10 rounded-full items-center justify-center p-0"
          activeOpacity={0.7}
        >
          <View>
            <Bell size={20} color="white" />
            {unreadCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-red-500 w-4 h-4 rounded-full border border-white items-center justify-center">
                <Text className="text-white text-[9px] font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Date and Uptime Section */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 8,
        }}
      >
        <View>
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: 10,
              fontFamily: "Outfit_700Bold",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Today's Date
          </Text>
          <Text
            style={{
              color: "#fff",
              fontSize: 14,
              fontFamily: "Outfit_600SemiBold",
              marginTop: 2,
            }}
          >
            {today}
          </Text>
        </View>
      </View>
    </View>
  );
}
