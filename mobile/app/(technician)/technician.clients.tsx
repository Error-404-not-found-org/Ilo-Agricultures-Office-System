import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Header from "@/components/Header";
import { Search, MapPin, Phone } from "lucide-react-native";
import React, { useState, useMemo } from "react";
import { useApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";

export default function ClientsScreen() {
  const router = useRouter();
  const api = useApi();
  const { isSignedIn, isLoaded } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  // ✅ Fetch clients safely
  const {
    data: clients = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["clients"],
    enabled: isLoaded && isSignedIn, // ✅ wait for auth to load
    queryFn: async () => {
      const res = await api.get("/user?role=farmer");

      if (Array.isArray(res.data)) return res.data;
      if (Array.isArray(res.data.data)) return res.data.data;

      return [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // ✅ Address formatter
  const getAddressString = (address: any): string => {
    if (!address) return "";
    return [
      address.houseNumber,
      address.street,
      address.subdivision,
      address.barangay,
      address.city,
      address.province,
    ]
      .filter(Boolean)
      .join(", ");
  };

  // ✅ Optimized filtering
  const filteredClients = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return clients;

    return clients.filter((c: any) => {
      const nameMatch = c.name?.toLowerCase().includes(query);
      const addrMatch = getAddressString(c.address)
        .toLowerCase()
        .includes(query);

      return nameMatch || addrMatch;
    });
  }, [clients, searchQuery]);

  // ✅ Header UI
  const renderHeader = () => (
    <View className="mb-6">
      <Text className="text-[24px] font-bold text-slate-800 mb-6">
        Client Management
      </Text>

      <View className="flex-row gap-x-4 mb-8">
        <TouchableOpacity
          onPress={() => router.push("/clients/register-client")}
          className="flex-1 bg-white rounded-2xl p-4 border border-slate-100 items-center justify-center shadow-sm"
        >
          <View className="w-12 h-12 bg-emerald-50 rounded-full items-center justify-center mb-3">
            <MaterialCommunityIcons
              name="account-plus"
              size={24}
              color="#00643B"
            />
          </View>
          <Text className="font-bold text-slate-800 text-sm">New Client</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/clients/add-animal")}
          className="flex-1 bg-white rounded-2xl p-4 border border-slate-100 items-center justify-center shadow-sm"
        >
          <View className="w-12 h-12 bg-blue-50 rounded-full items-center justify-center mb-3">
            <MaterialCommunityIcons name="cow" size={24} color="#3B82F6" />
          </View>
          <Text className="font-bold text-slate-800 text-sm">Add Animal</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-[18px] font-bold text-slate-800 mb-4">
        All Clients
      </Text>

      <View className="flex-row items-center bg-white rounded-2xl px-4 h-[52px] mb-2 border border-slate-100 shadow-sm">
        <Search size={20} color="#94a3b8" />
        <TextInput
          placeholder="Search clients..."
          className="flex-1 ml-3 text-[15px] font-medium text-slate-800"
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
    </View>
  );

  // ✅ WAIT for auth to load
  if (!isLoaded) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#00643B" />
        <Text className="mt-2 text-gray-500">Initializing...</Text>
      </View>
    );
  }

  // ❌ Not signed in
  if (!isSignedIn) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-red-500 font-semibold">
          You must be signed in
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <StatusBar barStyle="light-content" />
      <View className="absolute top-0 left-0 right-0 h-[220px] bg-[#00643B]" />

      <Header />

      <View
        className="flex-1 bg-[#F9FAFB] rounded-t-[32px] px-6 pt-8 mt-2 shadow-lg"
        style={{ elevation: 8 }}
      >
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#00643B" />
          </View>
        ) : isError ? (
          <View className="flex-1 justify-center items-center px-6">
            <Text className="text-red-500 font-semibold text-center mb-2">
              Failed to load clients
            </Text>
            <Text className="text-gray-400 text-sm text-center">
              {(error as any)?.message || "Unknown error"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredClients}
            keyExtractor={(item, index) =>
              item._id ? item._id.toString() : index.toString()
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListHeaderComponent={renderHeader}
            removeClippedSubviews
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            ListEmptyComponent={() => (
              <View className="items-center justify-center py-10">
                <Text className="text-gray-400">No clients found.</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <View className="bg-white rounded-[24px] p-5 mb-4 border border-slate-100 shadow-sm">
                <View className="flex-row items-center gap-3 mb-4">
                  <View className="w-12 h-12 bg-emerald-100 rounded-full items-center justify-center">
                    <Text className="text-emerald-800 font-black text-lg">
                      {item.name?.charAt(0)?.toUpperCase() || "?"}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[17px] font-bold text-slate-800">
                      {item.name || "No Name"}
                    </Text>
                    <View className="px-2 py-0.5 rounded-full bg-emerald-50 self-start mt-1">
                      <Text className="text-[10px] font-bold text-emerald-700 uppercase">
                        Farmer
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="gap-y-2 ml-1">
                  {item.address?.phoneNumber && (
                    <View className="flex-row items-center gap-3">
                      <Phone size={14} color="#94a3b8" />
                      <Text className="text-slate-600 text-[13px]">
                        {item.address.phoneNumber}
                      </Text>
                    </View>
                  )}

                  {item.address && (
                    <View className="flex-row items-start gap-3 pr-4">
                      <MapPin
                        size={14}
                        color="#94a3b8"
                        style={{ marginTop: 2 }}
                      />
                      <Text className="text-slate-600 text-[13px] leading-5">
                        {getAddressString(item.address)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}