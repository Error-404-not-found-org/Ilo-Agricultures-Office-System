import React from 'react';
import { View, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Shield, Lock, Database, FileText, Mail } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const primaryColor = isDark ? colors.primary : '#00643B';
  const headerBgColor = isDark ? '#064e3e' : '#00643B';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View 
        style={{ 
          paddingTop: insets.top + 16, 
          paddingBottom: 24, 
          paddingHorizontal: 24, 
          backgroundColor: headerBgColor,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 4,
          zIndex: 10
        }}
      >
        <TouchableOpacity 
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={{ 
            width: 40, 
            height: 40, 
            borderRadius: 20, 
            backgroundColor: 'rgba(255, 255, 255, 0.15)', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}
        >
          <ChevronLeft size={22} color="#ffffff" />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center', marginRight: 40 }}>
          <Text variant="black" size={18} style={{ color: '#ffffff' }}>Privacy Policy</Text>
          <Text variant="bold" size={9} style={{ color: isDark ? '#a7f3d0' : '#d1fae5', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>
            Last Updated: June 2026
          </Text>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 40 }}
      >
        <Text variant="semibold" size={14} style={{ color: colors.textSecondary, marginBottom: 20, lineHeight: 22 }}>
          Welcome to the ILO-AGRI Hub mobile application. We are deeply committed to protecting your personal information and your farm's operational records. This Privacy Policy details how we handle data to support sustainable agriculture and technical operations in Oton, Iloilo.
        </Text>

        <View style={{ gap: 20 }}>
          {/* Card 1: Data Collection */}
          <Card>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
                <Database size={20} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="extrabold" size={15} style={{ color: colors.textPrimary, marginBottom: 6 }}>1. Information We Collect</Text>
                <Text variant="medium" size={13} style={{ color: colors.textSecondary, lineHeight: 20 }}>
                  We collect user profiles (name, phone, barangay location) and livestock records including tag IDs, breeding histories, heat detection dates, and calving cycles to log actions.
                </Text>
              </View>
            </View>
          </Card>

          {/* Card 2: How We Use Data */}
          <Card>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={20} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="extrabold" size={15} style={{ color: colors.textPrimary, marginBottom: 6 }}>2. How We Use Information</Text>
                <Text variant="medium" size={13} style={{ color: colors.textSecondary, lineHeight: 20 }}>
                  Your data is used to optimize artificial insemination schedules, calculate pregnancy timelines, dispatch technician routes, and trigger automatic health notification updates.
                </Text>
              </View>
            </View>
          </Card>

          {/* Card 3: Storage & Security */}
          <Card>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={20} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="extrabold" size={15} style={{ color: colors.textPrimary, marginBottom: 6 }}>3. Data Storage & Encryption</Text>
                <Text variant="medium" size={13} style={{ color: colors.textSecondary, lineHeight: 20 }}>
                  All offline cached data remains encrypted on your local device. Central synchronization uses end-to-end HTTPS transfers, and authentication is securely handled by Clerk.
                </Text>
              </View>
            </View>
          </Card>

          {/* Card 4: Access and Control */}
          <Card>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={20} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="extrabold" size={15} style={{ color: colors.textPrimary, marginBottom: 6 }}>4. Your Controls & Choices</Text>
                <Text variant="medium" size={13} style={{ color: colors.textSecondary, lineHeight: 20 }}>
                  You hold full rights to view, update, and manage your livestock information. You can also purge local app caches instantly from the account settings tab at any time.
                </Text>
              </View>
            </View>
          </Card>

          {/* Contact details */}
          <View 
            style={{ 
              marginTop: 10,
              padding: 20, 
              borderRadius: 24, 
              backgroundColor: colors.card, 
              borderWidth: 1, 
              borderColor: colors.border, 
              borderLeftWidth: 5, 
              borderLeftColor: primaryColor 
            }}
          >
            <Text variant="extrabold" size={15} style={{ color: colors.textPrimary, marginBottom: 4 }}>Questions or Concerns?</Text>
            <Text variant="semibold" size={12} style={{ color: colors.textMuted, marginBottom: 16 }}>
              Contact our Data Protection Office for any privacy inquiries.
            </Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Mail size={16} color={primaryColor} />
              <Text variant="bold" size={13} style={{ color: colors.textSecondary }}>oton.agri.privacy@gmail.com</Text>
            </View>
          </View>

          <Text variant="bold" size={11} style={{ color: colors.textMuted, textAlign: 'center', marginTop: 12 }}>
            ILO-AGRI Hub • Compliance Team
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
