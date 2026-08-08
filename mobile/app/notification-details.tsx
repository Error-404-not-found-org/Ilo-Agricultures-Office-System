import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, User, MapPin, Calendar, Clock, CheckCircle2, Syringe, HeartPulse } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { format } from 'date-fns';
import { useUser } from '@clerk/clerk-expo';
import { toast } from 'sonner-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getNotificationTarget, presentNotification } from '@/features/notifications/utils/notificationPresentation';

interface NotificationDetails {
  notification: {
    _id: string;
    title: string;
    message: string;
    type: 'ai-request' | 'health-request' | 'system';
    relatedId?: string;
    category?: string;
    eventType?: string;
    linkType?: 'request' | 'animal' | 'record' | 'task' | 'pregnancy';
    metadata?: {
      animalId?: string;
      observationId?: string;
      taskId?: string | null;
      reportType?: string;
      reportedAt?: string;
      deepLinkTarget?: string;
    };
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
    approvedBy?: { _id?: string; name: string; imageUrl: string };
    handledBy?: { _id?: string; name: string; imageUrl: string };
    heatSigns?: string[];
  };
}

const getAdditionalNotesOnly = (fullComment: string) => {
  if (!fullComment) return "";
  const parts = fullComment.split("Additional Notes:\n");
  if (parts.length > 1) {
    return parts[1].trim();
  }
  if (fullComment.includes("Observed Heat Signs:\n")) {
    return "";
  }
  return fullComment;
};

