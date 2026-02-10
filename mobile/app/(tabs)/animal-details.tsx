import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import SafeScreen from '@/components/safeScreen';
import { ArrowLeft, UserCircle } from 'lucide-react-native'; // Using UserCircle to match your photo
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';

export default function AnimalDetails() {
  const router = useRouter();
  const params = useLocalSearchParams(); // Get data passed from the list
  const [activeTab, setActiveTab] = useState<'Info' | 'History'>('Info');

  return (
    <SafeScreen>
      <View className="flex-1 bg-white">
        
        {/* --- NAVBAR --- */}
        <View className="px-6 pt-2 pb-4 flex-row items-center">
            <TouchableOpacity 
                onPress={() => router.push('/animals')} 
                className="p-2 -ml-2 rounded-full active:bg-gray-100"
            >
                <ArrowLeft size={24} color="black" />
            </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-6">
            
          
            <View className="flex-row items-start justify-between mb-8">
                <View className="flex-row items-center gap-4">
                     <View className="w-16 h-16 rounded-full border-2 border-black items-center justify-center">
                        <UserCircle size={40} color="black" strokeWidth={1.5} />
                     </View>
                     <View>
                        <Text className="text-3xl font-bold text-gray-900">Cow # 1</Text>
                        <Text className="text-gray-500 text-base">Owner: Nelmar</Text>
                     </View>
                </View>
                <Text className="text-green-700 font-bold text-base mt-2">Active</Text>
            </View>

            {/* --- (Info / History) --- */}
            <View className="flex-row justify-center gap-4 mb-8">
                <TouchableOpacity 
                    onPress={() => setActiveTab('Info')}
                    className={`px-8 py-3 rounded-xl ${activeTab === 'Info' ? 'bg-gray-300' : 'bg-gray-100'}`}
                >
                    <Text className={`font-bold text-base ${activeTab === 'Info' ? 'text-gray-900' : 'text-gray-500'}`}>Info</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => setActiveTab('History')}
                    className={`px-8 py-3 rounded-xl ${activeTab === 'History' ? 'bg-gray-300' : 'bg-gray-100'}`}
                >
                    <Text className={`font-bold text-base ${activeTab === 'History' ? 'text-gray-900' : 'text-gray-500'}`}>History</Text>
                </TouchableOpacity>
            </View>

            {/* --- CONTENT AREA --- */}
            {activeTab === 'Info' ? (
                <View className="gap-6">
                    {/* Basic Info Card */}
                    <View className="bg-gray-200 rounded-[24px] p-6">
                        <Text className="text-xl font-bold text-gray-900 mb-6">Basic Information</Text>
                        
                        <InfoRow label="Animal ID:" value="123" />
                        <InfoRow label="Breed:" value="chiwawa" />
                        <InfoRow label="Age:" value="69" />
                    </View>

                    {/* Owner Info Card */}
                    <View className="bg-gray-200 rounded-[24px] p-6">
                        <Text className="text-xl font-bold text-gray-900 mb-6">Owner Information</Text>
                        
                        <InfoRow label="Name:" value="Nelmar" />
                        <InfoRow label="Address:" value="Brgy. Di makita" />
                    </View>
                </View>
            ) : (
                <View className="bg-gray-50 rounded-[24px] p-8 items-center">
                    <MaterialCommunityIcons name="history" size={48} color="#9CA3AF" />
                    <Text className="text-gray-400 font-bold mt-4">No History Records</Text>
                    <Text className="text-gray-400 text-center mt-1">AI and Medical records will appear here.</Text>
                </View>
            )}

        </ScrollView>
      </View>
    </SafeScreen>
  );
}

// --- HELPER COMPONENT FOR ROWS ---
const InfoRow = ({ label, value }: { label: string, value: string }) => (
    <View className="flex-row justify-between items-center mb-4">
        <Text className="text-gray-700 text-base">{label}</Text>
        <Text className="text-gray-900 text-base font-medium">{value}</Text>
    </View>
);