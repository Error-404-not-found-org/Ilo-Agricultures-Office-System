import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, User, MapPin, Calendar, Clock, CheckCircle2, Syringe, HeartPulse } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { format } from 'date-fns';
import { useUser } from '@clerk/clerk-expo';
import { toast } from 'sonner-native';
import { useQuery } from '@tanstack/react-query';

interface NotificationDetails {
  notification: {
    _id: string;
    title: string;
    message: string;
    type: 'ai-request' | 'health-request';
    createdAt: string;
    senderId: {
      _id: string;
      name: string;
      imageUrl: string;
      role: string;
      address?: {
        street: string;
        barangay: string;
        city: string;
      }
    }
  };
  relatedData: {
    _id: string;
    status: string;
    animalId: {
      animalId: string;
      earTag: string;
      species: string;
      breed: string;
      imageUrl: string;
    };
    comment?: string;
    symptoms?: string;
    urgency?: string;
    imageUrl?: string;
    technicianNote?: string;
    approvedBy?: { name: string; imageUrl: string };
    handledBy?: { name: string; imageUrl: string };
  };
}

export default function NotificationDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const api = useApi();
  const { user } = useUser();

  const { data: profile } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const res = await api.get('/user/me');
      return res.data;
    }
  });

  const role = profile?.role || (user?.publicMetadata?.role as string) || 'technician';
  const isFarmer = role === 'farmer';
  const [data, setData] = useState<NotificationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await api.get(`/notifications/${id}`);
        setData(res.data);
        // Mark as read when viewing details
        if (!res.data.notification.isRead) {
          api.patch('/notifications/mark-read', { notificationId: id });
        }
      } catch (error: any) {
        console.error("Failed to fetch notification details:", error);
        toast.error(error.response?.data?.message || "Could not load request details.");
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id, api]);

  const handleAction = async () => {
    if (!data || isUpdating || !data.relatedData) return;
    setIsUpdating(true);
    try {
      const { notification, relatedData } = data;
      const endpoint = notification.type === 'ai-request' 
        ? `/ai-request/${relatedData._id}/status` 
        : `/health-request/${relatedData._id}/status`;
      
      const nextStatus = notification.type === 'ai-request' ? 'approved' : 'in-progress';
      
      await api.patch(endpoint, { 
        status: nextStatus,
        technicianNote: "Handled via notification." 
      });

      toast.success(`Request marked as ${nextStatus}!`);
      
      // Refresh local data
      const res = await api.get(`/notifications/${id}`);
      setData(res.data);
    } catch (error: any) {
      console.error("Failed to update status:", error);
      toast.error(error.response?.data?.message || "Failed to update request status.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#00643B" />
      </View>
    );
  }

  if (!data) {
      return (
          <View className="flex-1 bg-white items-center justify-center p-6">
              <Text className="text-slate-500 font-bold text-lg text-center">Notification not found or linked request was deleted.</Text>
              <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-[#00643B] px-6 py-3 rounded-xl">
                  <Text className="text-white font-bold">Go Back</Text>
              </TouchableOpacity>
          </View>
      )
  }

  const { notification, relatedData } = data;
  const isAI = notification.type === 'ai-request';

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View className="pt-14 pb-6 px-6 bg-white border-b border-slate-100 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-slate-50">
          <ArrowLeft size={22} color="#475569" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-slate-800 ml-4">Request Details</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Status Banner */}
        <View className={`px-6 py-4 flex-row items-center ${isAI ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            {isAI ? <Syringe size={20} color="#059669" /> : <HeartPulse size={20} color="#D97706" />}
            <Text className={`ml-2 font-bold ${isAI ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isAI ? 'Artificial Insemination' : 'Animal Health Service'}
            </Text>
            <View className="ml-auto bg-white px-3 py-1 rounded-full border border-slate-100">
                <Text className="text-slate-600 font-bold text-xs uppercase">{relatedData?.status || 'Pending'}</Text>
            </View>
        </View>

        {/* Sender Info (Farmer or Technician) */}
        <View className="p-6 bg-white mb-2 border-b border-slate-100">
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">
              {isFarmer ? "Handled By Technician" : "Requesting Farmer"}
            </Text>
            <View className="flex-row items-center">
                <View className="w-16 h-16 rounded-2xl bg-slate-100 items-center justify-center overflow-hidden">
                    {notification.senderId?.imageUrl ? (
                        <Image source={{ uri: notification.senderId.imageUrl }} className="w-full h-full" />
                    ) : (
                        <User size={30} color="#cbd5e1" />
                    )}
                </View>
                <View className="ml-4 flex-1">
                    <Text className="text-lg font-bold text-slate-800">
                      {notification.senderId?.name || "System / Tech"}
                    </Text>
                    {notification.senderId?.address ? (
                        <View className="flex-row items-center mt-1">
                            <MapPin size={14} color="#94a3b8" />
                            <Text className="text-slate-500 text-sm ml-1">
                                {notification.senderId.address.barangay || "Oton"}, {notification.senderId.address.city || "Iloilo"}
                            </Text>
                        </View>
                    ) : (
                        <Text className="text-slate-400 text-sm">No address provided</Text>
                    )}
                </View>
            </View>
        </View>

        {/* Assigned Technician (If accepted/handled) */}
        {isFarmer && ((isAI && relatedData?.approvedBy) || (!isAI && relatedData?.handledBy)) && (
          <View className="p-6 bg-white mb-2 border-b border-slate-100">
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">
              Assigned Technician
            </Text>
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center overflow-hidden">
                 {isAI ? (
                   relatedData.approvedBy?.imageUrl ? (
                     <Image source={{ uri: relatedData.approvedBy.imageUrl }} className="w-full h-full" />
                   ) : (
                     <User size={24} color="#cbd5e1" />
                   )
                 ) : (
                   relatedData.handledBy?.imageUrl ? (
                     <Image source={{ uri: relatedData.handledBy.imageUrl }} className="w-full h-full" />
                   ) : (
                     <User size={24} color="#cbd5e1" />
                   )
                 )}
               </View>
               <View className="ml-4 flex-1">
                 <Text className="text-base font-bold text-slate-800">
                   {isAI ? relatedData.approvedBy?.name : relatedData.handledBy?.name}
                 </Text>
                <Text className="text-slate-450 text-xs mt-0.5 font-bold uppercase tracking-wider">
                  Field Technician
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Animal Details */}
        {relatedData?.animalId ? (
          <View className="p-6 bg-white mb-2 border-b border-slate-100">
              <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Animal Details</Text>
              <View className="flex-row bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <View className="w-20 h-20 rounded-xl bg-white items-center justify-center overflow-hidden border border-slate-100">
                      {relatedData.animalId.imageUrl ? (
                          <Image source={{ uri: relatedData.animalId.imageUrl }} className="w-full h-full" />
                      ) : (
                          <View className="items-center justify-center"><Text className="text-slate-300 text-[10px] font-bold">No Image</Text></View>
                      )}
                  </View>
                  <View className="ml-4 flex-1 justify-center">
                      <Text className="text-base font-bold text-slate-800">{relatedData.animalId.species} - {relatedData.animalId.breed}</Text>
                      <Text className="text-slate-500 text-sm mt-1">Tag: <Text className="font-bold text-slate-700">{relatedData.animalId.earTag || relatedData.animalId.animalId || 'N/A'}</Text></Text>
                  </View>
              </View>
          </View>
        ) : null}

        {/* Request Content */}
        {relatedData ? (
          <View className="p-6 bg-white mb-2 border-b border-slate-100">
              <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Message / Symptoms</Text>
              <Text className="text-slate-700 text-base leading-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 italic">
                  &quot;{isAI ? relatedData.comment : relatedData.symptoms || 'No additional details provided.'}&quot;
              </Text>
              
              {relatedData.imageUrl ? (
                  <View className="mt-4">
                      <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">Farmer&apos;s Attached Image</Text>
                      <Image 
                          source={{ uri: relatedData.imageUrl }} 
                          className="w-full h-64 rounded-3xl" 
                          resizeMode="cover"
                      />
                  </View>
              ) : null}

              {isFarmer && relatedData.technicianNote ? (
                  <View className="mt-6 pt-6 border-t border-slate-100">
                      <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">Technician&apos;s Note</Text>
                      <Text className="text-slate-700 text-base leading-6 bg-emerald-50 p-4 rounded-2xl border border-emerald-100 italic">
                          &quot;{relatedData.technicianNote}&quot;
                      </Text>
                  </View>
              ) : null}
          </View>
        ) : (
          <View className="p-6 bg-white mb-2 border-b border-slate-100">
              <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Message</Text>
              <Text className="text-slate-700 text-base leading-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 italic">
                  &quot;{notification.message}&quot;
              </Text>
          </View>
        )}

        {/* Metadata */}
        <View className="p-6">
            <View className="flex-row items-center gap-6">
                <View className="flex-row items-center">
                    <Calendar size={16} color="#94a3b8" />
                    <Text className="text-slate-500 text-sm ml-2">
                        {format(new Date(notification.createdAt), 'MMM dd, yyyy')}
                    </Text>
                </View>
                <View className="flex-row items-center">
                    <Clock size={16} color="#94a3b8" />
                    <Text className="text-slate-500 text-sm ml-2">
                        {format(new Date(notification.createdAt), 'hh:mm a')}
                    </Text>
                </View>
            </View>
        </View>

        {/* Action Button */}
        {!isFarmer && relatedData && (
            <View className="px-6 mt-4">
                <TouchableOpacity 
                    disabled={isUpdating || relatedData.status !== 'pending'}
                    className={`py-5 rounded-[22px] items-center justify-center flex-row shadow-sm ${relatedData.status !== 'pending' ? 'bg-slate-300' : isAI ? 'bg-[#00643B]' : 'bg-amber-600'}`}
                    onPress={handleAction}
                >
                    {isUpdating ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <CheckCircle2 size={24} color="white" />
                            <Text className="text-white font-black text-lg ml-2">
                                {relatedData.status === 'pending' ? 'Approve & Handle Request' : `Status: ${relatedData.status}`}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        )}

      </ScrollView>
    </View>
  );
}
