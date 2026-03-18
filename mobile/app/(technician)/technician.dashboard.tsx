import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Syringe, UserPlus, Activity, Search, Bell, MapPin } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import Header from '@/components/Header'; // <-- Added Global Header Image/Sync

// Premium Theme Colors based on Image
const PRIMARY = '#00643B'; // The deep green from the image

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
        bounces={false} // Match overlapping aesthetic
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
                <Text className="text-slate-800 font-bold ml-1.5 text-base">Task Overview</Text>
              </View>
              <View className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                <Text style={{ color: PRIMARY }} className="text-xs font-bold tracking-wide">Today</Text>
              </View>
            </View>

            {/* Main Stat */}
            <View className="flex-row items-baseline justify-center mb-8">
              <Text style={{ color: PRIMARY }} className="text-7xl font-black tracking-tighter leading-none">
                12
              </Text>
              <Text className="text-slate-500 font-bold ml-2 mb-1 text-xl">Tasks</Text>
            </View>

            {/* Sub Stats Row like weather details */}
            <View className="flex-row justify-between border-t border-slate-50 pt-5">
              <View className="items-center flex-1">
                <Text className="text-slate-400 text-[11px] uppercase tracking-widest font-bold mb-1">Urgent</Text>
                <Text className="text-red-500 font-black text-xl">3</Text>
              </View>
              <View className="w-[1px] bg-slate-100" />
              <View className="items-center flex-1">
                <Text className="text-slate-400 text-[11px] uppercase tracking-widest font-bold mb-1">Routine</Text>
                <Text className="text-slate-800 font-black text-xl">5</Text>
              </View>
              <View className="w-[1px] bg-slate-100" />
              <View className="items-center flex-1">
                <Text className="text-slate-400 text-[11px] uppercase tracking-widest font-bold mb-1">Followup</Text>
                <Text className="text-emerald-500 font-black text-xl">4</Text>
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

        {/* --- RECENT SECTION --- */}
        <View className="px-6 mb-4 flex-row justify-between items-center">
          <Text className="text-slate-800 font-bold text-[17px]">Best Offers</Text>
          <TouchableOpacity>
            <Text style={{ color: PRIMARY }} className="font-bold text-xs tracking-wide">View all</Text>
          </TouchableOpacity>
        </View>

        <View className="px-6 flex-row gap-x-4">
          <View className="flex-1 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 h-[120px]">
            <View className="h-[70px] w-full items-center justify-center bg-emerald-50">
              <MaterialCommunityIcons name="needle" size={32} color="#00643B" />
            </View>
            <View className="px-3 py-2 flex-1 justify-center items-center">
              <Text className="font-bold text-slate-800 text-xs">New Client Sync</Text>
            </View>
          </View>
          <View className="flex-1 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 h-[120px]">
            <View className="h-[70px] w-full items-center justify-center bg-blue-50">
              <MaterialCommunityIcons name="file-document-outline" size={32} color="#3B82F6" />
            </View>
            <View className="px-3 py-2 flex-1 justify-center items-center">
              <Text className="font-bold text-slate-800 text-xs">Reports Uploaded</Text>
            </View>
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
    <Text className="text-slate-700 text-[9.5px] font-bold text-center leading-3">
      {title.split('\\n').map((line, i) => (
        <Text key={i}>{line}{i === 0 ? '\n' : ''}</Text>
      ))}
    </Text>
  </TouchableOpacity>
);