import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StatusBar, TouchableOpacity } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import { useApi } from '@/lib/api';
import { useRouter } from 'expo-router';
import { toast } from 'sonner-native';
import RecordCard from '@/components/RecordCard';

const Records = () => {
  const router = useRouter();
  const api = useApi();
  const [activeTab, setActiveTab] = useState<'history' | 'requests'>('history');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'history') {
        const results = await Promise.allSettled([
          api.get('/technician/inseminations'),
          api.get('/technician/pregnancy-checks'),
          api.get('/technician/calvings'),
          api.get('/ai-request'),
          api.get('/health-request')
        ]);
        
        const [insRes, pregRes, calvRes, aiRes, healthRes] = results.map(r => r.status === 'fulfilled' ? (r as any).value : { data: [] });

        const combined = [
          ...(insRes.data?.inseminations || []).map((i: any) => ({ ...i, type: 'insemination' })),
          ...(pregRes.data?.pregnancyChecks || []).map((p: any) => ({ ...p, type: 'pregnancy' })),
          ...(calvRes.data?.calvings || []).map((c: any) => ({ ...c, type: 'calving' })),
          ...(Array.isArray(aiRes.data) ? aiRes.data : []).filter((a: any) => a.status !== 'pending').map((a: any) => ({ ...a, type: 'ai-request' })),
          ...(Array.isArray(healthRes.data) ? healthRes.data : []).filter((h: any) => h.status !== 'pending').map((h: any) => ({ ...h, type: 'health-request' }))
        ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        
        setHistoryRecords(combined);
      } else {
        const results = await Promise.allSettled([
          api.get('/ai-request'),
          api.get('/health-request')
        ]);
        
        const [aiRes, healthRes] = results.map(r => r.status === 'fulfilled' ? (r as any).value : { data: [] });
        
        const combined = [
          ...(aiRes.data || []).map((a: any) => ({ ...a, type: 'ai-request' })),
          ...(healthRes.data || []).map((h: any) => ({ ...h, type: 'health-request' }))
        ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        
        setServiceRequests(combined);
      }
    } catch (error: any) {
      console.error("Failed to fetch records:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const renderHistoryItem = (item: any) => {
    let title = "";
    let sub = item.animalId?.earTag || item.animalId?.animalId || "No Tag";
    
    switch(item.type) {
      case 'insemination': title = `Insemination #${item.attemptNumber}`; break;
      case 'pregnancy': title = `Pregnancy Check: ${item.pregnancyDiagnosis?.result || 'Pending'}`; break;
      case 'calving': title = `Calving: ${item.numberOfCalves || 1} Calf`; break;
      case 'ai-request': 
        title = "AI Service Scheduled"; 
        sub = `Farmer: ${item.farmerId?.name || 'Farmer'}`;
        break;
      case 'health-request': 
        title = "Health Check Accepted"; 
        sub = `Farmer: ${item.farmerId?.name || 'Farmer'}`;
        break;
    }

    const handlePress = () => {
      if (item.animalId?._id) {
        router.push(`/(technician)/animal-details?id=${item.animalId._id}` as any);
      } else if (item.animal?._id) {
        router.push(`/(technician)/animal-details?id=${item.animal._id}` as any);
      } else {
        toast.info("No animal profile linked to this record");
      }
    };

    return (
      <RecordCard 
        key={`${item.type}-${item._id}`}
        id={item._id}
        title={title}
        subtitle={sub}
        date={item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
        status={item.status || "Completed"}
        statusColor={item.status === 'pending' ? 'text-amber-500' : 'text-slate-500'}
        onPress={handlePress}
      />
    );
  };

  return (
    <View className="flex-1 bg-[#F9FAFB] dark:bg-slate-950">
      <StatusBar barStyle="light-content" />
      <View className="absolute top-0 left-0 right-0 h-[220px] bg-[#00643B]" />

      <Header />
      
      <View className="flex-1 bg-white dark:bg-slate-950 rounded-t-[32px] px-6 pt-8 mt-2 shadow-2xl">
        <View className="flex-row bg-[#F1F5F9] dark:bg-slate-800 p-1.5 rounded-2xl mb-5">
            <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setActiveTab('history')}
                className={`flex-1 py-3 items-center justify-center rounded-xl ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}`}
            >
                <Text className={`font-bold text-[14px] ${activeTab === 'history' ? 'text-[#00643B] dark:text-emerald-400' : 'text-[#64748B] dark:text-slate-500'}`}>Activity History</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setActiveTab('requests')}
                className={`flex-1 py-3 items-center justify-center rounded-xl ${activeTab === 'requests' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}`}
            >
                <Text className={`font-bold text-[14px] ${activeTab === 'requests' ? 'text-[#00643B] dark:text-emerald-400' : 'text-[#64748B] dark:text-slate-500'}`}>Service Requests</Text>
            </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
             <View className="flex-1 justify-center items-center mb-16">
                <ActivityIndicator size="large" color="#00643B" />
             </View>
        ) : (
            <ScrollView 
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#00643B"]} />
                }
            >
                {activeTab === 'history' ? (
                    historyRecords.map(renderHistoryItem)
                ) : (
                    serviceRequests.map((item) => {
                      const isAI = item.type === 'ai-request';
                      return (
                        <View key={`${item.type}-${item._id}`} className="bg-white dark:bg-slate-800 p-5 rounded-2xl mb-3 border border-slate-100 dark:border-slate-700 shadow-sm">
                          <View className="flex-row justify-between items-center mb-2">
                              <Text className="text-[10px] text-[#94A3B8] dark:text-slate-500 font-bold uppercase">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "RECENT"}</Text>
                              <View className={`px-2 py-0.5 rounded-full ${item.status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                                  <Text className={`text-[10px] font-bold uppercase ${item.status === 'pending' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                      {item.status || 'pending'}
                                  </Text>
                              </View>
                          </View>
                          <Text className="text-[16px] font-bold text-[#1E293B] dark:text-white">{isAI ? "AI Service Request" : "Health Service Request"}</Text>
                          <Text className="text-[14px] text-[#64748B] dark:text-slate-400 mt-1">Farmer: <Text className="font-bold text-slate-800 dark:text-slate-200">{item.farmerId?.name || "Farmer"}</Text></Text>
                        </View>
                      );
                    })
                )}
            </ScrollView>
        )}
      </View>
    </View>
  );

}

export default Records;
