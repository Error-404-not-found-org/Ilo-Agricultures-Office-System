import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Activity, Search, Bell, MapPin, Plus } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { format } from 'date-fns';

const PRIMARY = '#00643B'; 

export default function FarmerHome() {
  const router = useRouter();
  const { user } = useUser();
  const api = useApi();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const res = await api.get('/user/me');
      return res.data;
    }
  });

  const { data: unreadCountData } = useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread-count');
      return res.data;
    },
    refetchInterval: 5000, // Poll every 5 seconds for real-time feel
  });

  const unreadCount = unreadCountData?.count || 0;

  const stats = profile?.stats || { totalAnimals: 0, cows: 0, carabaos: 0, pendingExams: 0 };
  const currentDate = format(new Date(), 'EEEE, d MMM yyyy');

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
      >

        {/* --- HERO HEADER --- */}
        <View 
            className="pt-16 pb-28 px-6 shadow-md z-0" 
            style={{ backgroundColor: PRIMARY, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
        >
          {/* Top Row: Avatar + Greeting & Bell */}
          <View className="flex-row justify-between items-center mb-6 mt-4">
            
            {/* Left side: Avatar + Greeting & Date */}
            <View className="flex-1 flex-row items-center gap-3 pr-4">
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => router.push('/(farmer)/profile')}
              >
                <View className="w-12 h-12 rounded-full border-[2px] border-white/20 items-center justify-center bg-[#005230] overflow-hidden">
                  <MaterialCommunityIcons name="account" size={26} color="#86EFAC" />
                </View>
              </TouchableOpacity>

              <View className="flex-1">
                <Text className="text-white text-[20px] font-bold tracking-tight" numberOfLines={1}>Hello, {user?.firstName || 'Farmer'}</Text>
                <Text className="text-emerald-100 text-[12px] mt-0.5 font-medium">{currentDate}</Text>
              </View>
            </View>

            {/* Right side: Bell */}
            <TouchableOpacity 
              className="w-10 h-10 bg-white/10 rounded-full items-center justify-center relative"
              activeOpacity={0.7}
              onPress={() => router.push('/notifications')}
            >
              <Bell size={20} color="white" />
              {unreadCount > 0 && (
                <View className="absolute -top-1 -right-1 bg-red-500 w-5 h-5 rounded-full items-center justify-center border-2 border-[#00643B]">
                  <Text className="text-white text-[10px] font-bold">{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="flex-row items-center bg-[#005230] rounded-full px-4 py-3.5 border border-[#007A48]">
            <Search size={20} color="#86EFAC" />
            <TextInput
              placeholder="Search your animals..."
              placeholderTextColor="#A7F3D0"
              className="flex-1 text-white ml-3 text-[15px] font-medium"
            />
          </View>
        </View>

        {/* --- OVERVIEW CARD (overlaps header) --- */}
        <View className="px-6 -mt-16 z-10 w-full mb-8">
          <View className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
            {/* Card Header */}
            <View className="flex-row justify-between items-center mb-6">
              <View className="flex-row items-center">
                <MapPin size={18} color={PRIMARY} />
                <Text className="text-slate-800 font-bold ml-1.5 text-base">My Farm Status</Text>
              </View>
              <View className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                <Text style={{ color: PRIMARY }} className="text-xs font-bold tracking-wide">Active</Text>
              </View>
            </View>

            {/* Main Stat */}
            <View className="flex-row items-baseline justify-center mb-8">
              <Text style={{ color: PRIMARY }} className="text-7xl font-black tracking-tighter leading-none">
                {isLoading ? '...' : stats.totalAnimals}
              </Text>
              <Text className="text-slate-500 font-bold ml-2 mb-1 text-xl">Animals</Text>
            </View>

            {/* Sub Stats Row */}
            <View className="flex-row justify-between border-t border-slate-50 pt-5">
              <View className="items-center flex-1">
                <Text className="text-slate-400 text-[11px] uppercase tracking-widest font-bold mb-1">Cows</Text>
                <Text className="text-slate-800 font-black text-xl">{isLoading ? '-' : stats.cows}</Text>
              </View>
              <View className="w-[1px] bg-slate-100" />
              <View className="items-center flex-1">
                <Text className="text-slate-400 text-[11px] uppercase tracking-widest font-bold mb-1">Carabaos</Text>
                <Text className="text-slate-800 font-black text-xl">{isLoading ? '-' : stats.carabaos}</Text>
              </View>
              <View className="w-[1px] bg-slate-100" />
              <View className="items-center flex-1">
                <Text className="text-slate-400 text-[11px] uppercase tracking-widest font-bold mb-1">Pending Exam</Text>
                <Text className="text-emerald-500 font-black text-xl">{isLoading ? '-' : stats.pendingExams}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* --- QUICK ACTIONS --- */}
        <View className="px-6 mb-8">
          <Text className="text-slate-800 font-bold text-[17px] mb-4">Quick Links</Text>
          <View className="flex-row justify-between">
            <ActionCategory
              title="Add\nAnimal"
              icon={<Plus size={28} color="#00643B" />}
              iconBg="#ECFDF5"
              onPress={() => router.push('/(farmer)/add-animal')}
            />
            <ActionCategory
              title="My\nRecords"
              icon={<MaterialCommunityIcons name="clipboard-text" size={28} color="#D97706" />}
              iconBg="#FFFBEB"
              onPress={() => router.push('/(farmer)/farmer.records')}
            />
            <ActionCategory
              title="Schedule\nVisit"
              icon={<Activity size={28} color="#3B82F6" />}
              iconBg="#EFF6FF"
            />
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

// --- SUB COMPONENTS ---

const ActionCategory = ({ title, icon, iconBg, onPress }: { title: string, icon: React.ReactNode, iconBg: string, onPress?: () => void }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    className="flex-1 bg-white rounded-[20px] pt-4 pb-3 px-1 items-center border border-gray-100 shadow-sm mx-1"
    style={{ elevation: 2, shadowColor: '#94a3b8', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
    onPress={onPress}
  >
    <View
      className="w-12 h-12 rounded-full items-center justify-center mb-2"
      style={{ backgroundColor: iconBg }}
    >
      {icon}
    </View>
    <Text className="text-slate-700 text-[10px] font-bold text-center leading-3">
      {title.split('\\n').map((line, i) => (
        <Text key={i}>{line}{i === 0 ? '\n' : ''}</Text>
      ))}
    </Text>
  </TouchableOpacity>
);