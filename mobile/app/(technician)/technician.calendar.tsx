import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin, ClipboardList } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, addDays, startOfWeek, isSameDay, addMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';

const PRIMARY = '#00643B';

export default function TechnicianCalendar() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['technician', 'tasks', format(selectedDate, 'yyyy-MM')],
    queryFn: async () => {
      const res = await api.get('/technician/dashboard-data?fullAgenda=true');
      return res.data?.agendaItems || [];
    }
  });

  const checkInMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string, type: 'ai' | 'health' }) => {
      const endpoint = type === 'health' 
        ? `/health-request/${id}/status` 
        : `/technician/inseminations/${id}/status`;
      
      return await api.patch(endpoint, { 
        status: 'in-progress',
        technicianNote: 'Technician checked in via field calendar.'
      });
    },
    onSuccess: () => {
      toast.success("Checked in successfully");
      queryClient.invalidateQueries({ queryKey: ['technician'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to check in");
    }
  });

  const handleCheckIn = (item: any) => {
    checkInMutation.mutate({ id: item.id, type: item.type });
  };

  const dailyTasks = useMemo(() => {
    return tasks.filter((t: any) => {
        const tDate = t.displayDate;
        return tDate && isSameDay(new Date(tDate), selectedDate);
    });
  }, [tasks, selectedDate]);

  // Generate days for the horizontal week picker
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate);
    return [...Array(7)].map((_, i) => addDays(start, i));
  }, [selectedDate]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={{ backgroundColor: PRIMARY, paddingBottom: 20, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingHorizontal: 24, paddingTop: insets.top + 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 22 }}>Field Calendar</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Outfit_600SemiBold', fontSize: 12 }}>{format(selectedDate, 'MMMM yyyy')}</Text>
          </View>
        </View>

        {/* Week Picker */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 }}>
          {weekDays.map((day, i) => {
            const isSelected = isSameDay(day, selectedDate);
            return (
              <TouchableOpacity 
                key={i} 
                onPress={() => setSelectedDate(day)}
                style={{ alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 20, backgroundColor: isSelected ? '#fff' : 'transparent', minWidth: 45 }}
              >
                <Text style={{ fontSize: 10, fontFamily: 'Outfit_700Bold', color: isSelected ? PRIMARY : 'rgba(255,255,255,0.6)' }}>
                  {format(day, 'EEE').toUpperCase()}
                </Text>
                <Text style={{ fontSize: 16, fontFamily: 'Outfit_900Black', color: isSelected ? PRIMARY : '#fff' }}>
                  {format(day, 'd')}
                </Text>
                {isSelected && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: PRIMARY }} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: '#1e293b' }}>
                {isSameDay(new Date(), selectedDate) ? "Today's Agenda" : format(selectedDate, 'EEEE, MMM do')}
            </Text>
            <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Outfit_900Black', color: '#059669' }}>{dailyTasks.length} TASKS</Text>
            </View>
        </View>

        {isLoading ? (
            <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
        ) : dailyTasks.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -60 }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <CalendarIcon size={32} color="#cbd5e1" />
                </View>
                <Text style={{ fontFamily: 'Outfit_700Bold', color: '#94a3b8', fontSize: 16 }}>No visits scheduled</Text>
                <Text style={{ fontFamily: 'Outfit_500Medium', color: '#cbd5e1', fontSize: 13, marginTop: 4 }}>Enjoy your quiet day!</Text>
            </View>
        ) : (
            <FlatList 
                data={dailyTasks}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        onPress={() => item.animalId?._id && router.push(`/(technician)/animal-details?id=${item.animalId._id}`)}
                        activeOpacity={0.8}
                        style={{ backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: item.type === 'health' ? '#ef4444' : PRIMARY, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Clock size={14} color="#94a3b8" />
                                <Text style={{ fontSize: 12, fontFamily: 'Outfit_700Bold', color: '#94a3b8' }}>
                                    {item.preferredTime || '09:00 AM'}
                                </Text>
                            </View>
                            <View style={{ backgroundColor: item.type === 'health' ? '#fef2f2' : '#ecfdf5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: item.type === 'health' ? '#ef4444' : '#059669', textTransform: 'uppercase' }}>
                                    {item.type}
                                </Text>
                            </View>
                        </View>
                        
                        <Text style={{ fontSize: 17, fontFamily: 'Outfit_800ExtraBold', color: '#1e293b' }}>{item.farmerName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <MapPin size={14} color="#64748b" />
                            <Text style={{ fontSize: 13, fontFamily: 'Outfit_600SemiBold', color: '#64748b' }}>{item.location || 'Oton, Iloilo'}</Text>
                        </View>

                        <View style={{ borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 16, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
                                    <MaterialCommunityIcons name="cow" size={14} color="#64748b" />
                                </View>
                                <Text style={{ fontSize: 13, fontFamily: 'Outfit_700Bold', color: '#475569' }}>Tag: {item.animalTag || 'N/A'}</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => handleCheckIn(item)}
                                disabled={checkInMutation.isPending || item.status === 'in-progress'}
                                style={{ 
                                    backgroundColor: item.status === 'in-progress' ? '#94a3b8' : PRIMARY, 
                                    paddingHorizontal: 12, 
                                    paddingVertical: 6, 
                                    borderRadius: 10,
                                    opacity: checkInMutation.isPending ? 0.7 : 1
                                }}
                            >
                                <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'Outfit_800ExtraBold' }}>
                                    {checkInMutation.isPending && checkInMutation.variables?.id === item.id 
                                        ? '...' 
                                        : item.status === 'in-progress' ? 'IN PROGRESS' : 'CHECK IN'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                )}
            />
        )}
      </View>
    </View>
  );
}
