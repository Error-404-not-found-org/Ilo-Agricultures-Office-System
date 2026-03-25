import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Header from '@/components/Header';
import { Search, Mail, Shield } from 'lucide-react-native';
import React, { useState, useMemo, useCallback } from 'react';
import { useApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';

const PRIMARY = '#1e3a5f';

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: '#FEF3C7', text: '#92400e' },
  technician: { bg: '#DBEAFE', text: '#1d4ed8' },
  farmer: { bg: '#D1FAE5', text: '#065f46' },
};

const ROLE_FILTERS = ['all', 'farmer', 'technician', 'admin'];

export default function AdminUsersScreen() {
  const router = useRouter();
  const api = useApi();
  const { isSignedIn, isLoaded } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const { data: users = [], isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['admin-users'],
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const res = await api.get('/admin/list-users');
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const filteredUsers = useMemo(() => {
    let result = users;
    if (roleFilter !== 'all') {
      result = result.filter((u: any) => u.role === roleFilter);
    }
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter((u: any) =>
        u.name?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query)
      );
    }
    return result;
  }, [users, searchQuery, roleFilter]);

  const headerElement = (
    <View className="mb-4">
      <View className="flex-row justify-between items-center mb-5">
        <Text className="text-[24px] font-bold text-slate-800">All Users</Text>
        <TouchableOpacity
          onPress={() => router.push('/(admin)/create-user' as any)}
          className="bg-blue-600 px-4 py-2 rounded-full flex-row items-center gap-2"
        >
          <MaterialCommunityIcons name="account-plus" size={16} color="white" />
          <Text className="text-white font-bold text-xs">Create User</Text>
        </TouchableOpacity>
      </View>

      {/* Role Filter Chips */}
      <View className="flex-row gap-x-2 mb-4">
        {ROLE_FILTERS.map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => setRoleFilter(r)}
            className={`px-3 py-1.5 rounded-full border ${roleFilter === r ? 'bg-[#1e3a5f] border-[#1e3a5f]' : 'bg-white border-slate-200'}`}
          >
            <Text className={`text-xs font-bold capitalize ${roleFilter === r ? 'text-white' : 'text-slate-500'}`}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View className="flex-row items-center bg-white rounded-2xl px-4 h-[52px] mb-2 border border-slate-100 shadow-sm">
        <Search size={20} color="#94a3b8" />
        <TextInput
          placeholder="Search by name or email..."
          className="flex-1 ml-3 text-[15px] font-medium text-slate-800"
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-[#F0F4FF]">
      <StatusBar barStyle="light-content" />
      <View className="absolute top-0 left-0 right-0 h-[220px]" style={{ backgroundColor: PRIMARY }} />
      <Header />

      <View className="flex-1 bg-[#F0F4FF] rounded-t-[32px] px-6 pt-8 mt-2 shadow-lg" style={{ elevation: 8 }}>
        <FlatList
          data={isLoading ? [] : filteredUsers}
          keyExtractor={(item, index) => item._id?.toString() || index.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[PRIMARY]} tintColor={PRIMARY} />
          }
          ListHeaderComponent={headerElement}
          ListEmptyComponent={() => (
            <View className="items-center justify-center py-10">
              {isLoading ? (
                <ActivityIndicator size="large" color={PRIMARY} />
              ) : isError ? (
                <Text className="text-red-500 text-center">Failed to load users.</Text>
              ) : (
                <Text className="text-gray-400">No users found.</Text>
              )}
            </View>
          )}
          renderItem={({ item }) => {
            const roleStyle = ROLE_COLORS[item.role] || ROLE_COLORS.farmer;
            return (
              <View className="bg-white rounded-[24px] p-5 mb-4 border border-slate-100 shadow-sm">
                {/* Header Row */}
                <View className="flex-row items-center gap-3 mb-3">
                  <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: roleStyle.bg }}>
                    <Text style={{ color: roleStyle.text }} className="font-black text-lg">
                      {item.name?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[17px] font-bold text-slate-800">{item.name || 'No Name'}</Text>
                    <View className="flex-row items-center gap-2 mt-1">
                      <View className="px-2 py-0.5 rounded-full self-start" style={{ backgroundColor: roleStyle.bg }}>
                        <Text style={{ color: roleStyle.text }} className="text-[10px] font-bold uppercase tracking-widest">
                          {item.role}
                        </Text>
                      </View>
                      {item.isVerified && (
                        <View className="px-2 py-0.5 rounded-full bg-emerald-50 self-start">
                          <Text className="text-emerald-700 text-[10px] font-bold">✓ Verified</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Credential Info */}
                <View className="gap-y-1.5 ml-1 p-3 bg-slate-50 rounded-2xl">
                  <View className="flex-row items-center gap-2">
                    <Mail size={13} color="#94a3b8" />
                    <Text className="text-slate-600 text-[13px]">{item.email || 'No email'}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Shield size={13} color="#94a3b8" />
                    <Text className="text-slate-500 text-[13px]">clerkId: <Text className="font-mono text-slate-700">{item.clerkId || 'Not synced'}</Text></Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <MaterialCommunityIcons name="clock-outline" size={13} color="#94a3b8" />
                    <Text className="text-slate-500 text-[13px]">
                      Created: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <MaterialCommunityIcons name="circle-outline" size={13} color="#94a3b8" />
                    <Text className="text-slate-500 text-[13px]">Status: <Text className="font-semibold text-slate-700">{item.status || 'active'}</Text></Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      </View>
    </View>
  );
}
