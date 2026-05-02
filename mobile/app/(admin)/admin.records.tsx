import { View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import Header from '@/components/Header';
import React, { useState } from 'react';
import { useApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PRIMARY = '#1e3a5f';
const TABS = ['Inseminations', 'Pregnancies', 'Calvings'];

export default function AdminRecordsScreen() {
  const api = useApi();
  const { isSignedIn, isLoaded } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  const { data: inseminations = [], isLoading: iLoad } = useQuery({
    queryKey: ['admin-inseminations'],
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const res = await api.get('/admin/inseminations');
      return res.data.inseminations || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: pregnancies = [], isLoading: pLoad } = useQuery({
    queryKey: ['admin-pregnancies'],
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const res = await api.get('/admin/pregnancy-checks');
      return res.data.pregnancyChecks || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: calvings = [], isLoading: cLoad } = useQuery({
    queryKey: ['admin-calvings'],
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const res = await api.get('/admin/calvings');
      return res.data.calvings || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const datasets = [inseminations, pregnancies, calvings];
  const loadings = [iLoad, pLoad, cLoad];
  const isLoading = loadings[activeTab];
  const currentData = datasets[activeTab];

  return (
    <View className="flex-1 bg-[#F0F4FF] dark:bg-slate-950">
      <StatusBar barStyle="light-content" />
      <View className="absolute top-0 left-0 right-0 h-[220px]" style={{ backgroundColor: PRIMARY }} />
      <Header />

      <View className="flex-1 bg-[#F0F4FF] dark:bg-slate-950 rounded-t-[32px] px-6 pt-6 mt-2 shadow-lg" style={{ elevation: 8 }}>
        <Text className="text-[22px] font-bold text-slate-800 dark:text-white mb-4">Records</Text>

        {/* Tabs */}
        <View className="flex-row gap-x-2 mb-5">
          {TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(i)}
              className={`flex-1 py-2.5 rounded-xl items-center border ${activeTab === i ? 'border-[#1e3a5f] dark:border-slate-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
              style={activeTab === i ? { backgroundColor: PRIMARY } : {}}
            >
              <Text
                className={`text-xs font-bold ${activeTab === i ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View className="items-center justify-center pt-20">
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : currentData.length === 0 ? (
          <View className="items-center justify-center pt-20">
            <Text className="text-slate-400 dark:text-slate-500 font-medium">No records found.</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 140 }}
          >
            {currentData.map((item: any) => (
              <View key={item._id} className="bg-white dark:bg-slate-800 rounded-[20px] p-4 mb-3 border border-slate-100 dark:border-slate-700 shadow-sm">
                <View className="flex-row items-center gap-3 mb-2">
                  <View className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-full items-center justify-center">
                    <MaterialCommunityIcons
                      name={activeTab === 0 ? 'needle' : activeTab === 1 ? 'baby-face-outline' : 'cow'}
                      size={20}
                      color={PRIMARY}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-bold text-slate-800 dark:text-white">
                      {item.animalId?.earTag || item.animalId?.animalId || 'Animal'}
                    </Text>
                    <Text className="text-[12px] text-slate-500 dark:text-slate-400">
                      Farmer: {item.farmerId?.name || '—'}
                    </Text>
                  </View>
                  <Text className="text-[11px] text-slate-400 dark:text-slate-500">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                  </Text>
                </View>
                {activeTab === 0 && (
                  <View className="ml-12 gap-y-1">
                    {item.inseminationDate && (
                      <Text className="text-[12px] text-slate-600 dark:text-slate-400">
                        Date: <Text className="font-semibold text-slate-800 dark:text-slate-200">{new Date(item.inseminationDate).toLocaleDateString()}</Text>
                      </Text>
                    )}
                    {item.sireCode && (
                      <Text className="text-[12px] text-slate-600 dark:text-slate-400">
                        Sire: <Text className="font-semibold text-slate-800 dark:text-slate-200">{item.sireCode}</Text>
                      </Text>
                    )}
                    {item.status && (
                      <View className="self-start px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 mt-1">
                        <Text className="text-blue-700 dark:text-blue-400 text-[10px] font-bold uppercase">{item.status}</Text>
                      </View>
                    )}
                  </View>
                )}
                {activeTab === 1 && (
                  <View className="ml-12 gap-y-1">
                    {item.pregnancyDiagnosis?.date && (
                      <Text className="text-[12px] text-slate-600 dark:text-slate-400">
                        Check Date: <Text className="font-semibold text-slate-800 dark:text-slate-200">{new Date(item.pregnancyDiagnosis.date).toLocaleDateString()}</Text>
                      </Text>
                    )}
                    {item.pregnancyDiagnosis?.result && (
                      <View className={`self-start px-2 py-0.5 rounded-full mt-1 ${item.pregnancyDiagnosis.result === 'Pregnant' ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-slate-100 dark:bg-slate-700'}`}>
                        <Text className={`text-[10px] font-bold uppercase ${item.pregnancyDiagnosis.result === 'Pregnant' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {item.pregnancyDiagnosis.result}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                {activeTab === 2 && (
                  <View className="ml-12 gap-y-1">
                    {item.date && (
                      <Text className="text-[12px] text-slate-600 dark:text-slate-400">
                        Calving Date: <Text className="font-semibold text-slate-800 dark:text-slate-200">{new Date(item.date).toLocaleDateString()}</Text>
                      </Text>
                    )}
                    {item.calfSex && (
                      <Text className="text-[12px] text-slate-600 dark:text-slate-400">
                        Calf Sex: <Text className="font-semibold text-slate-800 dark:text-slate-200">{item.calfSex}</Text>
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
