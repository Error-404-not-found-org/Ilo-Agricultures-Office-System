import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Baby,
  Calendar,
  Plus,
  Trash2,
  ClipboardCheck,
  Palette,
  Hash,
  Info,
  Camera,
  Image as ImageIcon,
  X,
} from "lucide-react-native";
import React, { useState, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTheme } from "@/lib/theme";

interface CalfEntry {
  sex: "M" | "F";
  earTag: string;
  color: string;
  imageUri?: string;
  imageBase64?: string;
}

export default function RecordCalving() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();

  const primaryColor = isDark ? colors.primary : '#00643B';

  const pregnancyId = params.pregnancyId as string;
  const animalId = params.animalId as string;
  const earTag = params.earTag as string;

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [calvingEase, setCalvingEase] = useState("Normal");
  const [technicianNote, setTechnicianNote] = useState("");
  const [calves, setCalves] = useState<CalfEntry[]>([
    { sex: "F", earTag: "", color: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addCalf = () => {
    if (calves.length >= 5) {
      return toast.error("Maximum 5 calves per event");
    }
    setCalves([...calves, { sex: "F", earTag: "", color: "" }]);
  };

  const removeCalf = (index: number) => {
    if (calves.length === 1) return;
    const newCalves = [...calves];
    newCalves.splice(index, 1);
    setCalves(newCalves);
  };

  const updateCalf = (index: number, field: keyof CalfEntry, value: string) => {
    const newCalves = [...calves];
    newCalves[index][field] = value as any;
    setCalves(newCalves);
  };

  const pickCalfImage = async (index: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const newCalves = [...calves];
      newCalves[index].imageUri = result.assets[0].uri;
      newCalves[index].imageBase64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setCalves(newCalves);
      toast.success(`Photo attached to Calf #${index + 1}`);
    }
  };

  const takeCalfPhoto = async (index: number) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      toast.error("Permission to access camera was denied");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const newCalves = [...calves];
      newCalves[index].imageUri = result.assets[0].uri;
      newCalves[index].imageBase64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setCalves(newCalves);
      toast.success(`Photo attached to Calf #${index + 1}`);
    }
  };

  const removeCalfImage = (index: number) => {
    const newCalves = [...calves];
    newCalves[index].imageUri = undefined;
    newCalves[index].imageBase64 = undefined;
    setCalves(newCalves);
  };

  const handleSubmit = async () => {
    // Basic validation
    for (let i = 0; i < calves.length; i++) {
      if (!calves[i].earTag) {
        return toast.error(`Please provide an Ear Tag for Calf #${i + 1}`);
      }
    }

    setIsSubmitting(true);
    try {
      await api.post("/animals/record-calving", {
        pregnancyId,
        animalId,
        date,
        calvingEase,
        numberOfCalves: calves.length,
        calves: calves.map((c) => ({
          sex: c.sex,
          earTag: c.earTag,
          color: c.color,
          imageUrl: c.imageBase64 || "",
        })),
        technicianNote,
      });

      toast.success("Calving recorded! New animals added to registry.");
      queryClient.invalidateQueries({ queryKey: ["animals", "my"] });
      queryClient.invalidateQueries({ queryKey: ["breeding-milestones"] });
      router.back();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to record calving");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <View
        style={{ paddingTop: insets.top, backgroundColor: colors.card, borderBottomColor: colors.border }}
        className="border-b"
      >
        <View className="px-6 py-4 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full"
            style={{ backgroundColor: isDark ? colors.background : '#f8fafc' }}
          >
            <ArrowLeft size={20} color={primaryColor} />
          </TouchableOpacity>
          <View className="items-center">
            <Text className="text-lg font-black" style={{ color: colors.textPrimary }}>
              Record Calving
            </Text>
            <Text className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: colors.textMuted }}>
              Mother: {earTag || "N/A"}
            </Text>
          </View>
          <View className="w-10" />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 220 }}
      >
        {/* Info Box */}
        <View 
          className="mt-6 p-4 rounded-3xl border flex-row items-start"
          style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff', borderColor: isDark ? 'transparent' : '#bfdbfe' }}
        >
          <Info size={18} color={isDark ? '#60a5fa' : '#3B82F6'} style={{ marginTop: 2 }} />
          <Text className="ml-3 flex-1 text-[12px] leading-5 font-medium" style={{ color: isDark ? '#dbeafe' : '#1e3a8a' }}>
            Recording a calving will automatically register the new offspring
            into your animal list.
          </Text>
        </View>

        {/* Date & Ease Section */}
        <View className="mt-8">
          <View>
            <Text className="text-[10px] font-black uppercase tracking-widest ml-1 mb-2" style={{ color: colors.textMuted }}>
              Calving Date
            </Text>
            <View className="border rounded-2xl px-4 py-3 flex-row items-center" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              <Calendar size={16} color={colors.textMuted} />
              <TextInput
                className="flex-1 ml-3 font-bold"
                style={{ color: colors.textPrimary }}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </View>

        <View className="mt-6">
          <Text className="text-[10px] font-black uppercase tracking-widest ml-1 mb-2" style={{ color: colors.textMuted }}>
            Calving Ease
          </Text>
          <View className="flex-row gap-2">
            {["Abortion", "Natural", "Difficult", "Stillbirth"].map(
              (option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setCalvingEase(option)}
                  className="flex-1 py-3 rounded-2xl items-center border"
                  style={{
                    backgroundColor: calvingEase === option ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5') : colors.card,
                    borderColor: calvingEase === option ? (isDark ? colors.primary : '#10b981') : colors.border
                  }}
                >
                  <Text
                    className="text-[11px] font-black"
                    style={{ color: calvingEase === option ? (isDark ? colors.primary : '#065f46') : colors.textMuted }}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
        </View>

        {/* Offspring List */}
        <View className="mt-10 flex-row justify-between items-center mb-4">
          <Text className="text-sm font-black uppercase tracking-widest" style={{ color: colors.textPrimary }}>
            Offspring Registry
          </Text>
          <TouchableOpacity
            onPress={addCalf}
            className="px-4 py-2 rounded-full flex-row items-center gap-2"
            style={{ backgroundColor: colors.tint }}
          >
            <Plus size={14} color={primaryColor} />
            <Text className="text-[11px] font-black" style={{ color: primaryColor }}>
              Add Multiple
            </Text>
          </TouchableOpacity>
        </View>

        {calves.map((calf, index) => (
          <View
            key={index}
            className="rounded-[32px] p-6 mb-6 border shadow-sm relative"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <View className="absolute -top-3 -left-2 w-8 h-8 rounded-full items-center justify-center shadow-md" style={{ backgroundColor: primaryColor }}>
              <Text className="text-white text-[10px] font-black">
                {index + 1}
              </Text>
            </View>

            {calves.length > 1 && (
              <TouchableOpacity
                onPress={() => removeCalf(index)}
                className="absolute top-4 right-4 p-2 rounded-full"
                style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2' }}
              >
                <Trash2 size={16} color={colors.error} />
              </TouchableOpacity>
            )}

            <View className="gap-5">
              {/* Sex Toggle */}
              <View>
                <Text className="text-[9px] font-black uppercase tracking-widest mb-2 ml-1" style={{ color: colors.textMuted }}>
                  Gender / Sex
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => updateCalf(index, "sex", "F")}
                    className="flex-1 py-3 rounded-xl items-center border"
                    style={{
                      backgroundColor: calf.sex === "F" ? (isDark ? 'rgba(244, 63, 94, 0.15)' : '#fff5f5') : (isDark ? colors.background : '#f8fafc'),
                      borderColor: calf.sex === "F" ? '#f43f5e' : 'transparent'
                    }}
                  >
                    <Text
                      className="text-[10px] font-black"
                      style={{ color: calf.sex === "F" ? '#f43f5e' : colors.textMuted }}
                    >
                      Female
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateCalf(index, "sex", "M")}
                    className="flex-1 py-3 rounded-xl items-center border"
                    style={{
                      backgroundColor: calf.sex === "M" ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : (isDark ? colors.background : '#f8fafc'),
                      borderColor: calf.sex === "M" ? '#3b82f6' : 'transparent'
                    }}
                  >
                    <Text
                      className="text-[10px] font-black"
                      style={{ color: calf.sex === "M" ? '#3b82f6' : colors.textMuted }}
                    >
                      Male
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tag & Color */}
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-[9px] font-black uppercase tracking-widest mb-2 ml-1" style={{ color: colors.textMuted }}>
                    Ear Tag #
                  </Text>
                  <View className="rounded-xl px-4 py-3 flex-row items-center" style={{ backgroundColor: isDark ? colors.background : '#f8fafc' }}>
                    <Hash size={14} color={colors.textMuted} />
                    <TextInput
                      className="flex-1 ml-2 font-bold text-xs"
                      style={{ color: colors.textPrimary }}
                      value={calf.earTag}
                      onChangeText={(val) => updateCalf(index, "earTag", val)}
                      placeholder="TAG-XXX"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-[9px] font-black uppercase tracking-widest mb-2 ml-1" style={{ color: colors.textMuted }}>
                    Color / Markings
                  </Text>
                  <View className="rounded-xl px-4 py-3 flex-row items-center" style={{ backgroundColor: isDark ? colors.background : '#f8fafc' }}>
                    <Palette size={14} color={colors.textMuted} />
                    <TextInput
                      className="flex-1 ml-2 font-bold text-xs"
                      style={{ color: colors.textPrimary }}
                      value={calf.color}
                      onChangeText={(val) => updateCalf(index, "color", val)}
                      placeholder="Brown, White..."
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              </View>

              {/* Calf Image Picker */}
              <View>
                <Text className="text-[9px] font-black uppercase tracking-widest mb-2 ml-1" style={{ color: colors.textMuted }}>
                  Calf Image / Photo (Optional)
                </Text>
                {calf.imageUri ? (
                  <View className="rounded-2xl overflow-hidden border shadow-sm relative" style={{ borderColor: colors.border }}>
                    <Image source={{ uri: calf.imageUri }} className="w-full h-32" resizeMode="cover" />
                    <TouchableOpacity
                      onPress={() => removeCalfImage(index)}
                      className="absolute top-2 right-2 p-2 bg-black/60 rounded-full"
                    >
                      <X size={14} color="white" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => takeCalfPhoto(index)}
                      className="flex-1 py-3.5 rounded-xl border flex-row justify-center items-center gap-2"
                      style={{ backgroundColor: isDark ? colors.background : '#f8fafc', borderColor: colors.border }}
                    >
                      <Camera size={14} color={primaryColor} />
                      <Text className="text-[10px] font-black" style={{ color: primaryColor }}>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => pickCalfImage(index)}
                      className="flex-1 py-3.5 rounded-xl border flex-row justify-center items-center gap-2"
                      style={{ backgroundColor: isDark ? colors.background : '#f8fafc', borderColor: colors.border }}
                    >
                      <ImageIcon size={14} color={primaryColor} />
                      <Text className="text-[10px] font-black" style={{ color: primaryColor }}>Choose Gallery</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}

        {/* Note Box */}
        <View className="mt-4">
          <Text className="text-[10px] font-black uppercase tracking-widest ml-1 mb-2" style={{ color: colors.textMuted }}>
            Observations (Optional)
          </Text>
          <TextInput
            className="border rounded-[28px] p-5 text-xs min-h-[120px]"
            style={{ backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholder="Any special notes about the birth or the offspring's condition..."
            placeholderTextColor={colors.textMuted}
            value={technicianNote}
            onChangeText={setTechnicianNote}
          />
        </View>
      </ScrollView>

      {/* Floating Save Button */}
      <View
        style={{ paddingBottom: Math.max(insets.bottom + 16, 24), backgroundColor: colors.card, borderTopColor: colors.border }}
        className="px-6 pt-4 border-t absolute bottom-0 left-0 right-0"
      >
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          className="h-16 rounded-[24px] flex-row items-center justify-center gap-3"
          style={{
            backgroundColor: isSubmitting ? '#34d399' : primaryColor,
            elevation: 8,
            shadowColor: primaryColor,
            shadowOpacity: 0.3,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <ClipboardCheck size={20} color="white" />
              <Text className="text-white font-black text-base uppercase tracking-widest">
                Register Offspring
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
