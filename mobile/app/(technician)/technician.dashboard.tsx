import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Modal, Platform } from 'react-native';
import { Syringe, UserPlus, Activity, Search, Bell, MapPin, ChevronRight, CheckCircle2, AlertCircle, Clock, X } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import Header from '@/components/Header'; // <-- Added Global Header Image/Sync

// Premium Theme Colors based on Image
const PRIMARY = '#00643B'; // The deep green from the image

export default function HomeScreen() {
  const router = useRouter();
  const api = useApi();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Scheduling Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Picker visibility
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const response = await api.get('/technician/dashboard-data');
      setData(response.data);
    } catch (error) {
      console.error("Failed to load technician dashboard data", error);
      toast.error("Failed to synchronize hub data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    fetchDashboardData();
    // Real-time synchronization: Poll every 45 seconds on mobile to save battery but stay fresh
    const intervalId = setInterval(() => fetchDashboardData(true), 45000);
    return () => clearInterval(intervalId);
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      const newDate = new Date(scheduledDate);
      newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setScheduledDate(newDate);
    }
  };

  const onTimeChange = (event: any, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      const newDate = new Date(scheduledDate);
      newDate.setHours(date.getHours(), date.getMinutes());
      setScheduledDate(newDate);
    }
  };

  const handleAction = (item: any) => {
    setSelectedItem(item);
    setScheduledDate(item.scheduledDate ? new Date(item.scheduledDate) : item.preferredDate ? new Date(item.preferredDate) : new Date());
    setNote('');
    setModalVisible(true);
  };

  const confirmAction = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      let endpoint = '';
      let status = '';

      if (selectedItem.type === 'health') {
        endpoint = `/health-request/${selectedItem.id}/status`;
        status = 'in-progress';
      } else if (selectedItem.type === 'ai-request') {
        endpoint = `/ai-request/${selectedItem.id}/status`;
        status = 'approved';
      } else {
        endpoint = `/technician/inseminations/${selectedItem.id}/status`;
        status = 'done';
      }

      await api.patch(endpoint, { 
        status, 
        technicianNote: note || `Confirmed for ${scheduledDate.toLocaleDateString()} ${scheduledDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
        scheduledDate: scheduledDate.toISOString()
      });
      
      toast.success('Appointment Scheduled');
      setModalVisible(false);
      fetchDashboardData(true);
    } catch (error) {
      toast.error("Failed to schedule appointment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = data?.stats || {};
  const agendaItems = data?.agendaItems || [];

  if (loading && !data) {
    return (
      <View className="flex-1 bg-[#F9FAFB] items-center justify-center">
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text className="mt-4 text-[#00643B] font-medium animate-pulse">Synchronizing Hub Data...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
        bounces={true} 
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} />
        }
      >

        {/* --- HERO HEADER BACKGROUND & SEARCH LAYER --- */}
        <View 
            className="pb-28 shadow-md z-0" 
            style={{ backgroundColor: PRIMARY, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
        >
          {/* Global Dynamic Header Component (Avatar, Name, Date, Bell) */}
          <Header />

          {/* Search Bar */}
          <View className="px-6 mt-2">
              <View className="flex-row items-center bg-[#005230] rounded-full px-4 py-3.5 border border-[#007A48]">
                <Search size={20} color="#86EFAC" />
                <TextInput
                  placeholder="Search tasks or clients..."
                  placeholderTextColor="#A7F3D0"
                  className="flex-1 text-white ml-3 text-[15px] font-medium"
                />
              </View>
          </View>
        </View>

        {/* --- TASK OVERVIEW CARD (overlaps header) --- */}
        <View className="px-6 -mt-16 z-10 w-full mb-8">
          <View className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
            {/* Card Header */}
            <View className="flex-row justify-between items-center mb-6">
              <View className="flex-row items-center">
                <MapPin size={18} color={PRIMARY} />
                <Text className="text-slate-800 font-bold ml-1.5 text-base">Service Overview</Text>
              </View>
              <View className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                <Text style={{ color: PRIMARY }} className="text-xs font-bold tracking-wide">Live</Text>
              </View>
            </View>

            {/* Main Stat */}
            <View className="flex-row items-baseline justify-center mb-8">
              <Text style={{ color: PRIMARY }} className="text-7xl font-black tracking-tighter leading-none">
                {stats.totalInseminations ?? 0}
              </Text>
              <Text className="text-slate-500 font-bold ml-2 mb-1 text-xl">Service{stats.totalInseminations !== 1 ? 's' : ''}</Text>
            </View>

            {/* Sub Stats Row like weather details */}
            <View className="flex-row justify-between border-t border-slate-50 pt-5">
              <View className="items-center flex-1">
                <Text className="text-slate-400 text-[11px] uppercase tracking-widest font-bold mb-1">Health</Text>
                <Text className="text-blue-600 font-black text-xl">{stats.healthAlerts ?? 0}</Text>
              </View>
              <View className="w-[1px] bg-slate-100" />
              <View className="items-center flex-1">
                <Text className="text-slate-400 text-[11px] uppercase tracking-widest font-bold mb-1">Success</Text>
                <Text className="text-emerald-500 font-black text-xl">{stats.successRate || '84%'}</Text>
              </View>
              <View className="w-[1px] bg-slate-100" />
              <View className="items-center flex-1">
                <Text className="text-slate-400 text-[11px] uppercase tracking-widest font-bold mb-1">Agenda</Text>
                <Text className="text-slate-800 font-black text-xl">{agendaItems.length}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* --- QUICK ACTIONS --- */}
        <View className="px-6 mb-8">
          <Text className="text-slate-800 font-bold text-[17px] mb-4">Category</Text>
          <View className="flex-row justify-between">
            <ActionCategory
              title="Animals\nAssigned"
              icon={<MaterialCommunityIcons name="cow" size={28} color="#00643B" />}
              iconBg="#ECFDF5"
              onPress={() => router.push('/technician.animals')}
            />
            <ActionCategory
              title="Pregnancy\nChecks"
              icon={<Activity size={28} color="#D97706" />}
              iconBg="#FFFBEB"
              onPress={() => router.push('/technician.records')}
            />
            <ActionCategory
              title="Add\nClients"
              icon={<UserPlus size={28} color="#DC2626" />}
              iconBg="#FEF2F2"
              onPress={() => router.push('/clients/register-client')}
            />
            <ActionCategory
              title="Record\nResult"
              icon={<Syringe size={28} color="#2563EB" />}
              iconBg="#EFF6FF"
              onPress={() => router.push('/technician.records')}
            />
          </View>
        </View>

        {/* --- UPCOMING APPOINTMENTS SECTION --- */}
        <View className="px-6 mb-4 flex-row justify-between items-center">
          <Text className="text-slate-800 font-bold text-[17px]">Upcoming Appointments</Text>
          <TouchableOpacity onPress={() => router.push('/technician.dashboard')}>
            <Text style={{ color: PRIMARY }} className="font-bold text-xs tracking-wide">View all</Text>
          </TouchableOpacity>
        </View>

        <View className="px-6 space-y-3">
          {agendaItems.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-gray-100 shadow-sm">
                <Clock size={32} color="#94a3b8" />
                <Text className="text-slate-400 font-medium mt-2">No pending appointments</Text>
            </View>
          ) : (
            agendaItems.map((item: any, idx: number) => (
              <View key={item.id || idx} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex-row">
                <View 
                  className={`w-1.5 ${item.urgent ? 'bg-rose-500' : item.type === 'health' ? 'bg-blue-500' : 'bg-[#00643B]'}`} 
                />
                <View className="flex-1 p-4 flex-row justify-between items-center">
                  <View className="flex-1 mr-4">
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <Text className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                        {item.time} {item.urgent && '• URGENT'}
                      </Text>
                    </View>
                    <Text className="text-slate-800 font-bold text-[15px] mb-0.5" numberOfLines={1}>
                      {item.task}
                    </Text>
                    <View className="flex-row items-center gap-1">
                      <MapPin size={10} color="#94a3b8" />
                      <Text className="text-slate-400 text-[11px] font-medium" numberOfLines={1}>
                        {item.farmer} — {item.location}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity 
                    onPress={() => handleAction(item)}
                    className={`px-4 py-2 rounded-xl flex-row items-center gap-1.5 ${item.type === 'health' ? 'bg-blue-600' : 'bg-[#00643B]'}`}
                  >
                    <Text className="text-white font-bold text-[11px]">
                      {item.type === 'health' ? 'Accept' : 'Approve'}
                    </Text>
                    <ChevronRight size={12} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>

      {/* --- SCHEDULING MODAL --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-[40px] p-6 pb-12 shadow-2xl border-t border-gray-100">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-6">
              <View className="flex-row items-center gap-3">
                <View className="p-3 bg-emerald-50 rounded-2xl">
                  <Clock size={24} color={PRIMARY} />
                </View>
                <View>
                  <Text className="text-slate-800 font-black text-xl leading-none">Confirm Schedule</Text>
                  <Text className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">Set Appointment Time</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="p-2 bg-slate-50 rounded-full"
              >
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Context Info */}
            <View className="bg-slate-50 rounded-[24px] p-5 mb-6 border border-slate-100">
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Service Details</Text>
              <Text className="text-slate-800 font-bold text-[15px]">{selectedItem?.task}</Text>
              <View className="flex-row items-center gap-1.5 mt-1.5">
                <MapPin size={12} color="#94a3b8" />
                <Text className="text-slate-500 font-medium text-xs">{selectedItem?.farmer} · {selectedItem?.location}</Text>
              </View>
            </View>

            {/* Scheduling Inputs */}
            <View className="space-y-4 mb-8">
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 flex-row items-center justify-between"
                >
                  <View>
                    <Text className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Visit Date</Text>
                    <Text className="text-slate-800 font-bold text-[15px]">{scheduledDate.toLocaleDateString()}</Text>
                  </View>
                  <MaterialCommunityIcons name="calendar-clock" size={20} color={PRIMARY} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowTimePicker(true)}
                  className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 flex-row items-center justify-between"
                >
                  <View>
                    <Text className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Visit Time</Text>
                    <Text className="text-slate-800 font-bold text-[15px]">
                      {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Clock size={20} color={PRIMARY} />
                </TouchableOpacity>
              </View>

              <View>
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Technician Note (Optional)</Text>
                <TextInput
                  placeholder="e.g. Please secure the animal before I arrive..."
                  placeholderTextColor="#cbd5e1"
                  className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 text-slate-800 text-sm"
                  multiline
                  numberOfLines={3}
                  value={note}
                  onChangeText={setNote}
                  style={{ textAlignVertical: 'top' }}
                />
              </View>
            </View>

            {/* DateTimePickers */}
            {showDatePicker && (
              <DateTimePicker
                value={scheduledDate}
                mode="date"
                display="default"
                onChange={onDateChange}
                minimumDate={new Date()}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={scheduledDate}
                mode="time"
                display="default"
                onChange={onTimeChange}
              />
            )}

            {/* Action Button */}
            <TouchableOpacity
              onPress={confirmAction}
              disabled={isSubmitting}
              activeOpacity={0.8}
              style={{ backgroundColor: PRIMARY }}
              className="w-full py-5 rounded-[24px] items-center justify-center shadow-lg shadow-emerald-200"
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white font-black text-lg tracking-wide">
                  {selectedItem?.type === 'health' ? 'Accept & Schedule' : 'Approve & Schedule'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    <Text className="text-slate-700 text-[9.5px] font-bold text-center leading-3">
      {title.split('\\n').map((line, i) => (
        <Text key={i}>{line}{i === 0 ? '\n' : ''}</Text>
      ))}
    </Text>
  </TouchableOpacity>
);