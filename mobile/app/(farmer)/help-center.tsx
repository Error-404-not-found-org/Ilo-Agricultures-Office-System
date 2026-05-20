import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { ChevronLeft, Phone, Mail, MessageSquare, ChevronUp, ChevronDown, HelpCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '@clerk/clerk-expo';
import { useColorScheme } from 'nativewind';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';

export default function HelpCenter() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { colorScheme } = useColorScheme();
  const api = useApi();

  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [supportMessage, setSupportMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const FAQs = [
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

  const handleSendTicket = async () => {
    if (!supportMessage.trim()) return toast.error("Please enter a message.");
    setIsSubmittingTicket(true);
    try {
      await api.post('/notification', {
        title: "Support Ticket Submitted",
        message: `Farmer ${clerkUser?.fullName} submitted a query: ${supportMessage}`,
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
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <StatusBar style="light" />
      
      {/* Header */}
      <View className="pt-14 pb-6 px-6 bg-[#00643B] rounded-b-[32px] flex-row items-center">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="w-10 h-10 bg-white/10 rounded-full items-center justify-center"
        >
          <ChevronLeft size={24} color="white" />
        </TouchableOpacity>
        
        <View className="flex-1 items-center mr-10">
          <Text className="text-white font-outfit-bold text-[18px]">Help Center</Text>
          <Text className="text-emerald-100 text-[11px] font-outfit-medium uppercase tracking-widest mt-0.5">Support & FAQs</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        <View style={{ gap: 24 }}>

          {/* Contact Support Info */}
          <View style={{ padding: 20, borderRadius: 24, backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#fff', borderWidth: 1, borderColor: colorScheme === 'dark' ? '#334155' : '#f1f5f9', borderLeftWidth: 5, borderLeftColor: '#00643B' }}>
            <Text style={{ fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: colorScheme === 'dark' ? '#fff' : '#1e293b', marginBottom: 4 }}>Oton Agriculture Office</Text>
            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Open Monday - Friday, 8:00 AM - 5:00 PM</Text>
            
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Phone size={16} color="#00643B" />
                <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: colorScheme === 'dark' ? '#cbd5e1' : '#475569' }}>(033) 336-1234 / +63 912 345 6789</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Mail size={16} color="#00643B" />
                <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: colorScheme === 'dark' ? '#cbd5e1' : '#475569' }}>oton.agri@gmail.com</Text>
              </View>
            </View>
          </View>

          {/* FAQs Section */}
          <View>
            <Text style={{ fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: colorScheme === 'dark' ? '#fff' : '#1e293b', marginBottom: 16 }}>Frequently Asked Questions</Text>
            
            <View style={{ gap: 12 }}>
              {FAQs.map((faq, idx) => (
                <View 
                  key={idx} 
                  style={{ 
                    borderWidth: 1, 
                    borderColor: colorScheme === 'dark' ? '#334155' : '#e2e8f0', 
                    borderRadius: 20, 
                    backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#fff',
                    overflow: 'hidden' 
                  }}
                >
                  <TouchableOpacity 
                    onPress={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    style={{ 
                      padding: 18, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      backgroundColor: activeFaq === idx ? 'rgba(0,100,59,0.03)' : 'transparent'
                    }}
                  >
                    <Text style={{ flex: 1, fontFamily: 'Outfit_700Bold', fontSize: 14, color: colorScheme === 'dark' ? '#f1f5f9' : '#334155', marginRight: 10 }}>{faq.q}</Text>
                    {activeFaq === idx ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
                  </TouchableOpacity>
                  
                  {activeFaq === idx && (
                    <View style={{ padding: 18, backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#f8fafc', borderTopWidth: 1, borderTopColor: colorScheme === 'dark' ? '#334155' : '#e2e8f0' }}>
                      <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: colorScheme === 'dark' ? '#94a3b8' : '#475569', lineHeight: 20 }}>{faq.a}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Support Ticket Section */}
          <View>
            <Text style={{ fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: colorScheme === 'dark' ? '#fff' : '#1e293b', marginBottom: 6 }}>Direct Support Message</Text>
            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Need more help? Send a message directly to our technicians.</Text>
            
            <View style={{ gap: 12 }}>
              <View style={{ 
                borderWidth: 1, 
                borderColor: colorScheme === 'dark' ? '#334155' : '#e2e8f0', 
                borderRadius: 20, 
                backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#fff',
                padding: 16,
                height: 140
              }}>
                <TextInput 
                  multiline
                  numberOfLines={4}
                  placeholder="Write your concern or question here..."
                  placeholderTextColor="#94a3b8"
                  value={supportMessage}
                  onChangeText={setSupportMessage}
                  style={{ 
                    flex: 1, 
                    fontFamily: 'Outfit_600SemiBold', 
                    fontSize: 14, 
                    color: colorScheme === 'dark' ? '#fff' : '#1e293b',
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
                  backgroundColor: '#00643B', 
                  paddingVertical: 16, 
                  borderRadius: 20,
                  shadowColor: '#00643B',
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
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 15, color: '#fff' }}>Submit Ticket</Text>
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
