import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar, Info, ChevronRight } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { format } from 'date-fns';
import { useTheme } from '@/lib/theme';

export default function BreedingCalendar() {
  const router = useRouter();
  const api = useApi();
  const { colors, isDark } = useTheme();
  
  const primaryColor = isDark ? colors.primary : '#00643B';

  const { data: milestones, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['breeding-milestones'],
    queryFn: async () => {
      const res = await api.get('/user/milestones');
      const body = res.data;
      return Array.isArray(body) ? body : (body?.data || []);
    }
  });

  return (
    <View className="flex-1 bg-[#F9FAFB] dark:bg-slate-950" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="pt-14 pb-6 px-6 shadow-sm flex-row items-center justify-between" style={{ backgroundColor: colors.card }}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 items-center justify-center rounded-full"
          style={{ backgroundColor: isDark ? colors.background : '#f8fafc' }}
        >
          <ArrowLeft size={20} color={primaryColor} />
        </TouchableOpacity>
        <Text className="text-lg font-black" style={{ color: colors.textPrimary }}>Breeding Calendar</Text>
        <View className="w-10" />
      </View>

      <ScrollView 
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={primaryColor} />
        }
      >
        {/* Info Box */}
        <View 
          className="mt-6 p-4 rounded-3xl border flex-row items-start"
          style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4', borderColor: isDark ? 'transparent' : '#d1fae5' }}
        >
            <Info size={18} color={primaryColor} style={{ marginTop: 2 }} />
            <Text className="ml-3 flex-1 text-[13px] leading-5 font-medium" style={{ color: isDark ? '#a7f3d0' : '#065f46' }}>
                This timeline shows upcoming milestones based on recorded inseminations and pregnancy checks.
            </Text>
        </View>

        <Text className="mt-8 mb-4 font-bold uppercase tracking-widest text-[10px]" style={{ color: colors.textMuted }}>Upcoming Events</Text>

        {isLoading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color={primaryColor} />
            <Text className="mt-4 font-medium" style={{ color: colors.textMuted }}>Calculating milestones...</Text>
          </View>
        ) : Array.isArray(milestones) && milestones.length > 0 ? (
          milestones.map((item: any, idx: number) => (
            <MilestoneCard 
              key={idx} 
              item={item} 
              onPress={() => {
                if (item.type === 'calving' && item.daysLeft <= 0) {
                  router.push({
                    pathname: '/(farmer)/record-calving',
                    params: {
                      pregnancyId: item.relatedId,
                      animalId: item.animal._id,
                      earTag: item.animal.earTag || item.animal.animalId
                    }
                  });
                } else {
                  router.push(`/(farmer)/animal-details?id=${item.animal._id}`);
                }
              }} 
            />
          ))
        ) : (
          <View className="py-20 items-center rounded-[32px] border mt-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
            <Calendar size={48} color={colors.textMuted} />
            <Text className="mt-4 font-bold text-lg" style={{ color: colors.textPrimary }}>No Milestones Yet</Text>
            <Text className="mt-2 text-center px-8 text-sm" style={{ color: colors.textSecondary }}>
                Register an insemination to start tracking breeding milestones here.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const MilestoneCard = ({ item, onPress }: { item: any, onPress: () => void }) => {
  const { colors, isDark } = useTheme();
  const isHighPriority = item.priority === 'high';
  const iconName = item.type === 'calving' ? 'baby-carriage' : item.type === 'heat_check' ? 'fire' : 'medical-bag';
  const iconColor = item.type === 'calving' ? (isDark ? colors.primary : '#00643B') : item.type === 'heat_check' ? '#EF4444' : '#3B82F6';

  return (
    <TouchableOpacity 
      onPress={onPress}
      className="p-5 rounded-[28px] mb-4 border flex-row items-center"
      style={{ elevation: 2, shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 8, backgroundColor: colors.card, borderColor: colors.border }}
    >
      <View className="w-14 h-14 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: item.type === 'calving' ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5') : item.type === 'heat_check' ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2') : (isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF') }}>
        <MaterialCommunityIcons name={iconName} size={26} color={iconColor} />
      </View>
      
      <View className="flex-1">
        <View className="flex-row justify-between items-start mb-1">
          <Text className="font-black text-base flex-1 mr-2" style={{ color: colors.textPrimary }}>{item.title}</Text>
          <View className={`px-2 py-0.5 rounded-full`} style={{ backgroundColor: isHighPriority ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2') : (isDark ? colors.background : '#f1f5f9') }}>
            <Text className="text-[9px] font-black uppercase tracking-widest" style={{ color: isHighPriority ? '#f87171' : colors.textMuted }}>
                {item.daysLeft <= 0 ? 'Today' : `${item.daysLeft}d left`}
            </Text>
          </View>
        </View>
        
        <Text className="font-bold text-xs mb-2" style={{ color: colors.textSecondary }}>Tag: #{item.animal?.earTag || 'N/A'}</Text>
        
        <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
                <Calendar size={12} color={colors.textMuted} />
                <Text className="text-[11px] font-bold" style={{ color: colors.textMuted }}>
                    {format(new Date(item.date), 'MMM d, yyyy')}
                </Text>
            </View>
            
            {item.type === 'calving' && item.daysLeft <= 0 && (
                <View className="px-2 py-1 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }}>
                    <Text className="text-[10px] font-black uppercase" style={{ color: isDark ? colors.primary : '#00643B' }}>Tap to Record</Text>
                </View>
            )}
        </View>
      </View>
      
      <ChevronRight size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
};
