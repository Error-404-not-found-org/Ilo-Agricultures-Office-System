import React from "react";
import { View, FlatList, TouchableOpacity, RefreshControl, Image } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, PlusCircle } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { ScreenLayout } from "@/components/ScreenLayout";

import { useTechnicianAnimals } from "../hooks/useTechnicianAnimals";
import { SearchBar, AsyncState, Pagination } from "@/components/shared";
import { AnimalListCard } from "../components/AnimalListCard";

export default function TechnicianAnimalsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, themeStyle } = useTheme();

  const {
    searchQuery,
    setSearchQuery,
    page,
    animals,
    total,
    totalPages,
    isLoading,
    isRefetching,
    handleRefresh,
    goToPage,
  } = useTechnicianAnimals();

  return (
    <ScreenLayout edges={[]}>

      {/* Premium Header Overlay */}
      <View
        style={{
          backgroundColor: isDark ? "#064e3e" : "#00643B",
          paddingBottom: 80,
          borderBottomLeftRadius: 40,
          borderBottomRightRadius: 40,
          paddingHorizontal: 24,
          paddingTop: insets.top + 20,
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>

            <Text variant="black" size={24} style={{ color: "#fff" }}>
              Animal Registry
            </Text>
          </View>
          <TouchableOpacity
           onPress={() => router.push("/(technician)/register-animal" as any)}
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <PlusCircle size={16} color="#fff" />
            <Text variant="bold" size={13} style={{ color: "#fff" }}>
              Register
            </Text>
          </TouchableOpacity>
        </View>

        {/* Moowie Herd Manager Sub-Banner Container */}
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: 24,
            padding: 16,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          <View style={{ width: 60, height: 60 }}>
            <Image
              source={{
                uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png",
              }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="extrabold" size={14} style={{ color: "#fff" }}>
              Moowie Herd Manager
            </Text>
            <Text
              variant="medium"
              size={11}
              style={{
                color: "rgba(255,255,255,0.8)",
                lineHeight: 15,
                marginTop: 2,
              }}
            >
              Tracking {total} animals across the district. Use the search to
              find specific ear tags or owners! 🔎
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, marginTop: -40, paddingHorizontal: 20 }}>
        {/* Search Bar Input Container */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search tag, species, or owner..."
        />

        {/* Animals FlatList Container */}
        <FlatList
          data={animals}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => <AnimalListCard item={item} />}
          ListEmptyComponent={
            isLoading ? (
              <AsyncState state="loading" />
            ) : (
              <AsyncState
                state="empty"
                title="No animals found"
                message="Try searching for a different ear tag, breed, or owner."
              />
            )
          }
          ListFooterComponent={
            <Pagination
              page={page}
              totalPages={totalPages}
              onPrevious={() => goToPage(page - 1)}
              onNext={() => goToPage(page + 1)}
            />
          }
        />
      </View>
    </ScreenLayout>
  );
}
