import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  User,
  ChevronDown,
  Camera,
  X,
  Plus,
  Calendar,
  ShieldCheck,
  Search,
} from "lucide-react-native";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import * as ImagePicker from "expo-image-picker";
import { CATTLE_BREEDS, CATTLE_SPECIES, CATTLE_COLORS } from "@/lib/constants";
import DateTimePicker from "@react-native-community/datetimepicker";

export default function RegisterAnimalScreen() {
  const router = useRouter();
  const api = useApi();

  const [saving, setSaving] = useState(false);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [searchFarmerQuery, setSearchFarmerQuery] = useState("");
  const [showFarmerModal, setShowFarmerModal] = useState(false);

  const [formData, setFormData] = useState({
    earTag: "",
    brand: "",
    species: CATTLE_SPECIES[0],
    breed: "",
    color: "",
    dob: new Date().toISOString().split("T")[0],
  });

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [showBreedModal, setShowBreedModal] = useState(false);
  const [showSpeciesModal, setShowSpeciesModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        const res = await api.get("/user?role=farmer");
        setFarmers(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchFarmers();
  }, [api]);

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSave = async () => {
    if (!selectedFarmer) {
      toast.error("Please select an owner/farmer first");
      return;
    }
    if (!formData.earTag.trim()) {
      toast.error("Ear Tag is required");
      return;
    }
    if (!formData.breed) {
      toast.error("Breed is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        farmerName: selectedFarmer._id,
        earTag: formData.earTag.trim(),
        brand: formData.brand.trim() || undefined,
        species: formData.species,
        breed: formData.breed,
        color: formData.color,
        dob: formData.dob,
        gender: "Female", // Set to default Breeding Female target for programs
        imageUrl: imageBase64 || undefined,
      };

      await api.post("/technician/walk-in-livestock", payload);
      toast.success("Animal registered successfully!");
      router.back();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to register animal");
    } finally {
      setSaving(false);
    }
  };

  const filteredFarmers = farmers.filter(
    (f) =>
      f.name?.toLowerCase().includes(searchFarmerQuery.toLowerCase()) ||
      f.address?.phoneNumber?.includes(searchFarmerQuery),
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <View className="flex-row items-center px-6 py-4 bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-4 p-2 bg-slate-50 rounded-full"
        >
          <ArrowLeft size={20} color="#1e293b" />
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "Outfit_900Black",
            fontSize: 20,
            color: "#1e293b",
          }}
        >
          Register Livestock
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          className="flex-1 px-6 pt-6"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-emerald-50 rounded-2xl p-4 mb-6 border border-emerald-100 flex-row items-center">
            <View className="w-10 h-10 bg-emerald-100 rounded-full items-center justify-center mr-3">
              <ShieldCheck size={20} color="#059669" />
            </View>
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-emerald-800 text-xs flex-1"
            >
              Manually register an animal profile for walk-in clients. Records
              are synced instantly to the city registry.
            </Text>
          </View>

          {/* FARMER OWNER SELECTION */}
          <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">
            Owner / Client Selection
          </Text>
          <TouchableOpacity
            onPress={() => setShowFarmerModal(true)}
            className="bg-white border border-slate-100 rounded-2xl p-4 flex-row items-center justify-between mb-6 shadow-sm"
          >
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 bg-emerald-50 rounded-full items-center justify-center mr-3">
                <User size={20} color="#00643B" />
              </View>
              <View className="flex-1">
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className={`text-base ${selectedFarmer ? "text-slate-800" : "text-slate-300"}`}
                >
                  {selectedFarmer
                    ? selectedFarmer.name
                    : "Select Client / Owner..."}
                </Text>
                {selectedFarmer && (
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-[10px] text-slate-400 uppercase mt-0.5"
                  >
                    {selectedFarmer.address?.barangay || "No Barangay"} •{" "}
                    {selectedFarmer.address?.phoneNumber || "No Phone"}
                  </Text>
                )}
              </View>
            </View>
            <ChevronDown size={20} color="#94a3b8" />
          </TouchableOpacity>

          {/* ANIMAL IDENTITY */}
          <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">
            Animal Identity
          </Text>
          <View className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-6 gap-4">
            {/* Photo upload */}
            <View className="items-center mb-2 mt-1">
              <TouchableOpacity
                onPress={handlePickImage}
                className="w-24 h-24 bg-slate-55 rounded-full items-center justify-center border border-dashed border-slate-200 overflow-hidden relative shadow-inner bg-slate-50"
              >
                {imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <>
                    <Camera size={22} color="#94a3b8" />
                    <Text className="text-[9px] text-slate-400 font-outfit-bold text-center mt-1 uppercase">
                      Add Photo
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-slate-700 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">
                  Ear Tag *
                </Text>
                <TextInput
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                  placeholder="TAG-XXXX"
                  value={formData.earTag}
                  onChangeText={(t) => setFormData({ ...formData, earTag: t })}
                />
              </View>
              <View className="flex-1">
                <Text className="text-slate-700 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">
                  Brand
                </Text>
                <TextInput
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                  value={formData.brand}
                  onChangeText={(t) => setFormData({ ...formData, brand: t })}
                />
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-slate-700 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">
                  Species
                </Text>
                <TouchableOpacity
                  onPress={() => setShowSpeciesModal(true)}
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-slate-700 text-xs"
                  >
                    {formData.species}
                  </Text>
                  <ChevronDown size={14} color="#64748b" />
                </TouchableOpacity>
              </View>
              <View className="flex-1">
                <Text className="text-slate-700 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">
                  Breed *
                </Text>
                <TouchableOpacity
                  onPress={() => setShowBreedModal(true)}
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className={`text-xs ${formData.breed ? "text-slate-700" : "text-slate-300"}`}
                  >
                    {formData.breed || "Select Breed..."}
                  </Text>
                  <ChevronDown size={14} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-slate-700 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">
                  Color
                </Text>
                <TouchableOpacity
                  onPress={() => setShowColorModal(true)}
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className={`text-xs ${formData.color ? "text-slate-700" : "text-slate-300"}`}
                  >
                    {formData.color || "Select Color..."}
                  </Text>
                  <ChevronDown size={14} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Estimated DOB */}
              <View className="flex-1">
                <View className="flex-row justify-between items-center mb-1 ml-1">
                  <Text className="text-slate-700 text-[11px] font-outfit-bold uppercase">
                    Date of Birth
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setFormData({
                        ...formData,
                        dob: new Date().toISOString().split("T")[0],
                      })
                    }
                    className="active:opacity-50"
                  >
                    <Text className="text-emerald-600 text-[9px] font-outfit-bold uppercase tracking-wider">
                      Today
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-slate-700 text-xs"
                  >
                    {formData.dob}
                  </Text>
                  <Calendar size={16} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            className={`py-5 rounded-[24px] flex-row justify-center items-center shadow-lg mb-10 ${saving ? "bg-slate-400" : "bg-[#00643B]"}`}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Plus size={20} color="white" style={{ marginRight: 10 }} />
                <Text
                  style={{ fontFamily: "Outfit_800ExtraBold" }}
                  className="text-white text-base"
                >
                  Register Livestock
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FARMER SELECTION MODAL */}
      <Modal visible={showFarmerModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[32px] p-6 pb-10 max-h-[85%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  fontSize: 18,
                  color: "#1e293b",
                }}
              >
                Select Client
              </Text>
              <TouchableOpacity
                onPress={() => setShowFarmerModal(false)}
                className="p-1 bg-slate-55 rounded-full bg-slate-50"
              >
                <X size={20} color="black" />
              </TouchableOpacity>
            </View>

            <View className="flex-row bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4 items-center">
              <Search size={18} color="#94a3b8" style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search client by name or phone..."
                className="flex-1 font-outfit-medium text-slate-800 text-sm"
                value={searchFarmerQuery}
                onChangeText={setSearchFarmerQuery}
              />
            </View>

            <FlatList
              data={filteredFarmers}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedFarmer(item);
                    setShowFarmerModal(false);
                  }}
                  className="py-4 border-b border-slate-100 flex-row justify-between items-center"
                >
                  <View>
                    <Text
                      style={{ fontFamily: "Outfit_700Bold" }}
                      className="text-slate-800 text-base"
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-xs text-slate-400 uppercase mt-0.5"
                    >
                      {item.address?.barangay || "No Barangay"} •{" "}
                      {item.address?.phoneNumber || "No Phone"}
                    </Text>
                  </View>
                  <ChevronDown
                    size={14}
                    color="#94a3b8"
                    style={{ transform: [{ rotate: "-90deg" }] }}
                  />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View className="py-8 items-center">
                  <Text className="font-outfit-bold text-slate-400">
                    No clients found
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* SPECIES SELECTION MODAL */}
      <Modal visible={showSpeciesModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[32px] p-6 pb-10 max-h-[50%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  fontSize: 18,
                  color: "#1e293b",
                }}
              >
                Select Species
              </Text>
              <TouchableOpacity
                onPress={() => setShowSpeciesModal(false)}
                className="p-1 bg-slate-50 rounded-full"
              >
                <X size={20} color="black" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={CATTLE_SPECIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setFormData({ ...formData, species: item });
                    setShowSpeciesModal(false);
                  }}
                  className="py-3.5 border-b border-slate-100"
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-sm text-slate-800"
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* BREED SELECTION MODAL */}
      <Modal visible={showBreedModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[32px] p-6 pb-10 max-h-[70%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  fontSize: 18,
                  color: "#1e293b",
                }}
              >
                Select Breed
              </Text>
              <TouchableOpacity
                onPress={() => setShowBreedModal(false)}
                className="p-1 bg-slate-55 rounded-full bg-slate-50"
              >
                <X size={20} color="black" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={CATTLE_BREEDS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setFormData({ ...formData, breed: item });
                    setShowBreedModal(false);
                  }}
                  className="py-3.5 border-b border-slate-100"
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-sm text-slate-800"
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* COLOR SELECTION MODAL */}
      <Modal visible={showColorModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[32px] p-6 pb-10 max-h-[70%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  fontSize: 18,
                  color: "#1e293b",
                }}
              >
                Select Color
              </Text>
              <TouchableOpacity
                onPress={() => setShowColorModal(false)}
                className="p-1 bg-slate-55 rounded-full bg-slate-50"
              >
                <X size={20} color="black" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={CATTLE_COLORS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setFormData({ ...formData, color: item });
                    setShowColorModal(false);
                  }}
                  className="py-3.5 border-b border-slate-100"
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-sm text-slate-800"
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={new Date(formData.dob)}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) {
              setFormData({
                ...formData,
                dob: date.toISOString().split("T")[0],
              });
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}
