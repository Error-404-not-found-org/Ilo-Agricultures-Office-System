import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { ChevronLeft, Send, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '@clerk/clerk-expo';
import { api } from '../lib/api';

const PRIMARY = '#00643B';

export default function AskMoowie() {
  const router = useRouter();
  const { user } = useUser();
  const role = user?.publicMetadata?.role || 'farmer';
  
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [chat, setChat] = useState([
    { 
      id: '1', 
      role: 'ai', 
      text: role === 'technician' 
        ? "Hello Tech! I'm Moowie, your AI assistant. I'm ready to help with diagnostic support, breeding data analysis, or field protocols. What's the situation today?"
        : "Hi! I'm Moowie, your AI farming assistant. How can I help you with your cattle today? You can ask me about breeding, health signs, or nutrition!" 
    },
  ]);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', text: message };
    setChat(prev => [...prev, userMsg]);
    const currentMsg = message;
    setMessage('');
    setLoading(true);

    try {
      const res = await api.post('/moowie/ask', { message: currentMsg });
      const aiMsg = { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        text: res.data.text 
      };
      setChat(prev => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg = { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        text: "Moo... I'm having trouble connecting to the pasture. Please check your internet connection." 
      };
      setChat(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-slate-950">
      <StatusBar style="light" />
      
      {/* Header */}
      <View className="pt-14 pb-6 px-6 bg-[#00643B] rounded-b-[32px] flex-row items-center shadow-lg">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="w-10 h-10 bg-white/10 rounded-full items-center justify-center border border-white/10"
        >
          <ChevronLeft size={24} color="white" />
        </TouchableOpacity>
        
        <View className="flex-1 items-center mr-10">
          <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-white text-[20px]">Ask Moowie</Text>
          <View className="flex-row items-center mt-0.5">
            <View className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-emerald-100 text-[10px] uppercase tracking-widest opacity-80">
              {role === 'technician' ? 'Field Support Mode' : 'Online Assistant'}
            </Text>
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
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {chat.map((item) => (
            <View 
              key={item.id} 
              className={`mb-6 flex-row ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {item.role === 'ai' && (
                <View className="w-10 h-10 rounded-full bg-emerald-50 items-center justify-center mr-2 mt-1 border border-emerald-100 overflow-hidden shadow-sm">
                   <Image 
                     source={{ uri: 'https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png' }} 
                     className="w-full h-full"
                     resizeMode="contain"
                   />
                </View>
              )}
              <View 
                className={`max-w-[80%] p-4 rounded-[24px] ${
                  item.role === 'user' 
                    ? 'bg-[#00643B] rounded-tr-none shadow-md' 
                    : 'bg-slate-100 dark:bg-slate-800 rounded-tl-none border border-slate-200/50 dark:border-slate-700/50 shadow-sm'
                }`}
              >
                <Text 
                  style={{ fontFamily: 'Outfit_500Medium' }}
                  className={`text-[14px] leading-6 ${
                    item.role === 'user' ? 'text-white' : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {item.text}
                </Text>
              </View>
            </View>
          ))}
          {loading && (
            <View className="mb-6 flex-row justify-start">
               <View className="w-10 h-10 rounded-full bg-emerald-50 items-center justify-center mr-2 mt-1 border border-emerald-100 overflow-hidden shadow-sm">
                   <Image 
                     source={{ uri: 'https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png' }} 
                     className="w-full h-full"
                     resizeMode="contain"
                   />
                </View>
                <View className="bg-slate-100 dark:bg-slate-800 p-4 rounded-[24px] rounded-tl-none border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                   <Text className="text-slate-400 font-outfit-medium text-[12px] italic">Moowie is typing...</Text>
                </View>
            </View>
          )}
        </ScrollView>

        {/* Input Area */}
        <View className="p-6 pb-12 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
          <View className="flex-row items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] px-4 py-2">
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
              className={`w-10 h-10 rounded-full items-center justify-center ml-2 shadow-sm ${
                message.trim() ? 'bg-[#00643B]' : 'bg-slate-200 dark:bg-slate-700'
              }`}
              disabled={!message.trim()}
            >
              <Send size={18} color="white" />
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center justify-center mt-5">
             <Sparkles size={12} color="#94a3b8" />
             <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#94a3b8] text-[9px] ml-1.5 uppercase tracking-[1.5px]">
               Powered by Moowie AI Engine
             </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
