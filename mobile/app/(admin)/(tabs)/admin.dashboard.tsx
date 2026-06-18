import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Users, Syringe, Search, UserPlus } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import { useApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';

const PRIMARY = '#1e3a5f';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const api = useApi();
  const { isSignedIn, isLoaded } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const res = await api.get('/admin/stats');
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
  });

  return (
    <View className="flex-1 bg-[#F0F4FF] dark:bg-slate-950">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero Header */}
        <View
          className="pb-28 shadow-md z-0"
          style={{ backgroundColor: PRIMARY, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
        >
          <Header />
          {/* Search Bar */}
          <View className="px-6 mt-2">
            <View className="flex-row items-center bg-[#162d4a] rounded-full px-4 py-3.5 border border-[#2c4f7c]">
              <Search size={20} color="#93c5fd" />
              <TextInput
                placeholder="Search users or animals..."
                placeholderTextColor="#bfdbfe"
                className="flex-1 text-white ml-3 text-[15px] font-medium"
              />
            </View>
          </View>
        </View>

        {/* Stats Card */}
        <View className="px-6 -mt-16 z-10 w-full mb-8">
          <View className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-sm border border-gray-100 dark:border-slate-700">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-slate-800 dark:text-white font-bold text-base">System Overview</Text>
              <View className="bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800">
                <Text style={{ color: PRIMARY }} className="text-xs font-bold tracking-wide">Live</Text>
              </View>
            </View>

            {isLoading ? (
              <ActivityIndicator size="large" color={PRIMARY} />
            ) : (
              <View className="flex-row flex-wrap gap-y-6">
                <StatBox label="Total Users" value={stats?.totalUsers ?? '—'} color="#2563EB" />
                <StatBox label="Farmers" value={stats?.farmers ?? '—'} color="#16a34a" />
                <StatBox label="Technicians" value={stats?.technicians ?? '—'} color="#d97706" />
                <StatBox label="Animals" value={stats?.animals ?? '—'} color="#7c3aed" />
                <StatBox label="Inseminations" value={stats?.inseminations ?? '—'} color="#db2777" />
                <StatBox label="Pregnancies" value={stats?.pregnancies ?? '—'} color="#0891b2" />
              </View>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-6 mb-8">
          <Text className="text-slate-800 dark:text-white font-bold text-[17px] mb-4">Quick Actions</Text>
          <View className="flex-row justify-between">
            <ActionCategory
              title={'All\nUsers'}
              icon={<Users size={28} color="#2563EB" />}
              iconBg="#EFF6FF"
              onPress={() => router.push('/(admin)/admin.users' as any)}
            />
            <ActionCategory
              title={'All\nAnimals'}
              icon={<MaterialCommunityIcons name="cow" size={28} color="#7c3aed" />}
              iconBg="#F5F3FF"
              onPress={() => router.push('/(admin)/admin.animals' as any)}
            />
            <ActionCategory
              title={'Create\nUser'}
              icon={<UserPlus size={28} color="#dc2626" />}
              iconBg="#FEF2F2"
              onPress={() => router.push('/(admin)/create-user' as any)}
            />
            <ActionCategory
              title={'Records'}
              icon={<Syringe size={28} color="#0891b2" />}
              iconBg="#ECFEFF"
              onPress={() => router.push('/(admin)/admin.records' as any)}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const StatBox = ({ label, value, color }: { label: string; value: any; color: string }) => (
  <View className="w-1/3 items-center mb-2">
    <Text style={{ color }} className="text-3xl font-black">{value}</Text>
    <Text className="text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-widest font-bold mt-0.5">{label}</Text>
  </View>
);

const ActionCategory = ({ title, icon, iconBg, onPress }: { title: string; icon: React.ReactNode; iconBg: string; onPress?: () => void }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    className="flex-1 bg-white dark:bg-slate-800 rounded-[20px] pt-4 pb-3 px-1 items-center border border-gray-100 dark:border-slate-700 shadow-sm mx-1"
    style={{ elevation: 2, shadowColor: '#94a3b8', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
    onPress={onPress}
  >
    <View className="w-12 h-12 rounded-full items-center justify-center mb-2" style={{ backgroundColor: iconBg }}>
      {icon}
    </View>
    <Text className="text-slate-700 dark:text-slate-200 text-[9.5px] font-bold text-center leading-3">
      {title.split('\n').map((line, i) => (
        <Text key={i}>{line}{i === 0 ? '\n' : ''}</Text>
      ))}
    </Text>
  </TouchableOpacity>
);