export default function NotificationDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const api = useApi();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const { data: profile } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const res = await api.get('/user/me');
      return res.data;
    }
  });

  const role =
    profile?.role || (user?.publicMetadata?.role as string | undefined);
  const isFarmer = role === 'farmer';
  const [data, setData] = useState<NotificationDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await api.get(`/notifications/${id}`);
        setData(res.data);
        // Mark as read when viewing details
        if (!res.data.notification.isRead) {
          await api.patch('/notifications/mark-read', { notificationId: id });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      } catch (error: any) {
        console.error("Failed to fetch notification details:", error);
        toast.error(error.response?.data?.message || "Could not load request details.");
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id, api, queryClient]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!data) {
      return (
          <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary, fontSize: 18, textAlign: 'center' }}>This notification is no longer available.</Text>
              <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 }}>The linked item may have been removed, but your other notifications are unchanged.</Text>
              <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={{ minHeight: 44, marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, borderRadius: 12, justifyContent: 'center' }}>
                  <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-white font-bold">Go Back</Text>
              </TouchableOpacity>
          </View>
      )
  }

  const { notification, relatedData } = data;
  const presentation = presentNotification(notification);
  const isAI = notification.type === 'ai-request';
  const isComplete = ["done", "resolved", "completed", "cancelled", "rejected"].includes(
    String(relatedData?.status || "").toLowerCase(),
  );

  const openLinkedRequest = () => {
    const taskId = notification.metadata?.taskId;
    if (taskId && (role === "technician")) {
      router.push({
        pathname: "/(technician)/task-details",
        params: { id: taskId },
      } as any);
      return;
    }
    const target = getNotificationTarget(
      {
        ...notification,
        taskId: taskId || undefined,
        relatedId: notification.relatedId || relatedData?._id,
      },
      role,
    );
    if (target.pathname === "/notification-details") return;
    router.push(target as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.card} />
      
      {/* Header */}
      <View style={{ paddingTop: insets.top + 14, paddingBottom: 14, paddingHorizontal: 20, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }}>
          <ArrowLeft size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text numberOfLines={2} style={{ fontFamily: 'Outfit_900Black', color: colors.textPrimary, fontSize: 20, marginLeft: 12, flex: 1, minWidth: 0 }}>Notification Details</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
        <View style={{ padding: 20, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textPrimary, fontSize: 20, lineHeight: 26 }}>{presentation.title}</Text>
          <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 8 }}>{presentation.body}</Text>
        </View>
        
        {/* Status Banner */}
        <View className="px-6 py-4 flex-row items-center" style={{ backgroundColor: isAI ? (isDark ? 'rgba(16,185,129,0.16)' : '#ecfdf5') : (isDark ? 'rgba(245,158,11,0.16)' : '#fffbeb') }}>
            {isAI ? <Syringe size={20} color="#059669" /> : <HeartPulse size={20} color="#D97706" />}
            <Text style={{ fontFamily: 'Outfit_700Bold', color: isAI ? (isDark ? '#6ee7b7' : '#047857') : (isDark ? '#fcd34d' : '#b45309') }} className="ml-2 font-bold">
                {isAI ? 'Artificial Insemination' : 'Animal Health Service'}
            </Text>
            <View className="ml-auto px-3 py-1 rounded-full border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textSecondary }} className="font-bold text-xs capitalize">{String(relatedData?.status || 'Pending').replaceAll('_', ' ').replaceAll('-', ' ')}</Text>
            </View>
        </View>

        {/* Sender Info (Farmer or Technician) */}
        <View className="p-6 mb-2 border-b" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
            <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">
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
                    <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-lg font-bold">
                      {notification.senderId?.name || "System / Tech"}
                    </Text>
                    {notification.senderId?.address ? (
                        <View className="flex-row items-center mt-1">
                            <MapPin size={14} color="#94a3b8" />
                            <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textSecondary }} className="text-sm ml-1">
                                {notification.senderId.address.barangay || "Oton"}, {notification.senderId.address.city || "Iloilo"}
                            </Text>
                        </View>
                    ) : (
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-sm">No address provided</Text>
                    )}
                </View>
            </View>
        </View>

        {/* Assigned Technician (If accepted/handled) */}
        {isFarmer && ((isAI && relatedData?.approvedBy) || (!isAI && relatedData?.handledBy)) && (
          <View className="p-6 mb-2 border-b" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
            <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">
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
                 <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-base font-bold">
                   {isAI ? relatedData.approvedBy?.name : relatedData.handledBy?.name}
                 </Text>
                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-450 text-xs mt-0.5 font-bold uppercase tracking-wider">
                  Field Technician
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Animal Details */}
        {relatedData?.animalId ? (
          <View className="p-6 mb-2 border-b" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Animal Details</Text>
              <View className="flex-row p-4 rounded-2xl border" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
                  <View className="w-20 h-20 rounded-xl items-center justify-center overflow-hidden border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                      {relatedData.animalId.imageUrl ? (
                          <Image source={{ uri: relatedData.animalId.imageUrl }} className="w-full h-full" />
                      ) : (
                          <View className="items-center justify-center">
                              <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-300 text-[10px] font-bold">No Image</Text>
                          </View>
                      )}
                  </View>
                  <View className="ml-4 flex-1 justify-center">
                      <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-base font-bold">{relatedData.animalId.species} - {relatedData.animalId.breed}</Text>
                      <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textSecondary }} className="text-sm mt-1">Tag: <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="font-bold">{relatedData.animalId.earTag || relatedData.animalId.animalId || 'N/A'}</Text></Text>
                  </View>
              </View>
          </View>
        ) : null}

        {/* Request Content */}
        {relatedData ? (
          <View className="p-6 mb-2 border-b" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              {/* Heat Signs List (if AI Insemination request) */}
              {isAI && relatedData.heatSigns && relatedData.heatSigns.length > 0 ? (
                <View className="mb-6">
                  <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">Observed Heat Signs</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {relatedData.heatSigns.map((signId: string) => {
                      const signMap: Record<string, string> = {
                        standing_heat: "Standing Heat 🐮",
                        attempt_mount: "Attempting to Mount",
                        restlessness: "Restlessness / Activity",
                        vocalization: "Vocalization (Bellowing)",
                        flehmen: "Flehmen Response",
                        grouping: "Friendly Grouping",
                        mucus_discharge: "Clear Mucus Discharge 💧",
                        swollen_vulva: "Swollen, Red Vulva",
                        muddy_flanks: "Muddy Flanks / Tailhead",
                        metestrus_bleeding: "Metestrus Bleeding 🩸",
                      };
                      const label = signMap[signId] || signId;
                      const isPrimary = signId === "standing_heat";
                      const isBleeding = signId === "metestrus_bleeding";

                      let badgeBg = "rgba(16, 185, 129, 0.1)";
                      let badgeText = "#065F46";
                      let badgeBorder = "#d1fae5";

                      if (isPrimary) {
                        badgeBg = "#FEF3C7";
                        badgeText = "#92400E";
                        badgeBorder = "#FEF3C7";
                      } else if (isBleeding) {
                        badgeBg = "#FEF2F2";
                        badgeText = "#991B1B";
                        badgeBorder = "#fecaca";
                      }

                      return (
                        <View
                          key={signId}
                          className="px-3 py-1.5 rounded-xl border"
                          style={{
                            backgroundColor: badgeBg,
                            borderColor: badgeBorder,
                          }}
                        >
                          <Text
                            style={{ color: badgeText, fontFamily: 'Outfit_800ExtraBold' }}
                            className="text-[10px] font-black uppercase tracking-wider"
                          >
                            {label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {(!isAI && (relatedData.comment || relatedData.symptoms)) || (isAI && getAdditionalNotesOnly(relatedData.comment || "")) ? (
                <View>
                  <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">
                    {isAI ? "Additional Comments" : "Message / Symptoms"}
                  </Text>
                  <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textPrimary, backgroundColor: colors.background, borderColor: colors.border }} className="text-base leading-6 p-4 rounded-2xl border italic">
                      &quot;{isAI ? getAdditionalNotesOnly(relatedData.comment || "") : relatedData.symptoms || 'No additional details provided.'}&quot;
                  </Text>
                </View>
              ) : null}
              
              {relatedData.imageUrl ? (
                  <View className="mt-4">
                      <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">Farmer&apos;s Attached Image</Text>
                      <Image 
                          source={{ uri: relatedData.imageUrl }} 
                          className="w-full h-64 rounded-3xl" 
                          resizeMode="cover"
                      />
                  </View>
              ) : null}

              {isFarmer && relatedData.technicianNote ? (
                  <View className="mt-6 pt-6 border-t border-slate-100">
                      <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">Technician&apos;s Note</Text>
                      <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-700 text-base leading-6 bg-emerald-50 p-4 rounded-2xl border border-emerald-100 italic">
                          &quot;{relatedData.technicianNote}&quot;
                      </Text>
                  </View>
              ) : null}
          </View>
        ) : (
          <View className="p-6 mb-2 border-b" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Message</Text>
              <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textPrimary, backgroundColor: colors.background, borderColor: colors.border }} className="text-base leading-6 p-4 rounded-2xl border italic">
                  &quot;{presentation.body}&quot;
              </Text>
          </View>
        )}

        {/* Metadata */}
        <View className="p-6">
            <View className="flex-row items-center gap-6">
                <View className="flex-row items-center">
                    <Calendar size={16} color="#94a3b8" />
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-500 text-sm ml-2">
                        {format(new Date(notification.createdAt), 'MMM dd, yyyy')}
                    </Text>
                </View>
                <View className="flex-row items-center">
                    <Clock size={16} color="#94a3b8" />
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-500 text-sm ml-2">
                        {format(new Date(notification.createdAt), 'hh:mm a')}
                    </Text>
                </View>
            </View>
        </View>

        {/* Action Button */}
        {!isFarmer && relatedData && (() => {
          const getTechId = (tech: any) => {
            if (!tech) return null;
            return typeof tech === 'object' ? tech._id : tech;
          };

          const reqTechId = getTechId(relatedData?.approvedBy) || getTechId(relatedData?.handledBy);

          const isLocked =
            reqTechId &&
            profile?._id &&
            String(reqTechId) !== String(profile._id);

          const reqTechName =
            relatedData?.approvedBy?.name ||
            relatedData?.handledBy?.name ||
            (isLocked ? "another technician" : "");

          const buttonText = isLocked
            ? `Locked by ${reqTechName}`
            : isComplete
              ? "Open Completed Service"
              : "Open Request Details";

          return (
            <View className="px-6 mt-4">
                <TouchableOpacity 
                    disabled={isLocked}
                    className={`py-5 rounded-[22px] items-center justify-center flex-row shadow-sm ${isLocked ? 'bg-slate-350 dark:bg-slate-800' : isAI ? 'bg-[#00643B]' : 'bg-amber-600'}`}
                    onPress={openLinkedRequest}
                >
                    <CheckCircle2 size={24} color="white" />
                    <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-white font-black text-lg ml-2">
                        {buttonText}
                    </Text>
                </TouchableOpacity>
                {!isLocked && (
                  <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-400 text-xs text-center mt-3">
                    Use the full technician screen to schedule, record, or review this service.
                  </Text>
                )}
            </View>
          );
        })()}

      </ScrollView>
    </View>
  );
}
