import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ArrowLeft, Bell, Globe, Trash2, Info, Moon, Sun } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../contexts/TranslationContext';
import { useTheme } from '@/lib/theme';
import * as Updates from 'expo-updates';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const { colors, isDark } = useTheme();
  const { t, language: appLanguage, changeLanguage } = useTranslation();

  const primaryColor = isDark ? colors.primary : '#00643B';

  // Settings States
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [clearingCache, setClearingCache] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const notifPref = await AsyncStorage.getItem('settings_notifications');
        if (notifPref !== null) setNotificationsEnabled(notifPref === 'true');
      } catch (e) {}
    };
    loadSettings();
  }, []);

  const lastToastTimeRef = useRef(0);

  const checkRateLimit = async (type: 'cache' | 'updates') => {
    const now = Date.now();
    const key = `settings_ratelimit_${type}`;
    try {
      const stored = await AsyncStorage.getItem(key);
      let timestamps: number[] = stored ? JSON.parse(stored) : [];
      
      // Filter out timestamps older than 15 minutes (900,000 ms)
      timestamps = timestamps.filter(t => now - t < 900000);
      
      if (timestamps.length >= 5) {
        const oldest = timestamps[0];
        const remainingMs = 900000 - (now - oldest);
        const remainingMins = Math.ceil(remainingMs / 60000);
        
        // Limit the toast warning to display once every 3 seconds
        if (now - lastToastTimeRef.current > 3000) {
          lastToastTimeRef.current = now;
          toast.error(`Too many attempts. Please try again in ${remainingMins} minute(s).`);
        }
        return false;
      }
      
      timestamps.push(now);
      await AsyncStorage.setItem(key, JSON.stringify(timestamps));
      return true;
    } catch (e) {
      return true;
    }
  };

  // Sync Settings to Storage
  const toggleNotifications = async () => {
    const nextVal = !notificationsEnabled;
    setNotificationsEnabled(nextVal);
    try {
      await AsyncStorage.setItem('settings_notifications', String(nextVal));
    } catch (e) {}
  };

  const handleClearCache = async () => {
    if (clearingCache || checkingUpdates) return;
    const allowed = await checkRateLimit('cache');
    if (!allowed) return;
    setClearingCache(true);
    toast.loading("Clearing app cache...");
    try {
      // Backup rate limiter stamps and theme preference to avoid losing them
      const cacheLimit = await AsyncStorage.getItem('settings_ratelimit_cache');
      const updatesLimit = await AsyncStorage.getItem('settings_ratelimit_updates');
      const themePref = await AsyncStorage.getItem('theme_preference');
      const notifPref = await AsyncStorage.getItem('settings_notifications');

      await AsyncStorage.clear();

      // Restore backups
      if (cacheLimit) await AsyncStorage.setItem('settings_ratelimit_cache', cacheLimit);
      if (updatesLimit) await AsyncStorage.setItem('settings_ratelimit_updates', updatesLimit);
      if (themePref) await AsyncStorage.setItem('theme_preference', themePref);
      if (notifPref) await AsyncStorage.setItem('settings_notifications', notifPref);

      toast.dismiss();
      toast.success(t('cacheCleared'));
    } catch (e) {
      toast.dismiss();
      toast.error("Failed to clear cache.");
    } finally {
      setClearingCache(false);
    }
  };

  const handleCheckUpdates = async () => {
    if (checkingUpdates || clearingCache) return;
    const allowed = await checkRateLimit('updates');
    if (!allowed) return;
    setCheckingUpdates(true);
    toast.loading("Checking for updates...");
    try {
      const update = await Updates.checkForUpdateAsync();
      toast.dismiss();
      if (update.isAvailable) {
        toast.loading("Downloading update...");
        await Updates.fetchUpdateAsync();
        toast.dismiss();
        toast.success("Update installed! Restarting...");
        await Updates.reloadAsync();
      } else {
        toast.success(`${t('upToDate')} (v1.0.4)`);
      }
    } catch (e) {
      toast.dismiss();
      toast.success(`${t('upToDate')} (v1.0.4)`);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleToggleTheme = async () => {
    const newScheme = colorScheme === 'dark' ? 'light' : 'dark';
    toggleColorScheme();
    try {
      await AsyncStorage.setItem('theme_preference', newScheme);
    } catch (e) {}
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950" style={{ backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View 
        style={{ paddingTop: insets.top + 16, backgroundColor: colors.card, borderBottomColor: colors.border }}
        className="pb-6 px-6 border-b flex-row items-center justify-between"
      >
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: isDark ? colors.background : '#f1f5f9' }}
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textPrimary }} className="text-xl">{t('appSettings')}</Text>
        <View className="w-10" />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 40 }}
      >
        <View className="rounded-3xl p-6 border gap-y-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          
          {/* Theme Settings */}
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-3">
              <View 
                className="w-9 h-9 rounded-xl items-center justify-center"
                style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7' }}
              >
                {isDark ? <Moon size={18} color="#f59e0b" /> : <Sun size={18} color="#f59e0b" />}
              </View>
              <View>
                <Text style={{ fontFamily: 'Outfit_600SemiBold', color: colors.textPrimary }} className="text-sm">{t('themeMode')}</Text>
                <Text style={{ fontFamily: 'Outfit_600SemiBold', color: colors.textMuted }} className="text-xs uppercase">{isDark ? t('darkMode') : t('lightMode')}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleToggleTheme} style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: isDark ? colors.primary : '#cbd5e1', padding: 2, justifyContent: 'center' }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: isDark ? 'flex-end' : 'flex-start' }} />
            </TouchableOpacity>
          </View>

          <View className="h-[1px]" style={{ backgroundColor: colors.border }} />

          {/* Push Notifications */}
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-3">
              <View 
                className="w-9 h-9 rounded-xl items-center justify-center"
                style={{ backgroundColor: colors.tint }}
              >
                <Bell size={18} color={primaryColor} />
              </View>
              <View>
                <Text style={{ fontFamily: 'Outfit_600SemiBold', color: colors.textPrimary }} className="text-sm">{t('pushNotifications')}</Text>
                <Text style={{ fontFamily: 'Outfit_600SemiBold', color: colors.textMuted }} className="text-xs">Alerts on breeding cycles</Text>
              </View>
            </View>
            <TouchableOpacity onPress={toggleNotifications} style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: notificationsEnabled ? primaryColor : '#cbd5e1', padding: 2, justifyContent: 'center' }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: notificationsEnabled ? 'flex-end' : 'flex-start' }} />
            </TouchableOpacity>
          </View>

          <View className="h-[1px]" style={{ backgroundColor: colors.border }} />

          {/* Language Selection */}
          <View>
            <View className="flex-row items-center gap-3 mb-4">
              <View 
                className="w-9 h-9 rounded-xl items-center justify-center"
                style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff' }}
              >
                <Globe size={18} color="#2563eb" />
              </View>
              <View>
                <Text style={{ fontFamily: 'Outfit_600SemiBold', color: colors.textPrimary }} className="text-sm">{t('languagePreference')}</Text>
                <Text style={{ fontFamily: 'Outfit_600SemiBold', color: colors.textMuted }} className="text-xs">Translate core application text</Text>
              </View>
            </View>
            <View className="flex-row gap-3">
              {['English', 'Hiligaynon', 'Filipino'].map((lang: any) => (
                <TouchableOpacity 
                  key={lang}
                  onPress={() => changeLanguage(lang)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: appLanguage === lang ? primaryColor : colors.border,
                    backgroundColor: appLanguage === lang ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,100,59,0.1)') : 'transparent',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: appLanguage === lang ? primaryColor : colors.textMuted }}>{lang}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="h-[1px]" style={{ backgroundColor: colors.border }} />

          {/* Quick System Tools */}
          <View className="flex-row gap-3">
            <TouchableOpacity 
              disabled={clearingCache || checkingUpdates}
              onPress={handleClearCache}
              style={[
                { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.error, backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.05)' },
                (clearingCache || checkingUpdates) && { opacity: 0.5 }
              ]}
            >
              {clearingCache ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <Trash2 size={16} color={colors.error} />
                  <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: colors.error }}>{t('clearCache')}</Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              disabled={clearingCache || checkingUpdates}
              onPress={handleCheckUpdates}
              style={[
                { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: primaryColor },
                (clearingCache || checkingUpdates) && { opacity: 0.5 }
              ]}
            >
              {checkingUpdates ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Info size={16} color="#fff" />
                  <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: '#fff' }}>{t('checkForUpdates')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
