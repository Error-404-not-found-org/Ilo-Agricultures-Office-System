import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Modal, FlatList, StatusBar, ActivityIndicator, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, HeartPulse, User, MapPin,
  ChevronDown, Camera, X, Check, AlertCircle, AlertTriangle, Pill
} from 'lucide-react-native';
import React, { useState, useEffect, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Animal { _id: string; animalId: string; earTag?: string; species: string; breed: string; }
interface FarmerProfile { _id: string; name: string; address?: { houseNumber?: string; street: string; barangay: string; city: string; province: string; }; animals: Animal[]; }

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
  { value: 'low',    label: 'Low',    desc: 'Can wait a few days',      color: '#22c55e', bg: '#f0fdf4' },
  { value: 'medium', label: 'Medium', desc: 'Needs attention soon',     color: '#f59e0b', bg: '#fffbeb' },
  { value: 'high',   label: 'Urgent', desc: 'Emergency / critical now', color: '#ef4444', bg: '#fef2f2' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReportSickness() {
  const router   = useRouter();
  const api      = useApi();
  const insets   = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [farmer, setFarmer]           = useState<FarmerProfile | null>(null);
  const [animals, setAnimals]         = useState<Animal[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [selectedAnimal, setSelectedAnimal]   = useState<Animal | null>(null);
  const [requestType, setRequestType]         = useState('disease');
  const [urgency, setUrgency]                 = useState('medium');
  const [symptoms, setSymptoms]               = useState('');
  const [imageUri, setImageUri]               = useState<string | null>(null);
  const [imageBase64, setImageBase64]         = useState<string | null>(null);
  const [submitting, setSubmitting]           = useState(false);

  const [animalModalVisible, setAnimalModalVisible]       = useState(false);
  const [typeModalVisible, setTypeModalVisible]           = useState(false);

  // ── Load profile ────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/user/me')
      .then(res => { setFarmer(res.data); setAnimals(res.data.animals || []); })
      .catch((err: any) => toast.error(err.response?.data?.message || 'Could not load your profile.'))
      .finally(() => setLoadingProfile(false));
  }, []);

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
    if (!selectedAnimal) return toast.error('Please select an animal.');
    if (!symptoms.trim()) return toast.error('Please describe the symptoms or condition.');

    try {
      setSubmitting(true);
      await api.post('/health-request', {
        animalId: selectedAnimal._id,
        requestType,
        symptoms: symptoms.trim(),
        urgency,
        imageUrl: imageBase64,
      });
      toast.success('Request submitted! A technician will attend to your animal.', { duration: 4000, position: 'top-center' });
      router.back();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = REQUEST_TYPES.find(t => t.value === requestType);
  const selectedUrgency = URGENCY_OPTIONS.find(u => u.value === urgency)!;

  return (
    <View className="flex-1 bg-[#F9FAFB]">
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
      <View className="flex-1 bg-[#F9FAFB] rounded-t-[32px] px-6 pt-6 mt-2" style={{ shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 15, elevation: 8 }}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 160 }}
        >
          {/* Farmer Info Card */}
          <View className="bg-white rounded-3xl p-5 mb-5 border border-gray-100" style={{ elevation: 2 }}>
            <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Your Information</Text>
            {loadingProfile ? <ActivityIndicator color="#b91c1c" /> : farmer ? (
              <View className="gap-3">
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 bg-red-50 rounded-full items-center justify-center">
                    <User size={15} color="#b91c1c" />
                  </View>
                  <View>
                    <Text className="text-[11px] text-gray-400 font-medium">Full Name</Text>
                    <Text className="text-[14px] font-semibold text-gray-800">{farmer.name}</Text>
                  </View>
                </View>
                <View className="flex-row items-start gap-3">
                  <View className="w-8 h-8 bg-red-50 rounded-full items-center justify-center mt-0.5">
                    <MapPin size={15} color="#b91c1c" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[11px] text-gray-400 font-medium">Address</Text>
                    <Text className="text-[14px] font-semibold text-gray-800 leading-tight">{formatAddress(farmer.address)}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-2"><AlertCircle size={16} color="#ef4444" /><Text className="text-red-500 text-sm">Could not load profile</Text></View>
            )}
          </View>

          {/* Animal Picker */}
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Affected Animal *</Text>
          <TouchableOpacity
            onPress={() => setAnimalModalVisible(true)}
            className={`bg-white border rounded-2xl px-4 py-4 flex-row items-center justify-between mb-4 ${selectedAnimal ? 'border-red-400' : 'border-gray-200'}`}
            style={{ elevation: 1 }}
          >
            {selectedAnimal ? (
              <View>
                <Text className="text-[15px] font-bold text-gray-800">{selectedAnimal.animalId}{selectedAnimal.earTag ? ` · ${selectedAnimal.earTag}` : ''}</Text>
                <Text className="text-sm text-gray-400">{selectedAnimal.species} — {selectedAnimal.breed}</Text>
              </View>
            ) : (
              <Text className="text-gray-400 text-sm">Tap to choose an animal</Text>
            )}
            <ChevronDown size={20} color={selectedAnimal ? '#b91c1c' : '#9ca3af'} />
          </TouchableOpacity>

          {/* Request Type */}
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Request Type</Text>
          <TouchableOpacity
            onPress={() => setTypeModalVisible(true)}
            className="bg-white border border-gray-200 rounded-2xl px-4 py-4 flex-row items-center justify-between mb-4"
            style={{ elevation: 1 }}
          >
            <Text className="text-[15px] font-semibold text-gray-800">{selectedType?.label || 'Select type'}</Text>
            <ChevronDown size={20} color="#9ca3af" />
          </TouchableOpacity>

          {/* Urgency Selector */}
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Urgency Level</Text>
          <View className="flex-row gap-2 mb-4">
            {URGENCY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setUrgency(opt.value)}
                className="flex-1 rounded-2xl py-3 px-2 items-center border-2"
                style={{ borderColor: urgency === opt.value ? opt.color : '#e5e7eb', backgroundColor: urgency === opt.value ? opt.bg : 'white' }}
              >
                <Text className="text-xs font-bold" style={{ color: urgency === opt.value ? opt.color : '#9ca3af' }}>{opt.label}</Text>
                <Text className="text-[9px] text-center mt-0.5" style={{ color: urgency === opt.value ? opt.color : '#d1d5db' }}>{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Photo */}
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Attach Photo (Optional)</Text>
          {imageUri ? (
            <View className="mb-4 relative">
              <Image source={{ uri: imageUri }} className="w-full h-44 rounded-2xl" resizeMode="cover" />
              <TouchableOpacity onPress={() => { setImageUri(null); setImageBase64(null); }} className="absolute top-2 right-2 bg-black/50 rounded-full w-8 h-8 items-center justify-center">
                <X size={16} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={pickImage} className="w-full h-32 bg-white border-2 border-dashed border-gray-200 rounded-2xl items-center justify-center mb-4 gap-2">
              <Camera size={26} color="#9ca3af" />
              <Text className="text-sm text-gray-400 font-medium">Tap to attach a photo</Text>
              <Text className="text-xs text-gray-300">of the wound, swelling, or symptom</Text>
            </TouchableOpacity>
          )}

          {/* Symptoms / Description */}
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Symptoms / Description *</Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-2xl px-4 py-4 text-gray-800 text-sm mb-6"
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
          <View className="bg-white rounded-t-[32px] p-6 pb-12 max-h-[65%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-gray-800">Select Animal</Text>
              <TouchableOpacity onPress={() => setAnimalModalVisible(false)} className="p-1 bg-gray-100 rounded-full"><X size={20} color="#374151" /></TouchableOpacity>
            </View>
            {animals.length === 0 ? (
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
                    className={`py-4 px-3 border-b border-gray-50 flex-row items-center justify-between ${selectedAnimal?._id === item._id ? 'bg-red-50 rounded-xl' : ''}`}>
                    <View>
                      <Text className="text-[15px] font-bold text-gray-800">{item.animalId}{item.earTag ? ` · ${item.earTag}` : ''}</Text>
                      <Text className="text-sm text-gray-400">{item.species} — {item.breed}</Text>
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
          <View className="bg-white rounded-t-[32px] p-6 pb-12">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-gray-800">Request Type</Text>
              <TouchableOpacity onPress={() => setTypeModalVisible(false)} className="p-1 bg-gray-100 rounded-full"><X size={20} color="#374151" /></TouchableOpacity>
            </View>
            {REQUEST_TYPES.map(type => (
              <TouchableOpacity
                key={type.value}
                onPress={() => { setRequestType(type.value); setTypeModalVisible(false); }}
                className={`py-4 px-3 border-b border-gray-50 flex-row items-center justify-between ${requestType === type.value ? 'bg-red-50 rounded-xl' : ''}`}
              >
                <Text className="text-base text-gray-800 font-medium">{type.label}</Text>
                {requestType === type.value && <Check size={18} color="#b91c1c" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}
