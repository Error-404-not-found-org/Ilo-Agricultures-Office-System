import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Modal, FlatList, StatusBar, ActivityIndicator, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Syringe, User, MapPin,
  ChevronDown, Camera, X, Check, AlertCircle
} from 'lucide-react-native';
import React, { useState, useEffect, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Animal { _id: string; animalId: string; earTag?: string; species: string; breed: string; }
interface FarmerProfile {
  _id: string; name: string; imageUrl?: string;
  address?: { houseNumber?: string; street: string; barangay: string; city: string; province: string; };
  animals: Animal[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatAddress = (address?: FarmerProfile['address']) => {
  if (!address) return 'No address on file';
  const parts = [address.houseNumber, address.street, address.barangay, address.city, address.province].filter(Boolean);
  return parts.join(', ');
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function RequestAI() {
  const router    = useRouter();
  const api        = useApi();
  const insets     = useSafeAreaInsets();
  const scrollRef  = useRef<ScrollView>(null);

  // Data states
  const [farmer, setFarmer]       = useState<FarmerProfile | null>(null);
  const [animals, setAnimals]     = useState<Animal[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Form states
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [comment, setComment]               = useState('');
  const [imageUri, setImageUri]             = useState<string | null>(null);
  const [imageBase64, setImageBase64]       = useState<string | null>(null);
  const [submitting, setSubmitting]         = useState(false);

  // UI states
  const [animalModalVisible, setAnimalModalVisible] = useState(false);

  // ── Load farmer profile + animals on mount ──────────────────────────────────
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await api.get('/user/me');
        setFarmer(res.data);
        setAnimals(res.data.animals || []);
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Could not load your profile.');
      } finally {
        setLoadingProfile(false);
      }
    };
    loadProfile();
  }, []);

  // ── Image Picker ────────────────────────────────────────────────────────────
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setImageUri(result.assets[0].uri);
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
      toast.success('Photo attached!');
    }
  };

  const removeImage = () => { setImageUri(null); setImageBase64(null); };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedAnimal) return toast.error('Please select an animal for this request.');
    if (!comment.trim()) return toast.error('Please describe your request in the comment box.');

    try {
      setSubmitting(true);
      await api.post('/ai-request', {
        animalId: selectedAnimal._id,
        imageUrl: imageBase64,
        comment: comment.trim(),
      });
      toast.success('AI request submitted! A technician will contact you soon.', { duration: 4000, position: 'top-center' });
      router.back();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <StatusBar barStyle="light-content" />
      {/* Green top bar */}
      <View className="absolute top-0 left-0 right-0 h-[230px] bg-[#00643B]" />

      {/* Header */}
      <View style={{ paddingTop: insets.top + 16 }} className="px-6 pb-6 flex-row items-center gap-4 z-10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-white/20 rounded-full items-center justify-center border border-white/20"
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>
        <View>
          <Text className="text-[20px] font-bold text-white leading-tight">Request AI Service</Text>
          <Text className="text-[12px] text-emerald-100 font-medium">Artificial Insemination Request</Text>
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

            {/* ── Farmer Info Card ─────────────────────────────────────────── */}
            <View className="bg-white rounded-3xl p-5 mb-5 border border-gray-100" style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 }}>
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Your Information</Text>

              {loadingProfile ? (
                <ActivityIndicator color="#00643B" />
              ) : farmer ? (
                <View className="gap-3">
                  {/* Name */}
                  <View className="flex-row items-center gap-3">
                    <View className="w-8 h-8 bg-emerald-50 rounded-full items-center justify-center">
                      <User size={15} color="#00643B" />
                    </View>
                    <View>
                      <Text className="text-[11px] text-gray-400 font-medium">Full Name</Text>
                      <Text className="text-[14px] font-semibold text-gray-800">{farmer.name}</Text>
                    </View>
                  </View>

                  {/* Address */}
                  <View className="flex-row items-start gap-3">
                    <View className="w-8 h-8 bg-emerald-50 rounded-full items-center justify-center mt-0.5">
                      <MapPin size={15} color="#00643B" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[11px] text-gray-400 font-medium">Address</Text>
                      <Text className="text-[14px] font-semibold text-gray-800 leading-tight">{formatAddress(farmer.address)}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View className="flex-row items-center gap-2">
                  <AlertCircle size={16} color="#ef4444" />
                  <Text className="text-red-500 text-sm">Could not load profile</Text>
                </View>
              )}
            </View>

            {/* ── Animal Picker ─────────────────────────────────────────────── */}
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Select Animal *</Text>
            <TouchableOpacity
              onPress={() => setAnimalModalVisible(true)}
              className={`bg-white border rounded-2xl px-4 py-4 flex-row items-center justify-between mb-5 ${selectedAnimal ? 'border-emerald-400' : 'border-gray-200'}`}
              style={{ elevation: 1 }}
            >
              {selectedAnimal ? (
                <View>
                  <Text className="text-[15px] font-bold text-gray-800">
                    {selectedAnimal.animalId}
                    {selectedAnimal.earTag ? ` · ${selectedAnimal.earTag}` : ''}
                  </Text>
                  <Text className="text-sm text-gray-400">{selectedAnimal.species} — {selectedAnimal.breed}</Text>
                </View>
              ) : (
                <Text className="text-gray-400 text-sm">Tap to choose an animal</Text>
              )}
              <ChevronDown size={20} color={selectedAnimal ? '#00643B' : '#9ca3af'} />
            </TouchableOpacity>

            {/* ── Photo Attachment ─────────────────────────────────────────── */}
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Attach Photo (Optional)</Text>
            {imageUri ? (
              <View className="mb-5 relative">
                <Image
                  source={{ uri: imageUri }}
                  className="w-full h-48 rounded-2xl"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={removeImage}
                  className="absolute top-2 right-2 bg-black/50 rounded-full w-8 h-8 items-center justify-center"
                >
                  <X size={16} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={pickImage}
                className="w-full h-36 bg-white border-2 border-dashed border-gray-200 rounded-2xl items-center justify-center mb-5 gap-2"
              >
                <Camera size={28} color="#9ca3af" />
                <Text className="text-sm text-gray-400 font-medium">Tap to attach a photo</Text>
                <Text className="text-xs text-gray-300">of the animal in heat</Text>
              </TouchableOpacity>
            )}

            {/* ── Comment Box ──────────────────────────────────────────────── */}
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Comment / Notes *</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-2xl px-4 py-4 text-gray-800 text-sm mb-6"
              style={{ minHeight: 120, textAlignVertical: 'top', elevation: 1 }}
              value={comment}
              onChangeText={setComment}
              onFocus={() => {
                // Give the keyboard time to appear, then scroll down so the comment box is visible
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 350);
              }}
              placeholder="Describe the animal's condition, heat signs, or any other relevant details for the technician..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={5}
              blurOnSubmit={false}
            />

            {/* ── Submit Button ─────────────────────────────────────────────── */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
              className={`rounded-full py-4 items-center flex-row justify-center gap-2 shadow-lg ${submitting ? 'bg-emerald-400' : 'bg-[#00643B] shadow-green-200'}`}
            >
              {submitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Syringe size={20} color="white" />
                  <Text className="text-white font-bold text-lg">Submit AI Request</Text>
                </>
              )}
            </TouchableOpacity>

          </ScrollView>
      </View>

      {/* ── Animal Selection Modal ──────────────────────────────────────────── */}
      <Modal animationType="slide" transparent visible={animalModalVisible} onRequestClose={() => setAnimalModalVisible(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[32px] p-6 pb-12 max-h-[65%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-gray-800">Select Animal</Text>
              <TouchableOpacity onPress={() => setAnimalModalVisible(false)} className="p-1 bg-gray-100 rounded-full">
                <X size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            {animals.length === 0 ? (
              <View className="items-center py-10 gap-3">
                <AlertCircle size={36} color="#9ca3af" />
                <Text className="text-gray-400 text-center font-medium">You have no registered animals yet.</Text>
                <Text className="text-gray-300 text-xs text-center">Please register an animal first before requesting AI.</Text>
              </View>
            ) : (
              <FlatList
                data={animals}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => { setSelectedAnimal(item); setAnimalModalVisible(false); }}
                    className={`py-4 px-3 border-b border-gray-50 flex-row items-center justify-between ${selectedAnimal?._id === item._id ? 'bg-emerald-50 rounded-xl' : ''}`}
                  >
                    <View>
                      <Text className="text-[15px] font-bold text-gray-800">
                        {item.animalId}{item.earTag ? ` · ${item.earTag}` : ''}
                      </Text>
                      <Text className="text-sm text-gray-400">{item.species} — {item.breed}</Text>
                    </View>
                    {selectedAnimal?._id === item._id && <Check size={18} color="#00643B" />}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
