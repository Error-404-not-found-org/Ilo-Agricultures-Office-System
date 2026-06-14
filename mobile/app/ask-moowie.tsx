import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ChevronLeft, Send, Sparkles, Trash2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useUser } from "@clerk/clerk-expo";
import { useApi } from "../lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PRIMARY = "#00643B";

export default function AskMoowie() {
  const router = useRouter();
  const { user } = useUser();
  const api = useApi();

  const role = user?.publicMetadata?.role || "farmer";

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [chat, setChat] = useState([
    {
      id: "1",
      role: "ai",
      text:
        role === "technician"
          ? "Hello! I'm Moowie, your AI assistant. I'm ready to help with diagnostic support, breeding data analysis, or field protocols. What's the situation today?"
          : "Moo! Hello! I'm Moowie, your AI farming assistant. How can I help you with your cattle today? You can ask me about breeding, health signs, or nutrition!",
    },
  ]);

  const scrollViewRef = useRef<ScrollView>(null);

  // Load chat history from AsyncStorage on mount / user change
  useEffect(() => {
    const loadHistory = async () => {
      if (!user) return;
      const key = `moowie_chat_history_${user.id}`;
      try {
        const saved = await AsyncStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChat(parsed);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }

      // Default welcome message if no history exists
      const name = user.firstName || "Farmer";
      setChat([
        {
          id: "1",
          role: "ai",
          text:
            role === "technician"
              ? `Hello ${name}! I'm Moowie, your AI assistant. I'm ready to help with diagnostic support, breeding data analysis, or field protocols. What's the situation today?`
              : `Moo! Hello ${name}! I'm Moowie, your AI farming assistant. How can I help you with your cattle today? You can ask me about breeding, health signs, or nutrition!`,
        },
      ]);
    };

    loadHistory();
  }, [user, role]);

  // Persist chat history to AsyncStorage whenever it changes
  useEffect(() => {
    const saveHistory = async () => {
      if (!user || chat.length === 0) return;
      const key = `moowie_chat_history_${user.id}`;
      try {
        await AsyncStorage.setItem(key, JSON.stringify(chat));
      } catch (err) {
        console.error("Failed to save chat history:", err);
      }
    };

    saveHistory();
  }, [chat, user]);

  const handleClearHistory = async () => {
    if (!user) return;
    const key = `moowie_chat_history_${user.id}`;
    try {
      await AsyncStorage.removeItem(key);
      const name = user.firstName || "Farmer";
      setChat([
        {
          id: Date.now().toString(),
          role: "ai",
          text:
            role === "technician"
              ? `Hello ${name}! I'm Moowie, your AI assistant. I'm ready to help with diagnostic support, breeding data analysis, or field protocols. What's the situation today?`
              : `Moo! Hello ${name}! I'm Moowie, your AI farming assistant. How can I help you with your cattle today? You can ask me about breeding, health signs, or nutrition!`,
        },
      ]);
    } catch (err) {
      console.error("Failed to clear chat history:", err);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: "user",
      text: message,
    };

    setChat((prev) => [...prev, userMsg]);

    const currentMsg = message;

    const history = chat
      .filter((c) => c.id !== "1")
      .map((c) => ({
        role: c.role,
        text: c.text,
      }));

    setMessage("");
    setLoading(true);

    try {
      const res = await api.post("/moowie/ask", {
        message: currentMsg,
        history,
      });

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        text: res.data.text,
      };

      setChat((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        text: "Moo... I'm having trouble connecting to the pasture. Please check your internet connection.",
      };

      setChat((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-slate-950">
      <StatusBar style="light" />

      {/* Header */}
      <View className="pt-14 pb-6 px-6 bg-[#00643B] rounded-b-[32px] flex-row items-center justify-between shadow-lg">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-white/10 rounded-full items-center justify-center border border-white/10"
        >
          <ChevronLeft size={24} color="white" />
        </TouchableOpacity>

        <View className="flex-1 items-center">
          <Text
            style={{ fontFamily: "Outfit_800ExtraBold" }}
            className="text-white text-[20px]"
          >
            Ask Moowie
          </Text>

          <View className="flex-row items-center mt-0.5">
            <View className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" />

            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-emerald-100 text-[10px] uppercase tracking-widest opacity-80"
            >
              {role === "technician"
                ? "Field Support Mode"
                : "Online Assistant"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleClearHistory}
          className="w-10 h-10 bg-white/10 rounded-full items-center justify-center border border-white/10"
        >
          <Trash2 size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Chat Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 20}
        style={{ flex: 1 }}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-6 pt-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({
              animated: true,
            })
          }
        >
          {chat.map((item) => (
            <View
              key={item.id}
              className={`mb-6 flex-row ${
                item.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {/* AI Avatar */}
              {item.role === "ai" && (
                <View className="w-10 h-10 rounded-full bg-emerald-50 items-center justify-center mr-2 mt-1 border border-emerald-100 overflow-hidden shadow-sm">
                  <Image
                    source={{
                      uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png",
                    }}
                    className="w-full h-full"
                    resizeMode="contain"
                  />
                </View>
              )}

              {/* Bubble */}
              <View
                className={`max-w-[80%] p-4 rounded-[24px] ${
                  item.role === "user"
                    ? "bg-[#00643B] rounded-tr-none shadow-md"
                    : "bg-slate-100 dark:bg-slate-800 rounded-tl-none border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
                }`}
              >
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className={`text-[14px] leading-6 ${
                    item.role === "user"
                      ? "text-white"
                      : "text-slate-800 dark:text-slate-200"
                  }`}
                >
                  {item.text}
                </Text>
              </View>
            </View>
          ))}

          {/* Typing */}
          {loading && (
            <View className="mb-6 flex-row justify-start">
              <View className="w-10 h-10 rounded-full bg-emerald-50 items-center justify-center mr-2 mt-1 border border-emerald-100 overflow-hidden shadow-sm">
                <Image
                  source={{
                    uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png",
                  }}
                  className="w-full h-full"
                  resizeMode="contain"
                />
              </View>

              <View className="bg-slate-100 dark:bg-slate-800 p-4 rounded-[24px] rounded-tl-none border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                <Text className="text-slate-400 text-[12px] italic">
                  Moowie is typing...
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View
          className="px-6 pt-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950"
          style={{
            paddingBottom: Platform.OS === "ios" ? 24 : 12,
          }}
        >
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
              disabled={!message.trim()}
              className={`w-10 h-10 rounded-full items-center justify-center ml-2 shadow-sm ${
                message.trim()
                  ? "bg-[#00643B]"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            >
              <Send size={18} color="white" />
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="flex-row items-center justify-center mt-5">
            <Sparkles size={12} color="#94a3b8" />

            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#94a3b8] text-[9px] ml-1.5 uppercase tracking-[1.5px]"
            >
              Powered by Moowie AI Engine
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
