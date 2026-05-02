import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Modal, FlatList, StatusBar, ActivityIndicator, Image, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, HeartPulse, User, MapPin,
  ChevronDown, Camera, X, Check, AlertCircle, Clock
} from 'lucide-react-native';
import React, { useState, useEffect, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { validateRequestTime } from '@/lib/utils';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Animal { _id: string; animalId: string; earTag?: string; species: string; breed: string; }
interface FarmerProfile { _id: string; name: string; phoneNumber?: string; address?: { houseNumber?: string; street: string; barangay: string; city: string; province: string; }; animals: Animal[]; }

const formatAddress = (address?: FarmerProfile['address']) => {
  if (!address) return 'No address on file';
  return [address.houseNumber, address.street, address.barangay, address.city, address.province].filter(Boolean).join(', ');
};

// ─── Config ───────────────────────────────────────────────────────────────────
const REQUEST_TYPES = [
  { value: 'disease',  label: '🦠 Disease / Infection',   },
  { value: 'medicine', label: '💊 Medicine Request',       },
  { value: 'checkup',  label: '🩺 General Checkup',        },
  { value: 'injury',   label: '🤕 Injury / Wound',         },
  { value: 'other',    label: '📋 Other',                  },
];

const URGENCY_OPTIONS = [
  { value: 'low',    label: 'Low',    desc: 'Can wait a few days',      color: '#22c55e', bg: '#f0fdf4', darkBg: '#064e3b' },
  { value: 'medium', label: 'Medium', desc: 'Needs attention soon',     color: '#f59e0b', bg: '#fffbeb', darkBg: '#78350f' },
  { value: 'high',   label: 'Urgent', desc: 'Emergency / critical now', color: '#ef4444', bg: '#fef2f2', darkBg: '#7f1d1d' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReportSickness() {
  const router   = useRouter();
  const api      = useApi();
  const insets   = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [farmer, setFarmer]           = useState<FarmerProfile | null>(null);
  const [animals, setAnimals]         = useState<Animal[]>([]);

  const [selectedAnimal, setSelectedAnimal]   = useState<Animal | null>(null);
  const [requestType, setRequestType]         = useState('disease');
  const [urgency, setUrgency]                 = useState('medium');
  const [symptoms, setSymptoms]               = useState('');
  const [imageUri, setImageUri]               = useState<string | null>(null);
  const [imageBase64, setImageBase64]         = useState<string | null>(null);
  const [preferredDate, setPreferredDate]     = useState(new Date());

  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ['system', 'config'],
    queryFn: async () => {
      const res = await api.get('/config');
      return res.data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return await api.post('/health-request', data);
    },
    onSuccess: () => {
      toast.success('Request submitted! A technician will attend to your animal.', { duration: 4000, position: 'top-center' });
      // Reset Form
      setSelectedAnimal(null);
      setSymptoms("");
      setImageUri(null);
      setImageBase64(null);

      queryClient.invalidateQueries({ queryKey: ['farmer', 'requests'] });
      router.back();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to submit. Please try again.');
    }
  });

  const submitting = mutation.isPending;

  const [animalModalVisible, setAnimalModalVisible]       = useState(false);
  const [typeModalVisible, setTypeModalVisible]           = useState(false);
  const [showDatePicker, setShowDatePicker]               = useState(false);
  const [showTimePicker, setShowTimePicker]               = useState(false);

  // ── Load profile ────────────────────────────────────────────────────────────
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const res = await api.get('/user/me');
      return res.data;
    }
  });

  useEffect(() => {
    if (profile) {
      setFarmer(profile);
    }
  }, [profile]);

  // Fetch farmer's animals for the dropdown
  const { data: animalsData, isLoading: isLoadingAnimals } = useQuery({
    queryKey: ['animals', 'my-all'],
    queryFn: async () => {
      const res = await api.get('/animals/my?limit=100');
      return res.data;
    }
  });

  useEffect(() => {
    if (animalsData?.data) {
      setAnimals(animalsData.data);
    }
  }, [animalsData]);

  // ── Image ───────────────────────────────────────────────────────────────────
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.5, base64: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setImageUri(result.assets[0].uri);
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
      toast.success('Photo attached!');
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // 1. Profile Completeness Check
    const hasPhone = farmer?.phoneNumber || profile?.phoneNumber;
    const hasAddress = farmer?.address?.barangay || profile?.address?.barangay;

    if (!hasPhone || !hasAddress) {
      Alert.alert(
        "Profile Incomplete",
        "Please provide your contact number and home address in your profile before submitting a request.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Go to Profile", onPress: () => router.push('/(farmer)/profile') }
        ]
      );
      return;
    }

    if (!selectedAnimal) return toast.error('Please select an animal.');
    if (!symptoms.trim()) return toast.error('Please describe the symptoms or condition.');

    const validation = validateRequestTime(preferredDate, !!config?.isHoliday);
    if (!validation.isValid) {
      return toast.error(validation.message || "Invalid request time.", { duration: 5000 });
    }

    mutation.mutate({
      animalId: selectedAnimal._id,
      requestType,
      symptoms: symptoms.trim(),
      urgency,
      imageUrl: imageBase64,
      preferredDate: preferredDate.toISOString(),
    });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(preferredDate);
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setPreferredDate(newDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(preferredDate);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setPreferredDate(newDate);
    }
  };

  const selectedType = REQUEST_TYPES.find(t => t.value === requestType);

  return (
    <View className="flex-1 bg-[#F9FAFB] dark:bg-slate-950">
      <StatusBar barStyle="light-content" />

      {/* Red-tinted top bar to signal health/urgency */}
      <View className="absolute top-0 left-0 right-0 h-[230px] bg-[#b91c1c]" />

      {/* Header */}
      <View style={{ paddingTop: insets.top + 16 }} className="px-6 pb-6 flex-row items-center gap-4 z-10">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/20 rounded-full items-center justify-center border border-white/20" activeOpacity={0.7}>
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>
        <View>
          <Text className="text-[20px] font-bold text-white leading-tight">Report Animal Issue</Text>
          <Text className="text-[12px] text-red-100 font-medium">Disease, Injury, or Medicine Request</Text>
        </View>
      </View>

      {/* Content card */}
      <View className="flex-1 bg-[#F9FAFB] dark:bg-slate-950 rounded-t-[32px] px-6 pt-6 mt-2" style={{ shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 15, elevation: 8 }}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 160 }}
        >
          {/* Farmer Info Card */}
          <View className="bg-white dark:bg-slate-800 rounded-3xl p-5 mb-5 border border-gray-100 dark:border-slate-700" style={{ elevation: 2 }}>
            <Text className="text-xs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-4">Your Information</Text>
            {(loadingProfile && !farmer) ? <ActivityIndicator color="#b91c1c" /> : farmer ? (
              <View className="gap-3">
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 bg-red-50 rounded-full items-center justify-center">
                    <User size={15} color="#b91c1c" />
                  </View>
                  <View>
                    <Text className="text-[11px] text-gray-400 dark:text-slate-400 font-medium">Full Name</Text>
                    <Text className="text-[14px] font-semibold text-gray-800 dark:text-white">{farmer.name}</Text>
                  </View>
                </View>
                <View className="flex-row items-start gap-3">
                  <View className="w-8 h-8 bg-red-50 rounded-full items-center justify-center mt-0.5">
                    <MapPin size={15} color="#b91c1c" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[11px] text-gray-400 dark:text-slate-400 font-medium">Address</Text>
                    <Text className="text-[14px] font-semibold text-gray-800 dark:text-slate-200 leading-tight">{formatAddress(farmer.address)}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-2"><AlertCircle size={16} color="#ef4444" /><Text className="text-red-500 text-sm">Could not load profile</Text></View>
            )}
          </View>

          {/* Animal Picker */}
          <Text className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Affected Animal *</Text>
          <TouchableOpacity
            onPress={() => setAnimalModalVisible(true)}
            className={`bg-white dark:bg-slate-800 border rounded-2xl px-4 py-4 flex-row items-center justify-between mb-4 ${selectedAnimal ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-slate-700'}`}
            style={{ elevation: 1 }}
          >
            {selectedAnimal ? (
              <View>
                <Text className="text-[15px] font-bold text-gray-800 dark:text-white">{selectedAnimal.animalId}{selectedAnimal.earTag ? ` · ${selectedAnimal.earTag}` : ''}</Text>
                <Text className="text-sm text-gray-400 dark:text-slate-400">{selectedAnimal.species} — {selectedAnimal.breed}</Text>
              </View>
            ) : (
              <Text className="text-gray-400 text-sm">Tap to choose an animal</Text>
            )}
            <ChevronDown size={20} color={selectedAnimal ? '#b91c1c' : '#9ca3af'} />
          </TouchableOpacity>

          {/* Request Type */}
          <Text className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Request Type</Text>
          <TouchableOpacity
            onPress={() => setTypeModalVisible(true)}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl px-4 py-4 flex-row items-center justify-between mb-4"
            style={{ elevation: 1 }}
          >
            <Text className="text-[15px] font-semibold text-gray-800 dark:text-white">{selectedType?.label || 'Select type'}</Text>
            <ChevronDown size={20} color="#9ca3af" />
          </TouchableOpacity>

          {/* Urgency Selector */}
          <Text className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Urgency Level</Text>
          <View className="flex-row gap-2 mb-4">
            {URGENCY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setUrgency(opt.value)}
                className="flex-1 rounded-2xl py-3 px-2 items-center border-2"
                style={{ 
                  borderColor: urgency === opt.value ? opt.color : '#e5e7eb', 
                  backgroundColor: urgency === opt.value ? opt.bg : 'white' 
                }}
              >
                <Text className="text-xs font-bold" style={{ color: urgency === opt.value ? opt.color : '#9ca3af' }}>{opt.label}</Text>
                <Text className="text-[9px] text-center mt-0.5" style={{ color: urgency === opt.value ? opt.color : '#d1d5db' }}>{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Preferred Date/Time Picker */}
          <Text className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Preferred Visit Date/Time *</Text>
          <View className="flex-row gap-3 mb-4">
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl px-4 py-4 flex-row items-center justify-between"
              style={{ elevation: 1 }}
            >
              <View>
                <Text className="text-[11px] text-gray-400 dark:text-slate-400 font-medium uppercase tracking-widest">Date</Text>
                <Text className="text-[14px] font-bold text-gray-800 dark:text-white">{preferredDate.toLocaleDateString()}</Text>
              </View>
              <Clock size={16} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl px-4 py-4 flex-row items-center justify-between"
              style={{ elevation: 1 }}
            >
              <View>
                <Text className="text-[11px] text-gray-400 dark:text-slate-400 font-medium uppercase tracking-widest">Time</Text>
                <Text className="text-[14px] font-bold text-gray-800 dark:text-white">
                  {preferredDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Clock size={16} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={preferredDate}
              mode="date"
              display="default"
              onChange={onDateChange}
              minimumDate={new Date()}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={preferredDate}
              mode="time"
              display="default"
              onChange={onTimeChange}
            />
          )}

          {/* Photo */}
          <Text className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Attach Photo (Optional)</Text>
          {imageUri ? (
            <View className="mb-4 relative">
              <Image source={{ uri: imageUri }} className="w-full h-44 rounded-2xl" resizeMode="cover" />
              <TouchableOpacity onPress={() => { setImageUri(null); setImageBase64(null); }} className="absolute top-2 right-2 bg-black/50 rounded-full w-8 h-8 items-center justify-center">
                <X size={16} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={pickImage} className="w-full h-32 bg-white dark:bg-slate-800 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl items-center justify-center mb-4 gap-2">
              <Camera size={26} color="#9ca3af" />
              <Text className="text-sm text-gray-400 dark:text-slate-400 font-medium">Tap to attach a photo</Text>
              <Text className="text-xs text-gray-300 dark:text-slate-500">of the wound, swelling, or symptom</Text>
            </TouchableOpacity>
          )}

          {/* Symptoms / Description */}
          <Text className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Symptoms / Description *</Text>
          <TextInput
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl px-4 py-4 text-gray-800 dark:text-white text-sm mb-6"
            style={{ minHeight: 120, textAlignVertical: 'top', elevation: 1 }}
            value={symptoms}
            onChangeText={setSymptoms}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 350)}
            placeholder="Describe what you observed — e.g. the animal is not eating, has a swollen leg, running a fever, or requires a specific medicine..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={5}
            blurOnSubmit={false}
          />

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
            className={`rounded-full py-4 items-center flex-row justify-center gap-2 shadow-lg ${submitting ? 'bg-red-400' : 'bg-[#b91c1c] shadow-red-200'}`}
          >
            {submitting ? <ActivityIndicator color="white" size="small" /> : (
              <>
                <HeartPulse size={20} color="white" />
                <Text className="text-white font-bold text-lg">Submit Health Request</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Animal Modal */}
      <Modal animationType="slide" transparent visible={animalModalVisible} onRequestClose={() => setAnimalModalVisible(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-12 max-h-[75%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-gray-800 dark:text-white">Select Animal</Text>
              <TouchableOpacity onPress={() => setAnimalModalVisible(false)} className="p-1 bg-gray-100 dark:bg-slate-800 rounded-full"><X size={20} color="gray" /></TouchableOpacity>
            </View>
            
            {isLoadingAnimals ? (
              <View className="items-center py-20">
                <ActivityIndicator color="#b91c1c" size="large" />
                <Text className="text-gray-400 mt-4 font-medium">Loading your animals...</Text>
              </View>
            ) : animals.length === 0 ? (
              <View className="items-center py-10 gap-3">
                <AlertCircle size={36} color="#9ca3af" />
                <Text className="text-gray-400 text-center font-medium">No registered animals found.</Text>
              </View>
            ) : (
              <FlatList
                data={animals}
                keyExtractor={item => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => { setSelectedAnimal(item); setAnimalModalVisible(false); }}
                    className={`py-4 px-3 border-b border-gray-50 dark:border-slate-800 flex-row items-center justify-between ${selectedAnimal?._id === item._id ? 'bg-red-50 dark:bg-red-900/30 rounded-xl' : ''}`}>
                    <View>
                      <Text className="text-[15px] font-bold text-gray-800 dark:text-white">{item.animalId}{item.earTag ? ` · ${item.earTag}` : ''}</Text>
                      <Text className="text-sm text-gray-400 dark:text-slate-400">{item.species} — {item.breed}</Text>
                    </View>
                    {selectedAnimal?._id === item._id && <Check size={18} color="#b91c1c" />}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Request Type Modal */}
      <Modal animationType="slide" transparent visible={typeModalVisible} onRequestClose={() => setTypeModalVisible(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-12">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-gray-800 dark:text-white">Request Type</Text>
              <TouchableOpacity onPress={() => setTypeModalVisible(false)} className="p-1 bg-gray-100 dark:bg-slate-800 rounded-full"><X size={20} color="gray" /></TouchableOpacity>
            </View>
            {REQUEST_TYPES.map(type => (
              <TouchableOpacity
                key={type.value}
                onPress={() => { setRequestType(type.value); setTypeModalVisible(false); }}
                className={`py-4 px-3 border-b border-gray-50 dark:border-slate-800 flex-row items-center justify-between ${requestType === type.value ? 'bg-red-50 dark:bg-red-900/30 rounded-xl' : ''}`}
              >
                <Text className="text-base text-gray-800 dark:text-white font-medium">{type.label}</Text>
                {requestType === type.value && <Check size={18} color="#b91c1c" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}
