import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar, Info, ChevronRight } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { format } from 'date-fns';

const PRIMARY = '#00643B';

export default function BreedingCalendar() {
  const router = useRouter();
  const api = useApi();

  const { data: milestones, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['breeding-milestones'],
    queryFn: async () => {
      const res = await api.get('/user/milestones');
      return res.data;
    }
  });

  return (
    <View className="flex-1 bg-[#F9FAFB] dark:bg-slate-950">
      {/* Header */}
      <View className="pt-14 pb-6 px-6 bg-white dark:bg-slate-800 shadow-sm flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-slate-50 dark:bg-slate-700 rounded-full">
          <ArrowLeft size={20} color={PRIMARY} />
        </TouchableOpacity>
        <Text className="text-lg font-black text-slate-800 dark:text-white">Breeding Calendar</Text>
        <View className="w-10" />
      </View>

      <ScrollView 
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={PRIMARY} />
        }
      >
        {/* Info Box */}
        <View className="mt-6 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-3xl border border-emerald-100 dark:border-emerald-800 flex-row items-start">
            <Info size={18} color={PRIMARY} style={{ marginTop: 2 }} />
            <Text className="ml-3 flex-1 text-[13px] leading-5 text-emerald-900 dark:text-emerald-100 font-medium">
                This timeline shows upcoming milestones based on recorded inseminations and pregnancy checks.
            </Text>
        </View>

        <Text className="mt-8 mb-4 text-slate-500 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">Upcoming Events</Text>

        {isLoading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text className="mt-4 text-slate-400 dark:text-slate-500 font-medium">Calculating milestones...</Text>
          </View>
        ) : milestones?.length > 0 ? (
          milestones.map((item: any, idx: number) => (
            <MilestoneCard key={idx} item={item} onPress={() => router.push(`/(farmer)/animal-details?id=${item.animal._id}`)} />
          ))
        ) : (
          <View className="py-20 items-center bg-white dark:bg-slate-800 rounded-[32px] border border-slate-50 dark:border-slate-700 mt-4">
            <Calendar size={48} color="#CBD5E1" />
            <Text className="mt-4 text-slate-700 dark:text-white font-bold text-lg">No Milestones Yet</Text>
            <Text className="mt-2 text-slate-400 dark:text-slate-500 text-center px-8 text-sm">
                Register an insemination to start tracking breeding milestones here.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const MilestoneCard = ({ item, onPress }: { item: any, onPress: () => void }) => {
  const isHighPriority = item.priority === 'high';
  const iconName = item.type === 'calving' ? 'baby-carriage' : item.type === 'heat_check' ? 'fire' : 'medical-bag';
  const iconColor = item.type === 'calving' ? '#00643B' : item.type === 'heat_check' ? '#EF4444' : '#3B82F6';
  const colorScheme = useColorScheme();

  return (
    <TouchableOpacity 
      onPress={onPress}
      className="bg-white dark:bg-slate-800 p-5 rounded-[28px] mb-4 border border-slate-50 dark:border-slate-700 flex-row items-center"
      style={{ elevation: 2, shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 8 }}
    >
      <View className="w-14 h-14 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: item.type === 'calving' ? (colorScheme === 'dark' ? '#064e3b' : '#ECFDF5') : item.type === 'heat_check' ? (colorScheme === 'dark' ? '#7f1d1d' : '#FEF2F2') : (colorScheme === 'dark' ? '#1e3a8a' : '#EFF6FF') }}>
        <MaterialCommunityIcons name={iconName} size={26} color={iconColor} />
      </View>
      
      <View className="flex-1">
        <View className="flex-row justify-between items-start mb-1">
          <Text className="font-black text-slate-800 dark:text-white text-base">{item.title}</Text>
          <View className={`px-2 py-0.5 rounded-full ${isHighPriority ? 'bg-red-50 dark:bg-red-900/30' : 'bg-slate-50 dark:bg-slate-700'}`}>
            <Text className={`text-[9px] font-black uppercase tracking-widest ${isHighPriority ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {item.daysLeft <= 0 ? 'Today' : `${item.daysLeft}d left`}
            </Text>
          </View>
        </View>
        
        <Text className="text-slate-500 dark:text-slate-400 font-bold text-xs mb-2">Tag: #{item.animal?.earTag || 'N/A'}</Text>
        
        <View className="flex-row items-center gap-2">
            <Calendar size={12} color="#94a3b8" />
            <Text className="text-slate-400 dark:text-slate-500 text-[11px] font-bold">
                {format(new Date(item.date), 'MMM d, yyyy')}
            </Text>
        </View>
      </View>
      
      <ChevronRight size={20} color="#CBD5E1" />
    </TouchableOpacity>
  );
};
