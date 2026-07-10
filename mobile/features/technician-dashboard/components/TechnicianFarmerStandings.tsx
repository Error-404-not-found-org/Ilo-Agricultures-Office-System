import React from "react";
import { View, TouchableOpacity, TextInput, ActivityIndicator, Image, Linking } from "react-native";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { useTheme } from "@/lib/theme";
import { Search, Phone } from "lucide-react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface TechnicianFarmerStandingsProps {
  loadingClients: boolean;
  clientsData: any;
  farmerSearch: string;
  setFarmerSearch: (val: string) => void;
}

export function TechnicianFarmerStandings({
  loadingClients,
  clientsData,
  farmerSearch,
  setFarmerSearch,
}: TechnicianFarmerStandingsProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  return (
    <Card
      style={{
        padding: 24,
        marginBottom: 24,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <Text variant="black" size={18}>
          Farmer Standings
        </Text>
        <TouchableOpacity
          onPress={() =>
            router.push("/(technician)/technician.clients" as any)
          }
        >
          <Text
            variant="extrabold"
            size={13}
            style={{
              color: colors.primary,
            }}
          >
            View all
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Inner Bar */}
      <View
        style={{
          backgroundColor: isDark ? "#1f2937" : "#FAF7F2",
          borderRadius: 16,
          padding: 12,
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 20,
          borderWidth: 1,
          borderColor: isDark ? "#374151" : "#f3f0e9",
        }}
      >
        <Search size={18} color={colors.textMuted} />
        <TextInput
          placeholder="Search farmer or address..."
          placeholderTextColor={colors.textMuted}
          value={farmerSearch}
          onChangeText={setFarmerSearch}
          style={{
            flex: 1,
            marginLeft: 10,
            fontFamily: "Outfit_600SemiBold",
            fontSize: 13,
            color: colors.textPrimary,
          }}
        />
      </View>

      <View style={{ gap: 12 }}>
        {loadingClients ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginVertical: 12 }}
          />
        ) : (
          (clientsData?.data || [])
            .filter((farmer: any) => {
              if (!farmerSearch) return true;
              const addr =
                typeof farmer.address === "string"
                  ? farmer.address
                  : farmer.address?.barangay || "";
              return (
                farmer.name
                  ?.toLowerCase()
                  .includes(farmerSearch.toLowerCase()) ||
                addr.toLowerCase().includes(farmerSearch.toLowerCase())
              );
            })
            .slice(0, 3)
            .map((farmer: any) => (
              <FarmerCompactCard
                key={farmer._id}
                id={farmer._id}
                name={farmer.name}
                location={
                  typeof farmer.address === "string"
                    ? farmer.address
                    : [
                        farmer.address?.barangay,
                        farmer.address?.city,
                      ].filter(Boolean).join(", ") || "Location not set"
                }
                phone={farmer.phone}
                imageUrl={farmer.imageUrl}
                totalAnimals={farmer.totalAnimals}
                pregnantCount={farmer.pregnantCount}
                insemCount={farmer.insemCount}
                normalCount={farmer.normalCount}
                router={router}
              />
            ))
        )}
        {!loadingClients && (clientsData?.data || []).length === 0 && (
          <View style={{ paddingVertical: 12, alignItems: "center" }}>
            <Text variant="bold" color="muted" size={13}>
              No assigned farmers yet
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const FarmerCompactCard = ({
  id,
  name,
  location,
  phone,
  imageUrl,
  totalAnimals,
  pregnantCount,
  insemCount,
  normalCount,
  router,
}: any) => {
  const { colors, isDark } = useTheme();
  return (
    <Card
      onPress={() => router.push(`/(technician)/client.profile?id=${id}`)}
      style={{ marginBottom: 12 }}
    >
      {/* Top Row: Profile, Info, and Call Button */}
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: isDark ? "#1f2937" : "#FAF7F2",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <MaterialCommunityIcons
              name="account"
              size={28}
              color={colors.primary}
            />
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text variant="black" size={15}>
            {name}
          </Text>
          <Text
            variant="semibold"
            color="muted"
            size={11}
            style={{ marginTop: 1 }}
          >
            {location} ·{" "}
            <Text
              variant="extrabold"
              size={11}
              style={{ color: colors.primary }}
            >
              {totalAnimals || 0} head
            </Text>
          </Text>
        </View>

        {phone && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              Linking.openURL(`tel:${phone}`);
            }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: isDark ? "#064e3b" : "#f0fdf4",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: isDark ? "#047857" : "#dcfce7",
            }}
          >
            <Phone size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom Row: High-fidelity status badges */}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          flexWrap: "wrap",
          paddingTop: 4,
        }}
      >
        <View
          style={{
            backgroundColor: isDark ? "#1e3a8a" : "#eff6ff",
            borderRadius: 10,
            paddingVertical: 4,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            borderWidth: 0.5,
            borderColor: isDark ? "#1d4ed8" : "#dbeafe",
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: isDark ? "#60a5fa" : "#3b82f6",
            }}
          />
          <Text
            variant="bold"
            size={10}
            style={{
              color: isDark ? "#60a5fa" : "#1d4ed8",
            }}
          >
            Pregnant: {pregnantCount || 0}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: isDark ? "#064e3b" : "#f0fdf4",
            borderRadius: 10,
            paddingVertical: 4,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            borderWidth: 0.5,
            borderColor: isDark ? "#047857" : "#dcfce7",
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: isDark ? "#34d399" : "#10b981",
            }}
          />
          <Text
            variant="bold"
            size={10}
            style={{
              color: isDark ? "#34d399" : "#047857",
            }}
          >
            Normal: {normalCount || 0}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: isDark ? "#78350f" : "#fffbeb",
            borderRadius: 10,
            paddingVertical: 4,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            borderWidth: 0.5,
            borderColor: isDark ? "#b45309" : "#fef3c7",
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: isDark ? "#fbbf24" : "#eab308",
            }}
          />
          <Text
            variant="bold"
            size={10}
            style={{
              color: isDark ? "#fbbf24" : "#b45309",
            }}
          >
            A.I.: {insemCount || 0}
          </Text>
        </View>
      </View>
    </Card>
  );
};
