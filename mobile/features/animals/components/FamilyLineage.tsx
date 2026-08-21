import React from "react";
import { View, Image, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";

type FamilyLineageProps = {
  animal: any;
  role: "farmer" | "technician" | "admin";
};

export function FamilyLineage({ animal, role }: FamilyLineageProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const primaryColor = colors.primary;

  if (!animal?.motherId && (!animal?.offspring || animal.offspring.length === 0)) {
    return null;
  }

  const navigateToAnimal = (id: string) => {
    const basePath = role === "technician"
      ? "/(technician)/animal-details"
      : role === "admin"
        ? "/(admin)/animal-details"
        : "/(farmer)/animal-details";

    router.push({
      pathname: basePath as any,
      params: { id },
    });
  };

  return (
    <View
      className="p-5 rounded-2xl border"
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center mb-5 gap-2">
        <MaterialCommunityIcons
          name="family-tree"
          size={20}
          color={primaryColor}
        />
        <Text
          style={{
            fontFamily: "Outfit_800ExtraBold",
            color: colors.textPrimary,
          }}
          className="text-lg"
        >
          Family Lineage
        </Text>
      </View>

      <View className="gap-y-4">
        {animal.motherId && (
          <View>
            <Text
              style={{
                fontFamily: "Outfit_900Black",
                color: colors.textMuted,
              }}
              className="text-[9px] uppercase tracking-widest mb-2 ml-1"
            >
              Mother (Dam)
            </Text>
            <TouchableOpacity
              onPress={() => navigateToAnimal(animal.motherId._id || animal.motherId)}
              className="flex-row items-center justify-between p-3 rounded-2xl border"
              style={{
                backgroundColor: isDark ? colors.background : "#f8fafc",
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center border"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  {animal.motherId.imageUrl ? (
                    <Image
                      source={{ uri: animal.motherId.imageUrl }}
                      className="w-full h-full rounded-xl"
                      resizeMode="cover"
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="cow"
                      size={20}
                      color={primaryColor}
                    />
                  )}
                </View>
                <View>
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: colors.textPrimary,
                    }}
                    className="text-sm"
                  >
                    Tag {animal.motherId.earTag || "not recorded"}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_500Medium",
                      color: colors.textSecondary,
                    }}
                    className="text-[10px] uppercase mt-0.5"
                  >
                    {animal.motherId.breed} • {animal.motherId.species}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-1">
                <View className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <Text
                    style={{
                      fontFamily: "Outfit_900Black",
                      color: "#10b981",
                    }}
                    className="text-[8px] uppercase tracking-wider"
                  >
                    {animal.motherId.reproductiveStatus || "Normal"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {animal.offspring && animal.offspring.length > 0 && (
          <View>
            <Text
              style={{
                fontFamily: "Outfit_900Black",
                color: colors.textMuted,
              }}
              className="text-[9px] uppercase tracking-widest mb-2 ml-1"
            >
              Offspring ({animal.offspring.length})
            </Text>
            <View className="gap-y-2">
              {animal.offspring.map((calf: any) => (
                <TouchableOpacity
                  key={calf._id}
                  onPress={() => navigateToAnimal(calf._id)}
                  className="flex-row items-center justify-between p-3 rounded-2xl border"
                  style={{
                    backgroundColor: isDark ? colors.background : "#f8fafc",
                    borderColor: colors.border,
                  }}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className="w-10 h-10 rounded-xl items-center justify-center border"
                      style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      }}
                    >
                      {calf.imageUrl ? (
                        <Image
                          source={{ uri: calf.imageUrl }}
                          className="w-full h-full rounded-xl"
                          resizeMode="cover"
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name="cow"
                          size={20}
                          color={primaryColor}
                        />
                      )}
                    </View>
                    <View>
                      <Text
                        style={{
                          fontFamily: "Outfit_800ExtraBold",
                          color: colors.textPrimary,
                        }}
                        className="text-sm"
                      >
                        Tag {calf.earTag || "not recorded"}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textSecondary,
                        }}
                        className="text-[10px] uppercase mt-0.5"
                      >
                        {calf.gender === "Male" ? "Male ♂" : "Female ♀"} • {calf.breed}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <View
                      className="px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: colors.border }}
                    >
                      <Text
                        style={{
                          fontFamily: "Outfit_800ExtraBold",
                          color: colors.textSecondary,
                        }}
                        className="text-[10px]"
                      >
                        {new Date(calf.birthDate).getFullYear() || ""}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
