import React from "react";
import { View, Image } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/features/farmer-ui/components";
import { Animal } from "../types/technicianAnimals.types";

interface AnimalListCardProps {
  item: Animal;
}

export function AnimalListCard({ item }: AnimalListCardProps) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Card
      onPress={() =>
        router.push(
          `/(technician)/animal-details?id=${item._id}` as any
        )
      }
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
      }}
    >
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <MaterialCommunityIcons
            name="cow"
            size={28}
            color={colors.textSecondary}
          />
        )}
      </View>

      <View style={{ flex: 1, marginLeft: 16 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text
            variant="bold"
            size={16}
            style={{ color: colors.textPrimary, flex: 1 }}
            numberOfLines={1}
          >
            Tag #{item.earTag || item.animalId || "N/A"}
          </Text>
          {item.reproductiveStatus ? (
            <StatusBadge label={item.reproductiveStatus} />
          ) : null}
        </View>

        <Text
          variant="medium"
          size={12}
          style={{ color: colors.textSecondary, marginTop: 2 }}
        >
          {item.species || "Cattle"} • {item.breed || "Unknown Breed"}
        </Text>
        <Text
          variant="medium"
          size={12}
          style={{ color: colors.textSecondary }}
        >
          Owner: {item.farmerId?.name || item.farmer || "Unknown Owner"}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.textMuted} style={{ marginLeft: 8 }} />
    </Card>
  );
}
