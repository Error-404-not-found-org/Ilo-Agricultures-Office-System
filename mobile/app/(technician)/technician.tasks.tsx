import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Plus, CheckCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';

export default function TasksScreen() {
  const router = useRouter();
  const api = useApi();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Urgent');

  const fetchTasks = async () => {
    try {
      const res = await api.get('/tasks');
      setTasks(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [fetchTasks])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  };

  const handleComplete = async (id: string) => {
    try {
      await api.put(`/tasks/${id}/complete`);
      toast.success('Task marked as completed!');
      fetchTasks();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update task.');
    }
  };

  const filteredTasks = tasks.filter((t: any) => t.category === activeTab);

  return (
    <SafeAreaView className="flex-1 bg-[#F9FAFB]">
      <View className="px-6 py-4 flex-row justify-between items-center bg-white border-b border-gray-100 shadow-sm z-10 w-full relative">
        <Text className="text-2xl font-black text-[#00643B]">To-Do List</Text>
        <TouchableOpacity 
          className="bg-[#00643B] w-10 h-10 rounded-full items-center justify-center shadow-sm"
          onPress={() => router.push('/(technician)/create-task')}
        >
          <Plus size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View className="flex-row px-4 py-3 bg-white">
        {['Urgent', 'Routine', 'Follow-up'].map(tab => (
          <TouchableOpacity
            key={tab}
            className={`flex-1 items-center py-2 border-b-2 ${activeTab === tab ? 'border-[#0f766e]' : 'border-transparent'}`}
            onPress={() => setActiveTab(tab)}
          >
            <Text className={`font-bold ${activeTab === tab ? 'text-[#0f766e]' : 'text-slate-400'}`}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#00643B" />
        </View>
      ) : (
        <ScrollView 
          className="flex-1 p-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredTasks.length === 0 ? (
            <View className="items-center justify-center py-10 opacity-70">
              <CheckCircle size={48} color="#0d9488" className="mb-4" />
              <Text className="text-slate-500 font-medium">All caught up! No {activeTab.toLowerCase()} tasks found.</Text>
            </View>
          ) : (
            filteredTasks.map((t: any) => (
              <View key={t._id} className="bg-white rounded-2xl p-4 mb-4 border border-slate-100 shadow-sm">
                <View className="flex-row justify-between items-start mb-2">
                  <Text className="font-bold text-base text-slate-800 flex-1 mr-2" numberOfLines={2}>{t.notes}</Text>
                  <View className={`px-2 py-1 rounded-md ${
                    t.category === 'Urgent' ? 'bg-red-50' : 
                    t.category === 'Routine' ? 'bg-blue-50' : 'bg-emerald-50'
                  }`}>
                    <Text className={`text-[10px] font-bold uppercase ${
                      t.category === 'Urgent' ? 'text-red-500' : 
                      t.category === 'Routine' ? 'text-blue-500' : 'text-emerald-600'
                    }`}>{t.category}</Text>
                  </View>
                </View>

                <View className="bg-slate-50 rounded-lg p-3 mb-3">
                  <Text className="text-slate-700 font-semibold mb-1 text-sm">{t.farmerId?.name}</Text>
                  {t.animalIds && t.animalIds.length > 0 && (
                    <Text className="text-slate-500 text-xs mt-1">
                      Animals: {t.animalIds.map((a: any) => a.animalId).join(', ')}
                    </Text>
                  )}
                </View>

                <View className="flex-row justify-end border-t border-slate-100 pt-3">
                  <TouchableOpacity 
                    className="flex-row items-center border border-slate-200 px-3 py-1.5 rounded-lg"
                    onPress={() => handleComplete(t._id)}
                  >
                    <CheckCircle size={16} color="#0f766e" />
                    <Text className="text-[#0f766e] font-bold ml-1.5 text-xs">Mark Complete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
