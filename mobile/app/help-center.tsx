import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Phone, Mail, MessageSquare, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useUser } from '@clerk/clerk-expo';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui/Text';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppPageHeader } from '@/components/AppPageHeader';

type SupportTicket = {
  _id: string;
  message: string;
  status: 'pending' | 'in-progress' | 'resolved';
  createdAt: string;
  updatedAt: string;
};

export default function HelpCenter() {
  const { user: clerkUser } = useUser();
  const api = useApi();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();

  const role = clerkUser?.publicMetadata?.role || 'farmer';
  const isTechnician = role === 'technician';

  const primaryColor = isDark ? colors.primary : '#00643B';

  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [supportMessage, setSupportMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const { data: myTickets = [], isLoading: isLoadingTickets } = useQuery<SupportTicket[]>({
    queryKey: ['support-tickets', 'mine'],
    queryFn: async () => {
      const response = await api.get('/support-tickets/mine');
      return Array.isArray(response.data?.data) ? response.data.data : [];
    },
  });

  const farmerFAQs = [
    {
      q: "How do I request Artificial Insemination (AI)?",
      a: "Go to your Home tab, tap 'AI Service Request', fill in the animal's details (Ear Tag, breed), select your preferred schedule, and submit. A technician will receive a notification to claim or schedule the visit."
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
      await api.post('/support-tickets', {
        message: supportMessage,
      });
      toast.success("Message sent! Support will contact you shortly.");
      setSupportMessage('');
      queryClient.invalidateQueries({ queryKey: ['support-tickets', 'mine'] });
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || "Failed to submit ticket.";
      toast.error(errMsg);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppPageHeader title="Help Center" subtitle="Support, common questions, and your submitted tickets" />

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

          <View style={{ marginTop: 28 }}>
            <Text variant="extrabold" size={18} style={{ color: colors.textPrimary, marginBottom: 6 }}>
              My Support Tickets
            </Text>
            <Text variant="semibold" size={12} style={{ color: colors.textMuted, marginBottom: 14 }}>
              Track whether your messages are pending, being handled, or resolved.
            </Text>

            {isLoadingTickets ? (
              <ActivityIndicator color={primaryColor} style={{ marginVertical: 20 }} />
            ) : myTickets.length === 0 ? (
              <View style={{ padding: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
                <Text variant="semibold" size={13} style={{ color: colors.textMuted }}>
                  You have not submitted any support tickets yet.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {myTickets.map((ticket) => {
                  const statusColor = ticket.status === 'resolved'
                    ? '#15803d'
                    : ticket.status === 'in-progress'
                      ? '#b45309'
                      : '#475569';
                  return (
                    <View
                      key={ticket._id}
                      style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <Text variant="bold" size={13} style={{ flex: 1, color: colors.textPrimary, lineHeight: 19 }}>
                          {ticket.message}
                        </Text>
                        <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: `${statusColor}18` }}>
                          <Text variant="bold" size={10} style={{ color: statusColor, textTransform: 'capitalize' }}>
                            {ticket.status.replace('-', ' ')}
                          </Text>
                        </View>
                      </View>
                      <Text variant="semibold" size={10} style={{ color: colors.textMuted, marginTop: 10 }}>
                        Sent {new Date(ticket.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
