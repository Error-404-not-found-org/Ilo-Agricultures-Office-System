import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Bell } from 'lucide-react-native';
import { useRouter, useSegments } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { useApi } from '@/lib/api';
import { useNetInfo } from '@react-native-community/netinfo';
import { getOfflineQueue } from '@/lib/offlineQueue';

export default function Header() {
  const router = useRouter();
  const segments = useSegments();
  const { user } = useUser();
  const api = useApi();
  const netInfo = useNetInfo();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await api.get('/notifications/unread-count');
        setUnreadCount(res.data.count);
      } catch (err) {
        // Silently fail for header
      }
    };
    if (user) fetchUnread();
  }, [user, api]);

  // Sync Pending Actions Count
  useEffect(() => {
    const updateSyncCount = async () => {
      const queue = await getOfflineQueue();
      setPendingSyncCount(queue.length);
    };
    
    updateSyncCount();
    
    // Check every 10 seconds or when coming back online
    const interval = setInterval(updateSyncCount, 10000);
    return () => clearInterval(interval);
  }, [netInfo.isConnected]);

  const isAdmin = (segments as string[]).includes('(admin)');
  const isFarmer = (segments as string[]).includes('(farmer)');
  const isTechnician = (segments as string[]).includes('(technician)');

  const roleLabel = isAdmin ? 'Administrator' : isFarmer ? 'Farmer' : 'Technician';

  const userRole = user?.publicMetadata?.role;
  // Guard against showing wrong header in wrong route group
  if (userRole) {
    if (isAdmin && userRole !== 'admin') return null;
    if (isFarmer && userRole !== 'farmer') return null;
    if (isTechnician && userRole !== 'technician') return null;
  }

  const PRIMARY_COLOR = isAdmin ? '#1e3a5f' : isFarmer || isTechnician ? '#00643B' : '#00643B';
  const ACCENT_BG = isAdmin ? '#162d4a' : '#005230';
  const ICON_COLOR = isAdmin ? '#93c5fd' : '#86EFAC';
  const DATE_TEXT = isAdmin ? 'text-blue-100/90' : 'text-emerald-100/90';

  // Get current date string like "Sunday, 01 Dec 2024"
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' };
  const today = new Date().toLocaleDateString('en-GB', dateOptions);

  return (
    <View className="flex-row justify-between items-center px-6 pt-16 pb-12 z-10 w-full bg-transparent">
      
      {/* Left side: Avatar + Greeting & Date */}
      <View className="flex-row items-center gap-3">
        {/* User Avatar Section */}
        <TouchableOpacity
          onPress={() => {
            if (isAdmin) router.push('/(admin)/profile' as any);
            else if (isFarmer) router.push('/(farmer)/profile');
            else router.push('/(technician)/profile');
          }}
          activeOpacity={0.8}
        >
          <View
            className="w-12 h-12 rounded-full border-[2px] border-white/20 items-center justify-center overflow-hidden shadow-sm"
            style={{ backgroundColor: ACCENT_BG }}
          >
               {user?.imageUrl ? (
                  <Image source={{ uri: user.imageUrl }} className="w-full h-full" />
               ) : (
                  <MaterialCommunityIcons name="account" size={26} color={ICON_COLOR} />
               )}
          </View>
        </TouchableOpacity>
        
        {/* Greeting & Date Section */}
        <View>
          <Text className="text-white text-[20px] font-bold tracking-tight">
            Hello, {user?.firstName || user?.lastName || 'User'}
          </Text>
          <Text className="text-white text-[12px] mt-0.5 font-medium">{roleLabel}</Text>
          <Text className={`text-[12px] mt-0.5 font-medium ${DATE_TEXT}`}>
            {today}
          </Text>
        </View>
      </View>

      {/* Right side: Action Buttons */}
      <View className="flex-row items-center gap-2">
        {/* Connectivity Status */}
        <TouchableOpacity 
          onPress={() => router.push('/(technician)/sync-history' as any)}
          activeOpacity={0.7}
          className={`w-10 h-10 ${netInfo.isConnected ? 'bg-white/10' : 'bg-amber-500/20'} rounded-full items-center justify-center relative`}
        >
           <MaterialCommunityIcons 
             name={netInfo.isConnected ? "cloud-check" : "cloud-off-outline"} 
             size={20} 
             color={netInfo.isConnected ? ICON_COLOR : "#f59e0b"} 
           />
           {pendingSyncCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-amber-500 w-4 h-4 rounded-full border border-white items-center justify-center">
                <Text className="text-white text-[9px] font-bold">{pendingSyncCount}</Text>
              </View>
           )}
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.push('/notifications')}
          className="w-10 h-10 bg-white/10 rounded-full items-center justify-center p-0"
          activeOpacity={0.7}
        >
          <View>
            <Bell size={20} color="white" />
            {unreadCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-red-500 w-4 h-4 rounded-full border border-white items-center justify-center">
                <Text className="text-white text-[9px] font-bold">{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
      
    </View>
  );
}