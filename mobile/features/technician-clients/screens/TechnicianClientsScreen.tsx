import React from "react";
import { View, FlatList, TouchableOpacity, RefreshControl, Image } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, UserPlus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { ScreenLayout } from "@/components/ScreenLayout";
import { useTechnicianClients } from "../hooks/useTechnicianClients";
import { SearchBar, FilterChips, AsyncState, Pagination } from "@/components/shared";
import { ClientListCard } from "../components/ClientListCard";
import { BarangayFilter } from "../components/BarangayFilter";
import { Skeleton } from "@/components/ui/Skeleton";

function ClientListSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {[1, 2, 3, 4].map((key) => (
        <View
          key={key}
          style={{
            padding: 16,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Skeleton shape="circle" height={48} style={{ marginRight: 16 }} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="60%" height={16} radius={4} />
              <Skeleton width="40%" height={12} radius={4} />
            </View>
            <Skeleton width={80} height={20} radius={8} />
          </View>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", gap: 16, flex: 1 }}>
              <Skeleton width="30%" height={14} radius={4} />
              <Skeleton width="30%" height={14} radius={4} />
            </View>
            <Skeleton shape="circle" height={32} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function TechnicianClientsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, themeStyle } = useTheme();

  const {
    searchQuery,
    setSearchQuery,
    selectedBarangay,
    setSelectedBarangay,
    page,
    clients,
    total,
    totalPages,
    isLoading,
    isRefetching,
    handleRefresh,
    goToPage,
  } = useTechnicianClients();

  return (
    <ScreenLayout edges={[]}>

      {/* Premium Header Container */}
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
              Farmers
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(technician)/register-client" as any)}
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
            <UserPlus size={16} color="#fff" />
            <Text variant="bold" size={13} style={{ color: "#fff" }}>
              New Farmer
            </Text>
          </TouchableOpacity>
        </View>

        {/* Moowie Client Relations Header Banner Info Block */}
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
              Moowie Farmer Relations
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
              Managing {total} registered farmers. Keep their contact details
              updated for service notifications! 👨‍🌾
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, marginTop: -40, paddingHorizontal: 20 }}>
        {/* Search Bar Input Container */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search farmer by name or email..."
        />

        {/* Barangay Filter Dropdown */}
        <View style={{ marginBottom: 16, flexDirection: "row" }}>
          <BarangayFilter
            selectedBarangay={selectedBarangay}
            setSelectedBarangay={setSelectedBarangay}
          />
        </View>

        {/* Farmers FlatList Container */}
        {isLoading ? (
          <ClientListSkeleton />
        ) : (
          <FlatList
            data={clients}
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
            renderItem={({ item }) => <ClientListCard item={item} />}
            ListEmptyComponent={
              <AsyncState
                state="empty"
                title="No farmers found"
                message="Try searching for a different name or changing the barangay filter."
              />
            }
            ListFooterComponent={
              totalPages > 1 ? (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPrevious={() => goToPage(page - 1)}
                  onNext={() => goToPage(page + 1)}
                />
              ) : null
            }
          />
        )}
      </View>
    </ScreenLayout>
  );
}
