import { View, TouchableOpacity, ScrollView, Image, StatusBar, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { ChevronRight, LogOut, Settings, HelpCircle, User, Briefcase, Sun, Moon, Shield, Bell, MapPin, Camera, Mail } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Theme system and UI components
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { useApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

const TechnicianProfile = () => {
  const { signOut } = useClerk();
  const { user } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { colorScheme, toggleColorScheme } = useColorScheme();

  const api = useApi();
  const { data: performanceData } = useQuery({
    queryKey: ['technician', 'performance'],
    queryFn: async () => {
      const res = await api.get('/analytics/my-performance');
      return res.data;
    }
  });

  const aiStats = performanceData?.ai || { totalAI: 0, successfulAI: 0, failedAI: 0, pendingPD: 0 };
  const healthStats = performanceData?.health || { totalResolved: 0, totalInProgress: 0 };
  const totalVisits = aiStats.totalAI + healthStats.totalResolved + healthStats.totalInProgress;
  const successRate = aiStats.totalAI > 0 
    ? Math.round((aiStats.successfulAI / aiStats.totalAI) * 100) 
    : 0;
  
  // Dynamic rating based on conception success rate, defaulting to 4.8
  const rating = totalVisits > 0 
    ? (4.0 + (successRate / 100) * 1.0).toFixed(1) 
    : "4.8";

  const handleToggleTheme = async () => {
    const newScheme = colorScheme === 'dark' ? 'light' : 'dark';
    toggleColorScheme();
    try {
      await AsyncStorage.setItem('theme_preference', newScheme);
    } catch (e) {
      console.warn("Failed to save theme preference:", e);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out completely");
      router.replace('/(auth)');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 100 }}
        style={{ flex: 1 }}
      >
        {/* Profile Header Backdrop - forest green in both light/dark */}
        <View 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            height: 320, 
            backgroundColor: isDark ? "#064e3e" : "#00643B", 
            borderBottomLeftRadius: 40, 
            borderBottomRightRadius: 40 
          }} 
        />

        {/* Profile Header Content */}
        <View style={{ paddingHorizontal: 24, paddingTop: insets.top + 20, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <Text variant="black" size={24} style={{ color: '#fff' }}>Account</Text>
            <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Profile Card component */}
          <Card style={{ borderRadius: 32, padding: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? colors.background : '#f1f5f9', borderWidth: 4, borderColor: colors.card, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 5, overflow: 'hidden' }}>
                {user?.imageUrl ? (
                  <Image source={{ uri: user.imageUrl }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <User size={40} color={colors.textMuted} />
                  </View>
                )}
                <TouchableOpacity style={{ position: 'absolute', bottom: 0, right: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)', height: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={12} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="black" size={20} style={{ color: colors.textPrimary }}>{user?.fullName || 'Technician'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <MapPin size={12} color={colors.textSecondary} />
                  <Text variant="medium" size={13} style={{ color: colors.textSecondary }}>Oton, Iloilo Office</Text>
                </View>
                <View style={{ backgroundColor: isDark ? '#064e3b' : '#ecfdf5', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 10 }}>
                  <Text style={{ color: isDark ? '#34d399' : '#00643B', fontSize: 10, fontFamily: 'Outfit_800ExtraBold', textTransform: 'uppercase' }}>Senior Technician</Text>
                </View>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 20 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ alignItems: 'center' }}>
                <Text variant="extrabold" size={16} style={{ color: colors.textPrimary }}>{totalVisits}</Text>
                <Text variant="bold" size={10} style={{ color: colors.textMuted, textTransform: 'uppercase' }}>Visits</Text>
              </View>
              <View style={{ width: 1, height: 20, backgroundColor: colors.border, alignSelf: 'center' }} />
              <View style={{ alignItems: 'center' }}>
                <Text variant="extrabold" size={16} style={{ color: colors.textPrimary }}>{successRate}%</Text>
                <Text variant="bold" size={10} style={{ color: colors.textMuted, textTransform: 'uppercase' }}>Success</Text>
              </View>
              <View style={{ width: 1, height: 20, backgroundColor: colors.border, alignSelf: 'center' }} />
              <View style={{ alignItems: 'center' }}>
                <Text variant="extrabold" size={16} style={{ color: colors.textPrimary }}>{rating}</Text>
                <Text variant="bold" size={10} style={{ color: colors.textMuted, textTransform: 'uppercase' }}>Rating</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Menu Sections */}
        <View style={{ paddingHorizontal: 24, gap: 24 }}>
          
          <View>
            <Text variant="extrabold" size={12} style={{ color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 8 }}>Personal Workspace</Text>
            <View style={{ backgroundColor: colors.card, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              <MenuItem 
                icon={<Mail size={18} color={colors.textSecondary} />} 
                label="Email & Security" 
                value={user?.primaryEmailAddress?.emailAddress?.split('@')[0] + '...'}
                onPress={() => {}}
              />
              <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 54 }} />
              <MenuItem 
                icon={<Briefcase size={18} color={colors.textSecondary} />} 
                label="Service Schedule" 
                onPress={() => {}} 
              />
              <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 54 }} />
              <MenuItem 
                icon={<Bell size={18} color={colors.textSecondary} />} 
                label="Notifications" 
                onPress={() => router.push('/notifications')} 
              />
            </View>
          </View>

          <View>
            <Text variant="extrabold" size={12} style={{ color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 8 }}>Preferences</Text>
            <View style={{ backgroundColor: colors.card, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              <MenuItem 
                icon={colorScheme === 'dark' ? <Sun size={18} color={colors.textSecondary} /> : <Moon size={18} color={colors.textSecondary} />} 
                label="App Theme" 
                value={colorScheme === 'dark' ? "Dark" : "Light"}
                onPress={handleToggleTheme} 
              />
              <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 54 }} />
              <MenuItem 
                icon={<Shield size={18} color={colors.textSecondary} />} 
                label="Privacy Policy" 
                onPress={() => router.push('/privacy-policy' as any)} 
              />
              <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 54 }} />
              <MenuItem 
                icon={<HelpCircle size={18} color={colors.textSecondary} />} 
                label="Help & Support" 
                onPress={() => router.push('/help-center')} 
              />
            </View>
          </View>

          {/* Sign Out Section */}
          <TouchableOpacity 
            onPress={handleSignOut}
            activeOpacity={0.7}
            style={{ 
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2', 
              paddingVertical: 20, 
              borderRadius: 24, 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 10, 
              borderWidth: 1, 
              borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2', 
              marginTop: 12 
            }}
          >
            <LogOut size={20} color="#ef4444" strokeWidth={2.5} />
            <Text variant="black" size={16} style={{ color: '#ef4444' }}>Log Out Account</Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text variant="bold" size={11} style={{ color: colors.textMuted, textTransform: 'uppercase' }}>Version 2.4.0 — Premium Build</Text>
          </View>

        </View>

      </ScrollView>
    </View>
  );
};

const MenuItem = ({ icon, label, value, onPress }: any) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.6}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
        <Text variant="bold" size={15} style={{ color: colors.textPrimary }}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {value && <Text variant="medium" size={13} style={{ color: colors.textMuted }}>{value}</Text>}
        <ChevronRight size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
};

export default TechnicianProfile;
