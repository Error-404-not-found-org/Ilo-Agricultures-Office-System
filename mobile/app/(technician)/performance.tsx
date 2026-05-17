import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp, Award, CheckCircle, Clock, Calendar, BarChart3, Target, ChevronRight } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PRIMARY = '#00643B';
const { width } = Dimensions.get('window');

export default function TechnicianPerformanceScreen() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery({
    queryKey: ['technician', 'performance'],
    queryFn: async () => {
      const res = await api.get('/analytics/my-performance');
      return res.data;
    }
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const aiStats = data?.ai || { totalAI: 0, successfulAI: 0, failedAI: 0, pendingPD: 0 };
  const healthStats = data?.health || { totalResolved: 0, totalInProgress: 0 };
  
  const successRate = aiStats.totalAI > 0 
    ? Math.round((aiStats.successfulAI / aiStats.totalAI) * 100) 
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="light-content" />
      
      {/* Premium Header */}
      <View style={{ backgroundColor: PRIMARY, paddingBottom: 60, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingHorizontal: 24, paddingTop: insets.top + 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 24 }}>My Performance</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Outfit_600SemiBold', fontSize: 13 }}>Field Operations Analytics</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1, marginTop: -30 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>
        
        {/* Main KPI Card */}
        <View style={{ backgroundColor: '#fff', borderRadius: 32, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 8 }}>
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <View>
                 <Text style={{ fontSize: 14, fontFamily: 'Outfit_700Bold', color: '#94a3b8', textTransform: 'uppercase' }}>AI Conception Rate</Text>
                 <Text style={{ fontSize: 42, fontFamily: 'Outfit_900Black', color: '#1e293b' }}>{successRate}%</Text>
              </View>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
                 <TrendingUp size={32} color="#059669" />
              </View>
           </View>

           <View style={{ height: 12, backgroundColor: '#f1f5f9', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
              <View style={{ width: `${successRate}%`, height: '100%', backgroundColor: '#059669', borderRadius: 6 }} />
           </View>
           <Text style={{ fontSize: 12, fontFamily: 'Outfit_600SemiBold', color: '#64748b' }}>
              Based on {aiStats.totalAI} total insemination procedures recorded.
           </Text>
        </View>

        {/* Stats Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 24 }}>
           <MetricCard 
              label="Successful AI" 
              value={aiStats.successfulAI} 
              icon="check-decagram" 
              color="#059669" 
              bg="#ecfdf5" 
           />
           <MetricCard 
              label="Resolved Health" 
              value={healthStats.totalResolved} 
              icon="stethoscope" 
              color="#2563eb" 
              bg="#eff6ff" 
           />
           <MetricCard 
              label="Pending PD" 
              value={aiStats.pendingPD} 
              icon="clock-outline" 
              color="#d97706" 
              bg="#fffbeb" 
           />
           <MetricCard 
              label="Active Tasks" 
              value={healthStats.totalInProgress} 
              icon="clipboard-list-outline" 
              color="#7c3aed" 
              bg="#f5f3ff" 
           />
        </View>

        {/* Level/Award Card */}
        <View style={{ backgroundColor: '#1e293b', borderRadius: 24, padding: 20, marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
           <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={24} color="#fbbf24" />
           </View>
           <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontFamily: 'Outfit_800ExtraBold', fontSize: 16 }}>Expert Technician</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Outfit_500Medium', fontSize: 12 }}>You are in the top 10% of technicians this month!</Text>
           </View>
           <ChevronRight size={20} color="rgba(255,255,255,0.4)" />
        </View>

        {/* Monthly Activity Section */}
        <View style={{ marginTop: 32 }}>
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: '#1e293b' }}>Monthly Trend</Text>
              <Calendar size={20} color="#94a3b8" />
           </View>
           
           <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 20, height: 200, justifyContent: 'flex-end', flexDirection: 'row', alignItems: 'flex-end', gap: 12, borderWidth: 1, borderColor: '#f1f5f9' }}>
              {(data?.trends || []).length === 0 ? (
                 <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <BarChart3 size={40} color="#cbd5e1" />
                    <Text style={{ color: '#94a3b8', fontFamily: 'Outfit_600SemiBold', marginTop: 8 }}>No data for chart yet</Text>
                 </View>
              ) : (
                data.trends.map((t: any, i: number) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                    <View style={{ width: '100%', height: `${(t.count / Math.max(...data.trends.map((x: any) => x.count))) * 100}%`, backgroundColor: i === data.trends.length - 1 ? PRIMARY : '#cbd5e1', borderRadius: 8 }} />
                    <Text style={{ fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#64748b' }}>
                      {new Date(0, t._id.month - 1).toLocaleString('en', { month: 'short' })}
                    </Text>
                  </View>
                ))
              )}
           </View>
        </View>

        {/* Goals Section */}
        <View style={{ marginTop: 32 }}>
           <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: '#1e293b', marginBottom: 16 }}>Target Goals</Text>
           <GoalItem title="Monthly AI Sessions" current={aiStats.totalAI} target={50} />
           <GoalItem title="Successful Conceptions" current={aiStats.successfulAI} target={30} />
           <GoalItem title="Farmer Satisfaction" current={4.8} target={5} isRating />
        </View>

      </ScrollView>
    </View>
  );
}

function MetricCard({ label, value, icon, color, bg }: any) {
   return (
      <View style={{ width: (width - 55) / 2, backgroundColor: bg, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' }}>
         <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <MaterialCommunityIcons name={icon} size={20} color={color} />
         </View>
         <Text style={{ fontSize: 24, fontFamily: 'Outfit_900Black', color: '#1e293b' }}>{value}</Text>
         <Text style={{ fontSize: 11, fontFamily: 'Outfit_700Bold', color: '#64748b', marginTop: 2 }}>{label.toUpperCase()}</Text>
      </View>
   );
}

function GoalItem({ title, current, target, isRating }: any) {
   const percent = Math.min(Math.round((current / target) * 100), 100);
   return (
      <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' }}>
         <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontFamily: 'Outfit_700Bold', color: '#475569', fontSize: 13 }}>{title}</Text>
            <Text style={{ fontFamily: 'Outfit_900Black', color: '#1e293b', fontSize: 14 }}>{current}{isRating ? '★' : ''} / {target}{isRating ? '★' : ''}</Text>
         </View>
         <View style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ width: `${percent}%`, height: '100%', backgroundColor: PRIMARY, borderRadius: 3 }} />
         </View>
      </View>
   );
}
