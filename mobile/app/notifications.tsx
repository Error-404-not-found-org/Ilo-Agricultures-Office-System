import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StatusBar, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, Info, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner-native';
import { useUser } from '@clerk/clerk-expo';

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: 'ai-request' | 'health-request' | 'system';
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const api = useApi();
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string) || 'technician';

  // Brand theme based on role
  const THEME = {
    primary:    role === 'admin' ? '#1e3a5f' : '#00643B',
    light:      role === 'admin' ? '#eff6ff' : '#ecfdf5',
    border:     role === 'admin' ? '#bfdbfe' : '#a7f3d0',
    dot:        role === 'admin' ? '#3b82f6' : '#10b981',
    markRead:   role === 'admin' ? 'text-blue-700' : 'text-emerald-700',
    unreadBg:   role === 'admin' ? 'bg-blue-50/50' : 'bg-emerald-50/50',
    unreadBorder: role === 'admin' ? 'border-blue-100' : 'border-emerald-100',
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (error: any) {
      console.error("Failed to fetch notifications:", error);
      toast.error(error.response?.data?.message || "Could not load notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/mark-read');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error: any) {
      console.error("Failed to mark all as read:", error);
      toast.error("Could not mark notifications as read.");
    }
  };

  const getIcon = (type: string, isRead: boolean) => {
    const opacity = isRead ? 0.6 : 1;
    if (type === 'ai-request') return (
      <View style={{ backgroundColor: THEME.light }} className="w-12 h-12 rounded-full items-center justify-center">
        <CheckCircle2 size={24} color={THEME.primary} style={{ opacity }} />
      </View>
    );
    if (type === 'health-request') return (
      <View className="w-12 h-12 bg-amber-100 rounded-full items-center justify-center">
        <AlertCircle size={24} color="#D97706" style={{ opacity }} />
      </View>
    );
    if (type === 'system') return (
      <View className="w-12 h-12 bg-slate-100 rounded-full items-center justify-center">
        <Bell size={24} color="#475569" style={{ opacity }} />
      </View>
    );
    return (
      <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center">
        <Info size={24} color="#2563EB" style={{ opacity }} />
      </View>
    );
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
        activeOpacity={0.7}
        className={`flex-row p-4 mb-3 rounded-2xl border ${item.isRead ? 'bg-white border-slate-100' : `${THEME.unreadBg} ${THEME.unreadBorder} shadow-sm`}`}
        onPress={() => {
            if (!item.isRead) {
                api.patch('/notifications/mark-read', { notificationId: item._id });
                setNotifications(prev => prev.map(n => n._id === item._id ? { ...n, isRead: true } : n));
            }
            router.push({ pathname: '/notification-details', params: { id: item._id } });
        }}
    >
        {getIcon(item.type, item.isRead)}
        
        <View className="flex-1 ml-4 justify-center">
            <View className="flex-row justify-between items-start mb-1">
                <Text className={`text-base font-bold flex-1 mr-2 ${item.isRead ? 'text-slate-700' : 'text-slate-900'}`}>{item.title}</Text>
                {!item.isRead && <View className="w-2.5 h-2.5 rounded-full mt-1.5" style={{ backgroundColor: THEME.dot }} />}
            </View>
            <Text className={`text-[13px] leading-5 ${item.isRead ? 'text-slate-500' : 'text-slate-600 font-medium'}`}>{item.message}</Text>
            <Text className="text-slate-400 text-xs mt-2 font-medium">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</Text>
        </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <StatusBar barStyle="light-content" />
      
      <View className="absolute top-0 left-0 right-0 h-[180px]" style={{ backgroundColor: THEME.primary }} />

      <View className="pt-14 px-6 mb-6 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/20 rounded-full items-center justify-center">
              <ArrowLeft size={22} color="white" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-white tracking-wide">Notifications</Text>
          {/* Role badge */}
          <View className="bg-white/20 px-3 py-1 rounded-full">
              <Text className="text-white text-xs font-bold uppercase tracking-wider">{role}</Text>
          </View>
      </View>

      <View 
        className="flex-1 bg-[#F9FAFB] rounded-t-[32px] px-6 pt-8 shadow-lg"
        style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 8 }}
      >
        <View className="flex-row justify-between items-center mb-6">
            <Text className="text-[20px] font-bold text-slate-800">Recent Updates</Text>
          <TouchableOpacity onPress={markAllAsRead}>
              <Text className={`font-bold text-sm ${THEME.markRead}`}>Mark all as read</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
            <View className="flex-1 items-center justify-center pb-20">
                <ActivityIndicator size="large" color={THEME.primary} />
            </View>
        ) : notifications.length > 0 ? (
            <FlatList 
                data={notifications}
                keyExtractor={item => item._id}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => fetchNotifications(true)} colors={[THEME.primary]} />
                }
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={renderItem}
            />
        ) : (
            <View className="flex-1 items-center justify-center opacity-50 pb-20">
                <Bell size={64} color="#94a3b8" />
                <Text className="text-slate-500 font-medium text-lg mt-4">You're all caught up!</Text>
            </View>
        )}
      </View>
    </View>
  );
}
