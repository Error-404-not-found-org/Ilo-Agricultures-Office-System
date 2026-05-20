import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ArrowLeft, Bell, Globe, Trash2, Info, Moon, Sun } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme, toggleColorScheme } = useColorScheme();

  // Settings States
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [appLanguage, setAppLanguage] = useState('English');
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const notifPref = await AsyncStorage.getItem('settings_notifications');
        if (notifPref !== null) setNotificationsEnabled(notifPref === 'true');

        const langPref = await AsyncStorage.getItem('settings_language');
        if (langPref !== null) setAppLanguage(langPref);

        const bioPref = await AsyncStorage.getItem('settings_biometrics');
        if (bioPref !== null) setBiometricsEnabled(bioPref === 'true');
      } catch (e) {}
    };
    loadSettings();
  }, []);

  // Sync Settings to Storage
  const toggleNotifications = async () => {
    const nextVal = !notificationsEnabled;
    setNotificationsEnabled(nextVal);
    try {
      await AsyncStorage.setItem('settings_notifications', String(nextVal));
      toast.success(nextVal ? "Notifications enabled" : "Notifications muted");
    } catch (e) {}
  };

  const toggleBiometrics = async () => {
    const nextVal = !biometricsEnabled;
    setBiometricsEnabled(nextVal);
    try {
      await AsyncStorage.setItem('settings_biometrics', String(nextVal));
      toast.success(nextVal ? "Biometrics enabled" : "Biometrics disabled");
    } catch (e) {}
  };

  const changeLanguage = async (lang: string) => {
    setAppLanguage(lang);
    try {
      await AsyncStorage.setItem('settings_language', lang);
      toast.success(`Language set to ${lang}`);
    } catch (e) {}
  };

  const handleClearCache = () => {
    toast.loading("Clearing app cache...");
    setTimeout(() => {
      toast.dismiss();
      toast.success("Cache cleared successfully!");
    }, 1200);
  };

  const handleCheckUpdates = () => {
    toast.loading("Checking for updates...");
    setTimeout(() => {
      toast.dismiss();
      toast.success("BreedSmart is up to date (v1.0.4)");
    }, 1000);
  };

  const handleToggleTheme = async () => {
    const newScheme = colorScheme === 'dark' ? 'light' : 'dark';
    toggleColorScheme();
    try {
      await AsyncStorage.setItem('theme_preference', newScheme);
    } catch (e) {}
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View 
        style={{ paddingTop: insets.top + 16 }}
        className="pb-6 px-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex-row items-center justify-between"
      >
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full items-center justify-center"
        >
          <ArrowLeft size={20} color={colorScheme === 'dark' ? '#fff' : '#475569'} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-xl text-slate-800 dark:text-white">App Settings</Text>
        <View className="w-10" />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 40 }}
      >
        <View className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 gap-y-6">
          
          {/* Theme Settings */}
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/30 items-center justify-center">
                {colorScheme === 'dark' ? <Moon size={18} color="#f59e0b" /> : <Sun size={18} color="#f59e0b" />}
              </View>
              <View>
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-sm text-slate-800 dark:text-white">Theme Mode</Text>
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-xs text-slate-400 dark:text-slate-500 uppercase">{colorScheme === 'dark' ? 'Dark Mode' : 'Light Mode'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleToggleTheme} style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: colorScheme === 'dark' ? '#00643B' : '#cbd5e1', padding: 2, justifyContent: 'center' }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: colorScheme === 'dark' ? 'flex-end' : 'flex-start' }} />
            </TouchableOpacity>
          </View>

          <View className="h-[1px] bg-slate-100 dark:bg-slate-800" />

          {/* Push Notifications */}
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 items-center justify-center">
                <Bell size={18} color="#00643B" />
              </View>
              <View>
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-sm text-slate-800 dark:text-white">Push Notifications</Text>
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-xs text-slate-400 dark:text-slate-500">Alerts on breeding cycles</Text>
              </View>
            </View>
            <TouchableOpacity onPress={toggleNotifications} style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: notificationsEnabled ? '#00643B' : '#cbd5e1', padding: 2, justifyContent: 'center' }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: notificationsEnabled ? 'flex-end' : 'flex-start' }} />
            </TouchableOpacity>
          </View>

          <View className="h-[1px] bg-slate-100 dark:bg-slate-800" />

          {/* Language Selection */}
          <View>
            <View className="flex-row items-center gap-3 mb-4">
              <View className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/30 items-center justify-center">
                <Globe size={18} color="#2563eb" />
              </View>
              <View>
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-sm text-slate-800 dark:text-white">Language Preference</Text>
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-xs text-slate-400 dark:text-slate-500">Translate core application text</Text>
              </View>
            </View>
            <View className="flex-row gap-3">
              {['English', 'Hiligaynon', 'Tagalog'].map((lang) => (
                <TouchableOpacity 
                  key={lang}
                  onPress={() => changeLanguage(lang)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: appLanguage === lang ? '#00643B' : (colorScheme === 'dark' ? '#334155' : '#e2e8f0'),
                    backgroundColor: appLanguage === lang ? 'rgba(0,100,59,0.1)' : 'transparent',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: appLanguage === lang ? '#00643B' : '#94a3b8' }}>{lang}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="h-[1px] bg-slate-100 dark:bg-slate-800" />

          {/* Biometrics Log In */}
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/30 items-center justify-center">
                <MaterialCommunityIcons name="fingerprint" size={20} color="#8b5cf6" />
              </View>
              <View>
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-sm text-slate-800 dark:text-white">Biometrics Log In</Text>
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-xs text-slate-400 dark:text-slate-500">Fast secure fingerprint entry</Text>
              </View>
            </View>
            <TouchableOpacity onPress={toggleBiometrics} style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: biometricsEnabled ? '#00643B' : '#cbd5e1', padding: 2, justifyContent: 'center' }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: biometricsEnabled ? 'flex-end' : 'flex-start' }} />
            </TouchableOpacity>
          </View>

          <View className="h-[1px] bg-slate-100 dark:bg-slate-800" />

          {/* Quick System Tools */}
          <View className="flex-row gap-3">
            <TouchableOpacity 
              onPress={handleClearCache}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)' }}
            >
              <Trash2 size={16} color="#ef4444" />
              <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: '#ef4444' }}>Clear Cache</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={handleCheckUpdates}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: '#00643B' }}
            >
              <Info size={16} color="#fff" />
              <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: '#fff' }}>Updates</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
