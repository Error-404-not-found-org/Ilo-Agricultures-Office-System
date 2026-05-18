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
  Scale,
  Hash,
  Info,
} from "lucide-react-native";
import React, { useState, useEffect } from "react";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface CalfEntry {
  sex: "M" | "F";
  earTag: string;
  weight: string;
}

export default function RecordCalving() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const pregnancyId = params.pregnancyId as string;
  const animalId = params.animalId as string;
  const earTag = params.earTag as string;

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [calvingEase, setCalvingEase] = useState("Normal");
  const [technicianNote, setTechnicianNote] = useState("");
  const [calves, setCalves] = useState<CalfEntry[]>([
    { sex: "F", earTag: "", weight: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addCalf = () => {
    if (calves.length >= 5) {
      return toast.error("Maximum 5 calves per event");
    }
    setCalves([...calves, { sex: "F", earTag: "", weight: "" }]);
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
          ...c,
          weight: c.weight ? parseFloat(c.weight) : undefined,
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
      className="flex-1 bg-[#F9FAFB] dark:bg-slate-950"
    >
      <View
        style={{ paddingTop: insets.top }}
        className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700"
      >
        <View className="px-6 py-4 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center bg-slate-50 dark:bg-slate-700 rounded-full"
          >
            <ArrowLeft size={20} color="#00643B" />
          </TouchableOpacity>
          <View className="items-center">
            <Text className="text-lg font-black text-slate-800 dark:text-white">
              Record Calving
            </Text>
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Mother: {earTag || "N/A"}
            </Text>
          </View>
          <View className="w-10" />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 }}
      >
        {/* Info Box */}
        <View className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-3xl border border-blue-100 dark:border-blue-800 flex-row items-start">
          <Info size={18} color="#3B82F6" style={{ marginTop: 2 }} />
          <Text className="ml-3 flex-1 text-[12px] leading-5 text-blue-900 dark:text-blue-100 font-medium">
            Recording a calving will automatically register the new offspring
            into your animal list.
          </Text>
        </View>

        {/* Date & Ease Section */}
        <View className="mt-8 grid grid-cols-2 gap-4">
          <View>
            <Text className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-2">
              Calving Date
            </Text>
            <View className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl px-4 py-3 flex-row items-center">
              <Calendar size={16} color="#94a3b8" />
              <TextInput
                className="flex-1 ml-3 text-slate-800 dark:text-white font-bold"
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
        </View>

        <View className="mt-6">
          <Text className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-2">
            Calving Ease
          </Text>
          <View className="flex-row gap-2">
            {["Abortion", "Natural", "Difficult", "Stillbirth"].map(
              (option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setCalvingEase(option)}
                  className={`flex-1 py-3 rounded-2xl items-center border ${calvingEase === option ? "bg-emerald-50 border-emerald-500" : "bg-white border-gray-100 dark:bg-slate-800 dark:border-slate-700"}`}
                >
                  <Text
                    className={`text-[11px] font-black ${calvingEase === option ? "text-emerald-700" : "text-slate-400"}`}
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
          <Text className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">
            Offspring Registry
          </Text>
          <TouchableOpacity
            onPress={addCalf}
            className="bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 rounded-full flex-row items-center gap-2"
          >
            <Plus size={14} color="#00643B" />
            <Text className="text-[11px] font-black text-[#00643B]">
              Add Multiple
            </Text>
          </TouchableOpacity>
        </View>

        {calves.map((calf, index) => (
          <View
            key={index}
            className="bg-white dark:bg-slate-800 rounded-[32px] p-6 mb-6 border border-gray-50 dark:border-slate-700 shadow-sm relative"
          >
            <View className="absolute -top-3 -left-2 w-8 h-8 rounded-full bg-[#00643B] items-center justify-center shadow-md">
              <Text className="text-white text-[10px] font-black">
                {index + 1}
              </Text>
            </View>

            {calves.length > 1 && (
              <TouchableOpacity
                onPress={() => removeCalf(index)}
                className="absolute top-4 right-4 p-2 bg-red-50 dark:bg-red-900/20 rounded-full"
              >
                <Trash2 size={16} color="#EF4444" />
              </TouchableOpacity>
            )}

            <View className="gap-5">
              {/* Sex Toggle */}
              <View>
                <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Gender / Sex
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => updateCalf(index, "sex", "F")}
                    className={`flex-1 py-3 rounded-xl items-center border ${calf.sex === "F" ? "bg-rose-50 border-rose-400" : "bg-slate-50 dark:bg-slate-700 border-transparent"}`}
                  >
                    <Text
                      className={`text-[10px] font-black ${calf.sex === "F" ? "text-rose-600" : "text-slate-400"}`}
                    >
                      Female
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateCalf(index, "sex", "M")}
                    className={`flex-1 py-3 rounded-xl items-center border ${calf.sex === "M" ? "bg-blue-50 border-blue-400" : "bg-slate-50 dark:bg-slate-700 border-transparent"}`}
                  >
                    <Text
                      className={`text-[10px] font-black ${calf.sex === "M" ? "text-blue-600" : "text-slate-400"}`}
                    >
                      Male
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tag & Weight */}
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                    Ear Tag #
                  </Text>
                  <View className="bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3 flex-row items-center">
                    <Hash size={14} color="#94a3b8" />
                    <TextInput
                      className="flex-1 ml-2 text-slate-800 dark:text-white font-bold text-xs"
                      value={calf.earTag}
                      onChangeText={(val) => updateCalf(index, "earTag", val)}
                      placeholder="TAG-XXX"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                    Weight (kg)
                  </Text>
                  <View className="bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3 flex-row items-center">
                    <Scale size={14} color="#94a3b8" />
                    <TextInput
                      className="flex-1 ml-2 text-slate-800 dark:text-white font-bold text-xs"
                      value={calf.weight}
                      onChangeText={(val) => updateCalf(index, "weight", val)}
                      placeholder="0.0"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        ))}

        {/* Note Box */}
        <View className="mt-4">
          <Text className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-2">
            Observations (Optional)
          </Text>
          <TextInput
            className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[28px] p-5 text-slate-800 dark:text-white text-xs min-h-[120px]"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholder="Any special notes about the birth or the offspring's condition..."
            placeholderTextColor="#94a3b8"
            value={technicianNote}
            onChangeText={setTechnicianNote}
          />
        </View>
        <View
          style={{ paddingBottom: Math.max(insets.bottom + 16, 90) }}
          className="px-6 pt-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 absolute bottom-0 left-0 right-0"
        >
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            className={`h-16 rounded-[24px] flex-row items-center justify-center gap-3 ${isSubmitting ? "bg-emerald-400" : "bg-[#00643B]"}`}
            style={{
              elevation: 8,
              shadowColor: "#00643B",
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
      </ScrollView>

      {/* Footer Button */}
    </KeyboardAvoidingView>
  );
}
