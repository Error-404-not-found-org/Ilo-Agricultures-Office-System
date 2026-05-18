import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { ChevronLeft, Send, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '@clerk/clerk-expo';

const PRIMARY = '#00643B';

export default function AskMoowie() {
  const router = useRouter();
  const { user } = useUser();
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([
    { 
      id: '1', 
      role: 'ai', 
      text: "Moo! Hello! I'm Moowie, your AI farming assistant. How can I help you with your cattle today? You can ask me about breeding, health signs, or nutrition!" 
    },
  ]);

  useEffect(() => {
    if (user?.firstName) {
      setChat([
        {
          id: '1',
          role: 'ai',
          text: `Moo! Hello ${user.firstName}! I'm Moowie, your AI farming assistant. How can I help you with your cattle today? You can ask me about breeding, health signs, or nutrition!`
        }
      ]);
    }
  }, [user]);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSend = () => {
    if (!message.trim()) return;

    const userMsg = { id: Date.now().toString(), role: 'user', text: message };
    setChat(prev => [...prev, userMsg]);
    setMessage('');

    // Simulate AI response
    setTimeout(() => {
      const aiMsg = { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        text: "I'm processing your request... (AI integration coming soon!)" 
      };
      setChat(prev => [...prev, aiMsg]);
    }, 1000);
  };

  return (
    <View className="flex-1 bg-white dark:bg-slate-950">
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
          <Text className="text-white font-outfit-bold text-[18px]">Ask Moowie</Text>
          <View className="flex-row items-center mt-0.5">
            <View className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" />
            <Text className="text-emerald-100 text-[11px] font-outfit-medium uppercase tracking-widest">Always Online</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView 
          ref={scrollViewRef}
          className="flex-1 px-6 pt-6"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {chat.map((item) => (
            <View 
              key={item.id} 
              className={`mb-6 flex-row ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {item.role === 'ai' && (
                <View className="w-8 h-8 rounded-full bg-emerald-50 items-center justify-center mr-2 mt-1 overflow-hidden">
                   <Image 
                     source={{ uri: 'https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png' }} 
                     className="w-full h-full"
                     resizeMode="contain"
                   />
                </View>
              )}
              <View 
                className={`max-w-[80%] p-4 rounded-2xl ${
                  item.role === 'user' 
                    ? 'bg-[#00643B] rounded-tr-none' 
                    : 'bg-slate-100 dark:bg-slate-800 rounded-tl-none'
                }`}
              >
                <Text 
                  className={`font-outfit-medium text-[14px] leading-5 ${
                    item.role === 'user' ? 'text-white' : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {item.text}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Input Area */}
        <View className="p-6 pb-10 border-t border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-950">
          <View className="flex-row items-center bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-2">
            <TextInput 
              placeholder="Ask me anything..."
              placeholderTextColor="#94a3b8"
              value={message}
              onChangeText={setMessage}
              multiline
              className="flex-1 font-outfit-medium text-[14px] text-slate-800 dark:text-white max-h-24 py-2"
            />
            <TouchableOpacity 
              onPress={handleSend}
              className={`w-10 h-10 rounded-full items-center justify-center ml-2 ${
                message.trim() ? 'bg-[#00643B]' : 'bg-slate-300'
              }`}
              disabled={!message.trim()}
            >
              <Send size={18} color="white" />
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center justify-center mt-4">
             <Sparkles size={12} color="#94a3b8" />
             <Text className="text-[#94a3b8] text-[10px] font-outfit-medium ml-1 uppercase tracking-widest">
               Powered by Moowie AI Engine
             </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
