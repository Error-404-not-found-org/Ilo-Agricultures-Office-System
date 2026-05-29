import { View, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Image } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, MapPin, Info as InfoIcon, Edit2, Phone, Mail, ChevronRight } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState, useCallback } from 'react';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';

export default function ClientProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 
  const api = useApi();
  const { colors, isDark, themeStyle } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'Info' | 'Animals'>('Info');
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      
      const fetchClient = async () => {
        try {
          const res = await api.get(`/user/${id}`);
          setClient(res.data);
        } catch (error: any) {
          console.error("Failed to fetch client details", error);
          if (error.response?.status === 404) {
             toast.info("This client record no longer exists.");
             router.replace("/(technician)/technician.clients" as any);
          } else {
             toast.error(error.response?.data?.message || "Could not load client details.");
          }
        } finally {
          setLoading(false);
        }
      };
      
      fetchClient();

      const interval = setInterval(fetchClient, 10000); // 10 seconds polling
      return () => clearInterval(interval);
    }, [id])
  );

  if (loading) {
     return (
        <View className="flex-1 items-center justify-center bg-[#F9FAFB] dark:bg-slate-950">
            <ActivityIndicator size="large" color={isDark ? "#10b981" : "#00643B"} />
        </View>
     );
  }

  if (!client) {
     return (
        <View className="flex-1 items-center justify-center bg-[#F9FAFB] dark:bg-slate-950 px-8">
            <Text variant="bold" color="muted">Client Not Found.</Text>
            <TouchableOpacity 
                onPress={() => router.back()} 
                style={{ backgroundColor: isDark ? "#059669" : "#00643B" }}
                className="mt-4 px-6 py-3 rounded-full"
            >
                <Text variant="bold" style={{ color: '#fff' }}>Go Back</Text>
            </TouchableOpacity>
        </View>
     );
  }

  const clientName = client.name || 'Unknown Client';
  const addr = client.address;
  const clientPhone = addr?.phoneNumber || client.phoneNumber || 'No phone attached';
  const clientAddress = addr 
      ? [addr.street, addr.barangay, addr.city, addr.province].filter(Boolean).join(', ') 
      : 'Location Unregistered';

  const animalsList = client.stats?.animals || [];

  return (
    <View style={[{ flex: 1 }, themeStyle]}>
      <StatusBar barStyle="light-content" />
      
      {/* Absolute Green Top Background */}
      <View 
        className="absolute top-0 left-0 right-0 h-[280px]" 
        style={{ backgroundColor: isDark ? "#064e3e" : "#00643B" }}
      />

      {/* Header Actions */}
      <View className="pt-14 px-6 flex-row justify-between items-center z-10">
          <TouchableOpacity 
              onPress={() => router.back()} 
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center border border-white/10"
          >
              <ArrowLeft size={22} color="white" />
          </TouchableOpacity>
          <Text variant="black" size={18} style={{ color: 'white' }}>Client Profile</Text>
          <TouchableOpacity 
              onPress={() => router.push(`/(technician)/updateclient.profile?id=${client._id}` as any)}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center border border-white/10 active:opacity-75"
          >
              <Edit2 size={18} color="white" />
          </TouchableOpacity>
      </View>

      {/* Header Profile Section */}
      <View className="px-6 items-center mt-6 z-10">
          <View className="w-24 h-24 bg-white dark:bg-slate-800 rounded-full items-center justify-center border-4 border-emerald-100 dark:border-emerald-900 shadow-lg mb-4 overflow-hidden">
              {client.imageUrl ? (
                 <Image source={{ uri: client.imageUrl }} className="w-full h-full" resizeMode="cover" />
              ) : (
                 <Text variant="black" size={32} style={{ color: isDark ? '#34d399' : '#00643B' }}>
                   {clientName.charAt(0).toUpperCase()}
                 </Text>
              )}
          </View>
          <Text variant="black" size={24} style={{ color: 'white' }} className="mb-1">{clientName}</Text>
          <View className="flex-row items-center bg-white/20 px-3 py-1 rounded-full mb-3">
              <Text variant="bold" size={10} style={{ color: '#ecfdf5', letterSpacing: 1 }} className="uppercase">Farmer Account</Text>
          </View>
      </View>

      {/* Overlapping Curve Content Card */}
      <View 
        className="flex-1 rounded-t-[32px] pt-6 mt-4 shadow-lg flex-col"
        style={{ 
          backgroundColor: colors.background,
          shadowColor: '#000', 
          shadowOpacity: isDark ? 0 : 0.05, 
          shadowRadius: 15, 
          elevation: isDark ? 0 : 8 
        }}
      >
        
        {/* Customized Tabs */}
        <View className="flex-row px-6 mb-6">
            <TouchableOpacity 
                onPress={() => setActiveTab('Info')}
                style={{
                  borderBottomWidth: 2,
                  borderBottomColor: activeTab === 'Info' ? colors.primary : (isDark ? '#1e293b' : '#e2e8f0')
                }}
                className="flex-1 py-3.5 items-center flex-row justify-center gap-2"
            >
                <InfoIcon size={18} color={activeTab === 'Info' ? colors.primary : colors.textMuted} />
                <Text 
                  variant="bold" 
                  size={14} 
                  style={{ color: activeTab === 'Info' ? colors.primary : colors.textMuted }}
                >
                  Contact Profile
                </Text>
            </TouchableOpacity>
 
            <TouchableOpacity 
                onPress={() => setActiveTab('Animals')}
                style={{
                  borderBottomWidth: 2,
                  borderBottomColor: activeTab === 'Animals' ? colors.primary : (isDark ? '#1e293b' : '#e2e8f0')
                }}
                className="flex-1 py-3.5 items-center flex-row justify-center gap-2"
            >
                <MaterialCommunityIcons name="cow" size={18} color={activeTab === 'Animals' ? colors.primary : colors.textMuted} />
                <Text 
                  variant="bold" 
                  size={14} 
                  style={{ color: activeTab === 'Animals' ? colors.primary : colors.textMuted }}
                >
                  Registered Animals
                </Text>
            </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }} className="px-6">
            
            {activeTab === 'Info' ? (
                <View className="gap-y-6">
                    <Card style={{ padding: 20 }}>
                        <View className="gap-y-5">
                            <View className="flex-row items-start gap-3">
                                <View className="mt-0.5"><Phone size={18} color={colors.primary} /></View>
                                <View className="flex-1">
                                    <Text variant="semibold" size={12} color="muted" className="mb-0.5">Phone Number</Text>
                                    <Text variant="bold" size={15} color="primary">{clientPhone}</Text>
                                </View>
                            </View>
                            <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800 my-1" />
                            
                            <View className="flex-row items-start gap-3">
                                <View className="mt-0.5"><Mail size={18} color={colors.primary} /></View>
                                <View className="flex-1">
                                    <Text variant="semibold" size={12} color="muted" className="mb-0.5">Email Address</Text>
                                    <Text variant="bold" size={15} color="primary">{client.email || 'Unregistered'}</Text>
                                </View>
                            </View>
                            <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800 my-1" />

                            <View className="flex-row items-start gap-3">
                                <View className="mt-0.5"><MapPin size={18} color={colors.primary} /></View>
                                <View className="flex-1">
                                    <Text variant="semibold" size={12} color="muted" className="mb-0.5">Primary Location</Text>
                                    <Text variant="bold" size={15} color="primary" className="leading-5">{clientAddress}</Text>
                                </View>
                            </View>
                        </View>
                    </Card>
                </View>
            ) : (
                <View>
                    {animalsList.length > 0 ? (
                        <View className="mt-2">
                            {animalsList.map((item: any, idx: number) => (
                                <Card 
                                    key={idx}
                                    style={{ 
                                      flexDirection: 'row', 
                                      alignItems: 'center', 
                                      marginBottom: 12,
                                      padding: 16 
                                    }}
                                >
                                    <View 
                                        style={{ backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4' }} 
                                        className="w-12 h-12 rounded-full items-center justify-center mr-4"
                                    >
                                        <MaterialCommunityIcons name="cow" size={26} color={colors.primary} />
                                    </View>
 
                                    <View className="flex-1 pb-1">
                                        <Text variant="bold" size={16} color="primary" className="mb-0.5">
                                          {item.animalId || 'No ID'} {item.earTag ? `(${item.earTag})` : ''}
                                        </Text>
                                        <Text variant="medium" size={13} color="muted">
                                          {item.species || 'Unknown'} / {item.breed || 'Mixed'}
                                        </Text>
                                    </View>
 
                                    <TouchableOpacity 
                                       onPress={() => router.push(`/(technician)/animal-details?id=${item._id}`)}
                                       style={{ 
                                         backgroundColor: colors.card,
                                         borderColor: colors.border
                                       }}
                                       className="w-10 h-10 rounded-full items-center justify-center ml-2 border"
                                    >
                                        <ChevronRight size={20} color={colors.primary} />
                                    </TouchableOpacity>
                                </Card>
                            ))}
                        </View>
                    ) : (
                        <Card style={{ padding: 32, alignItems: 'center', marginTop: 4 }}>
                            <View style={{ backgroundColor: colors.tint }} className="w-20 h-20 rounded-full items-center justify-center mb-4">
                                <MaterialCommunityIcons name="cow" size={40} color={colors.textMuted} />
                            </View>
                            <Text variant="bold" size={18} color="primary" className="mb-1">No Owned Animals</Text>
                            <Text variant="medium" size={14} color="muted" className="text-center px-4 leading-5">
                              This client does not have any cattle registered to their name.
                            </Text>
                        </Card>
                    )}
                </View>
            )}

        </ScrollView>
      </View>
    </View>
  );
}
