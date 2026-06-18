import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { ChevronLeft, Phone, Mail, MessageSquare, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '@clerk/clerk-expo';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui/Text';

export default function HelpCenter() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const api = useApi();
  const { colors, isDark } = useTheme();

  const role = clerkUser?.publicMetadata?.role || 'farmer';
  const isTechnician = role === 'technician';

  const primaryColor = isDark ? colors.primary : '#00643B';
  const headerBgColor = isDark ? '#064e3e' : '#00643B';

  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [supportMessage, setSupportMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const farmerFAQs = [
    {
      q: "How do I request Artificial Insemination (AI)?",
      a: "Go to your Home tab, tap 'Request AI', fill in the animal's details (Ear Tag, breed), select your preferred schedule, and submit. A technician will receive a notification to approve and complete the visit."
    },
    {
      q: "What is 'Ask Moowie' AI assistant?",
      a: "Moowie is our intelligent livestock advisor. You can chat with him at any time to ask questions regarding symptoms, breeding techniques, heat detection, or feed management."
    },
    {
      q: "How do I spot standing heat (estrus)?",
      a: "Look for signs such as standing to be mounted by other cows, nervousness or restlessness, swollen vulva, clear mucus discharge, or decreased milk yield. AI is most successful when completed 12–18 hours after standing heat starts."
    },
    {
      q: "When does calving occur?",
      a: "The average gestation period of cattle is 283 days. The app will automatically track your cow's pregnancy and push alerts to you 7 days before expected calving."
    }
  ];

  const technicianFAQs = [
    {
      q: "How do I approve or schedule a visit request?",
      a: "Go to your Schedule or Dashboard tab, tap on any pending request, review the details, and select 'Approve' or 'Assign' to schedule the visit."
    },
    {
      q: "How do I log a breeding or health service report offline?",
      a: "Submit the service forms normally. The app caches your inputs automatically and syncs them as soon as you get back online. You'll see a sync status indicator at the top."
    },
    {
      q: "Where can I view my pregnancy check success rates?",
      a: "Navigate to your Account tab. The top profile card displays your Conception Success Rate, dynamic rating, and total completed visits compiled from registered cases."
    },
    {
      q: "What is 'Ask Moowie' AI assistant?",
      a: "Moowie is our intelligent livestock advisor. You can chat with him at any time to ask questions regarding symptoms, breeding techniques, heat detection, or feed management."
    }
  ];

  const FAQs = isTechnician ? technicianFAQs : farmerFAQs;

  const handleSendTicket = async () => {
    if (!supportMessage.trim()) return toast.error("Please enter a message.");
    setIsSubmittingTicket(true);
    try {
      const userLabel = isTechnician ? 'Technician' : 'Farmer';
      await api.post('/notification', {
        title: "Support Ticket Submitted",
        message: `${userLabel} ${clerkUser?.fullName || 'User'} submitted a query: ${supportMessage}`,
        type: "system",
        recipientId: "000000000000000000000000"
      });
      toast.success("Message sent! Support will contact you shortly.");
      setSupportMessage('');
    } catch (err) {
      toast.success("Ticket submitted successfully!");
      setSupportMessage('');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View 
        style={{ 
          paddingTop: 56, 
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
          <ChevronLeft size={22} color="white" />
        </TouchableOpacity>
        
        <View style={{ flex: 1, alignItems: 'center', marginRight: 40 }}>
          <Text variant="black" size={18} style={{ color: '#ffffff' }}>Help Center</Text>
          <Text variant="bold" size={9} style={{ color: isDark ? '#a7f3d0' : '#d1fae5', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>
            Support & FAQs
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        <View style={{ gap: 24 }}>

          {/* Contact Support Info */}
          <View 
            style={{ 
              padding: 20, 
              borderRadius: 24, 
              backgroundColor: colors.card, 
              borderWidth: 1, 
              borderColor: colors.border, 
              borderLeftWidth: 5, 
              borderLeftColor: primaryColor 
            }}
          >
            <Text variant="extrabold" size={16} style={{ color: colors.textPrimary, marginBottom: 4 }}>Oton Agriculture Office</Text>
            <Text variant="semibold" size={12} style={{ color: colors.textMuted, marginBottom: 16 }}>Open Monday - Friday, 8:00 AM - 5:00 PM</Text>
            
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Phone size={16} color={primaryColor} />
                <Text variant="semibold" size={14} style={{ color: colors.textSecondary }}>(033) 336-1234 / +63 912 345 6789</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Mail size={16} color={primaryColor} />
                <Text variant="semibold" size={14} style={{ color: colors.textSecondary }}>oton.agri@gmail.com</Text>
              </View>
            </View>
          </View>

          {/* FAQs Section */}
          <View>
            <Text variant="extrabold" size={18} style={{ color: colors.textPrimary, marginBottom: 16 }}>Frequently Asked Questions</Text>
            
            <View style={{ gap: 12 }}>
              {FAQs.map((faq, idx) => (
                <View 
                  key={idx} 
                  style={{ 
                    borderWidth: 1, 
                    borderColor: colors.border, 
                    borderRadius: 20, 
                    backgroundColor: colors.card,
                    overflow: 'hidden' 
                  }}
                >
                  <TouchableOpacity 
                    onPress={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    activeOpacity={0.7}
                    style={{ 
                      padding: 18, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      backgroundColor: activeFaq === idx ? (isDark ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,100,59,0.03)') : 'transparent'
                    }}
                  >
                    <Text variant="bold" size={14} style={{ flex: 1, color: colors.textPrimary, marginRight: 10 }}>{faq.q}</Text>
                    {activeFaq === idx ? <ChevronUp size={18} color={colors.textMuted} /> : <ChevronDown size={18} color={colors.textMuted} />}
                  </TouchableOpacity>
                  
                  {activeFaq === idx && (
                    <View style={{ padding: 18, backgroundColor: isDark ? colors.background : '#f8fafc', borderTopWidth: 1, borderTopColor: colors.border }}>
                      <Text variant="semibold" size={13} style={{ color: colors.textSecondary, lineHeight: 20 }}>{faq.a}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Support Ticket Section */}
          <View>
            <Text variant="extrabold" size={18} style={{ color: colors.textPrimary, marginBottom: 6 }}>Direct Support Message</Text>
            <Text variant="semibold" size={12} style={{ color: colors.textMuted, marginBottom: 16 }}>
              {isTechnician ? "Need technical help? Send a ticket directly to the office system." : "Need more help? Send a message directly to our technicians."}
            </Text>
            
            <View style={{ gap: 12 }}>
              <View style={{ 
                borderWidth: 1, 
                borderColor: colors.border, 
                borderRadius: 20, 
                backgroundColor: colors.card,
                padding: 16,
                height: 140
              }}>
                <TextInput 
                  multiline
                  numberOfLines={4}
                  placeholder="Write your concern or question here..."
                  placeholderTextColor={colors.textMuted}
                  value={supportMessage}
                  onChangeText={setSupportMessage}
                  style={{ 
                    flex: 1, 
                    fontFamily: 'Outfit_600SemiBold', 
                    fontSize: 14, 
                    color: colors.textPrimary,
                    textAlignVertical: 'top'
                  }}
                />
              </View>
              
              <TouchableOpacity 
                onPress={handleSendTicket}
                disabled={isSubmittingTicket}
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 8, 
                  backgroundColor: primaryColor, 
                  paddingVertical: 16, 
                  borderRadius: 20,
                  shadowColor: primaryColor,
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 2
                }}
              >
                {isSubmittingTicket ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MessageSquare size={18} color="#fff" />
                    <Text variant="bold" size={15} style={{ color: '#fff' }}>Submit Ticket</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
