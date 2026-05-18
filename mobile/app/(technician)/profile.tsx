import { View, Text, TouchableOpacity, ScrollView, Image, StatusBar, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChevronRight, LogOut, Settings, HelpCircle, User, Briefcase, Sun, Moon, Shield, Bell, MapPin, Camera, Mail, Phone, Calendar } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#00643B';

const TechnicianProfile = () => {
  const { signOut } = useClerk();
  const { user } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme, toggleColorScheme } = useColorScheme();

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
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 100 }}
        style={{ flex: 1 }}
      >
        {/* Profile Header Backdrop - Now part of the scroll content */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320, backgroundColor: PRIMARY, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 }} />

        {/* Profile Header Content */}
        <View style={{ paddingHorizontal: 24, paddingTop: insets.top + 20, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <Text style={{ fontSize: 24, fontFamily: 'Outfit_900Black', color: '#fff' }}>Account</Text>
            <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={{ backgroundColor: '#fff', borderRadius: 32, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#f1f5f9', borderWidth: 4, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 5, overflow: 'hidden' }}>
                {user?.imageUrl ? (
                  <Image source={{ uri: user.imageUrl }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <User size={40} color="#cbd5e1" />
                  </View>
                )}
                <TouchableOpacity style={{ position: 'absolute', bottom: 0, right: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)', height: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={12} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 20, fontFamily: 'Outfit_900Black', color: '#1e293b' }}>{user?.fullName || 'Technician'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <MapPin size={12} color="#64748b" />
                  <Text style={{ fontSize: 13, fontFamily: 'Outfit_500Medium', color: '#64748b' }}>Oton, Iloilo Office</Text>
                </View>
                <View style={{ backgroundColor: '#ecfdf5', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 10 }}>
                  <Text style={{ color: PRIMARY, fontSize: 10, fontFamily: 'Outfit_800ExtraBold', textTransform: 'uppercase' }}>Senior Technician</Text>
                </View>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 20 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontFamily: 'Outfit_800ExtraBold', color: '#1e293b' }}>124</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#94a3b8', textTransform: 'uppercase' }}>Visits</Text>
              </View>
              <View style={{ width: 1, height: 20, backgroundColor: '#f1f5f9', alignSelf: 'center' }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontFamily: 'Outfit_800ExtraBold', color: '#1e293b' }}>98%</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#94a3b8', textTransform: 'uppercase' }}>Success</Text>
              </View>
              <View style={{ width: 1, height: 20, backgroundColor: '#f1f5f9', alignSelf: 'center' }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontFamily: 'Outfit_800ExtraBold', color: '#1e293b' }}>4.9</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#94a3b8', textTransform: 'uppercase' }}>Rating</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Menu Sections */}
        <View style={{ paddingHorizontal: 24, gap: 24 }}>
          
          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Outfit_800ExtraBold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 8 }}>Personal Workspace</Text>
            <View style={{ backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9' }}>
              <MenuItem 
                icon={<Mail size={18} color="#64748b" />} 
                label="Email & Security" 
                value={user?.primaryEmailAddress?.emailAddress?.split('@')[0] + '...'}
                onPress={() => {}}
              />
              <View style={{ height: 1, backgroundColor: '#f8fafc', marginLeft: 54 }} />
              <MenuItem 
                icon={<Briefcase size={18} color="#64748b" />} 
                label="Service Schedule" 
                onPress={() => {}} 
              />
              <View style={{ height: 1, backgroundColor: '#f8fafc', marginLeft: 54 }} />
              <MenuItem 
                icon={<Bell size={18} color="#64748b" />} 
                label="Notifications" 
                onPress={() => router.push('/notifications')} 
              />
            </View>
          </View>

          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Outfit_800ExtraBold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 8 }}>Preferences</Text>
            <View style={{ backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9' }}>
              <MenuItem 
                icon={colorScheme === 'dark' ? <Sun size={18} color="#64748b" /> : <Moon size={18} color="#64748b" />} 
                label="App Theme" 
                value={colorScheme === 'dark' ? "Dark" : "Light"}
                onPress={handleToggleTheme} 
              />
              <View style={{ height: 1, backgroundColor: '#f8fafc', marginLeft: 54 }} />
              <MenuItem 
                icon={<Shield size={18} color="#64748b" />} 
                label="Privacy Policy" 
                onPress={() => {}} 
              />
              <View style={{ height: 1, backgroundColor: '#f8fafc', marginLeft: 54 }} />
              <MenuItem 
                icon={<HelpCircle size={18} color="#64748b" />} 
                label="Help & Support" 
                onPress={() => {}} 
              />
            </View>
          </View>

          {/* Sign Out Section */}
          <TouchableOpacity 
            onPress={handleSignOut}
            activeOpacity={0.7}
            style={{ backgroundColor: '#fef2f2', paddingVertical: 20, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: '#fee2e2', marginTop: 12 }}
          >
            <LogOut size={20} color="#ef4444" strokeWidth={2.5} />
            <Text style={{ color: '#ef4444', fontFamily: 'Outfit_900Black', fontSize: 16 }}>Log Out Account</Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 11, fontFamily: 'Outfit_700Bold', color: '#cbd5e1', textTransform: 'uppercase' }}>Version 2.4.0 — Premium Build</Text>
          </View>

        </View>

      </ScrollView>
    </View>
  );
};

const MenuItem = ({ icon, label, value, onPress }: any) => (
  <TouchableOpacity 
    onPress={onPress}
    activeOpacity={0.6}
    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 }}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <Text style={{ fontSize: 15, fontFamily: 'Outfit_700Bold', color: '#334155' }}>{label}</Text>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {value && <Text style={{ fontSize: 13, fontFamily: 'Outfit_500Medium', color: '#94a3b8' }}>{value}</Text>}
      <ChevronRight size={18} color="#cbd5e1" />
    </View>
  </TouchableOpacity>
);


export default TechnicianProfile;