import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, FlatList, ActivityIndicator, Alert, StatusBar, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trash2, Camera, Plus, MapPin, Calendar, Clock, X, Save, Image as ImageIcon } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { toast } from 'sonner-native';
import * as ImagePicker from 'expo-image-picker';

const PRIMARY = '#00643B';

// Generate simulated Oton farm coordinates
const generateOtonCoordinates = () => {
  const lat = (10.6967 + (Math.random() - 0.5) * 0.025).toFixed(4);
  const lng = (122.4820 + (Math.random() - 0.5) * 0.025).toFixed(4);
  return { latitude: lat, longitude: lng };
};

// Initial Mock data with simulated high-fidelity coordinates
const INITIAL_NOTES = [
  {
    id: '1',
    title: 'Heat Sign Observation',
    description: 'Cow #024 showing strong heat signs this morning. Mucus discharge noted. Ready for AI session at 2:00 PM.',
    image: 'https://res.cloudinary.com/donhulins/image/upload/v1778122059/media__1778122059581.png',
    date: 'May 07, 2026',
    time: '08:30 AM',
    location: 'Oton, Iloilo',
    latitude: '10.6974',
    longitude: '122.4831',
    farmer: 'Pedro Salazar'
  },
  {
    id: '2',
    title: 'Post-Treatment Check',
    description: 'Calf with diarrhea is showing improvement after 24h hydration therapy. Appetite returning to normal.',
    image: 'https://res.cloudinary.com/donhulins/image/upload/v1778122627/media__1778122627811.png',
    date: 'May 06, 2026',
    time: '04:15 PM',
    location: 'San Nicolas',
    latitude: '10.6841',
    longitude: '122.4712',
    farmer: 'Maria Lopez'
  },
  {
    id: '3',
    title: 'New Herd Addition',
    description: 'Inspected 5 new head of cattle for Aling Nena. All vaccinations verified and records synced to hub.',
    image: 'https://res.cloudinary.com/donhulins/image/upload/v1778123376/media__1778123376142.png',
    date: 'May 05, 2026',
    time: '11:00 AM',
    location: 'Poblacion',
    latitude: '10.7093',
    longitude: '122.4955',
    farmer: 'Aling Nena'
  }
];

export default function PhotoNotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState(INITIAL_NOTES);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form State
  const [newNote, setNewNote] = useState({
    title: '',
    description: '',
    image: '',
    farmer: '',
    latitude: '',
    longitude: ''
  });

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      const coords = generateOtonCoordinates();
      setNewNote({ 
        ...newNote, 
        image: result.assets[0].uri,
        latitude: coords.latitude,
        longitude: coords.longitude
      });
      toast.success("Location tagged at photo capture site!");
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Permission to access camera was denied');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      const coords = generateOtonCoordinates();
      setNewNote({ 
        ...newNote, 
        image: result.assets[0].uri,
        latitude: coords.latitude,
        longitude: coords.longitude
      });
      toast.success("Location tagged at photo capture site!");
    }
  };

  const handleSave = () => {
    if (!newNote.title || !newNote.image) {
      toast.error("Title and Image are required");
      return;
    }

    const note = {
      id: Date.now().toString(),
      ...newNote,
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      time: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      location: 'Oton, Iloilo',
    };

    setNotes([note as any, ...notes]);
    setModalVisible(false);
    setNewNote({ title: '', description: '', image: '', farmer: '', latitude: '', longitude: '' });
    toast.success("Field note saved!");
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Note",
      "Are you sure you want to permanently remove this photo note?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => {
            setNotes((prev: any[]) => prev.filter((n: any) => n.id !== id));
            toast.success("Note deleted successfully");
          }
        }
      ]
    );
  };

  const renderNote = ({ item }: { item: typeof INITIAL_NOTES[0] }) => (
    <View style={{ backgroundColor: '#fff', borderRadius: 28, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, elevation: 4, borderWidth: 1, borderColor: '#f1f5f9' }}>
      <View style={{ height: 180, position: 'relative' }}>
        <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
           <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'Outfit_700Bold' }}>{item.date}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => handleDelete(item.id)}
          style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(239, 68, 68, 0.9)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Trash2 size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={{ padding: 20 }}>
         <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
               <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: '#1e293b' }}>{item.title}</Text>
               <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                     <MapPin size={12} color="#059669" />
                     <Text style={{ fontSize: 11, fontFamily: 'Outfit_700Bold', color: '#059669' }}>
                       {item.location} ({item.latitude || '10.6967'}°, {item.longitude || '122.4820'}°)
                     </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                     <Clock size={12} color="#94a3b8" />
                     <Text style={{ fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: '#64748b' }}>{item.time}</Text>
                  </View>
               </View>
            </View>
         </View>

         <Text style={{ fontSize: 14, fontFamily: 'Outfit_500Medium', color: '#475569', marginTop: 12, lineHeight: 20 }}>
            {item.description}
         </Text>

         <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
               <MaterialCommunityIcons name="account" size={14} color={PRIMARY} />
            </View>
            <Text style={{ fontSize: 12, fontFamily: 'Outfit_700Bold', color: '#334155' }}>{item.farmer}</Text>
         </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="dark-content" />
      
      {/* Premium Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} color="#1e293b" />
          </TouchableOpacity>
          <View>
            <Text style={{ color: '#1e293b', fontFamily: 'Outfit_900Black', fontSize: 22 }}>Photo Notes</Text>
            <Text style={{ color: '#94a3b8', fontFamily: 'Outfit_500Medium', fontSize: 12 }}>{notes.length} Total Logs</Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={() => setModalVisible(true)}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}
        >
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={notes}
        keyExtractor={item => item.id}
        renderItem={renderNote}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ marginTop: 100, alignItems: 'center' }}>
            <Camera size={64} color="#cbd5e1" />
            <Text style={{ fontFamily: 'Outfit_700Bold', color: '#94a3b8', marginTop: 16, fontSize: 16 }}>No photo notes yet</Text>
            <Text style={{ fontFamily: 'Outfit_500Medium', color: '#cbd5e1', marginTop: 4 }}>Capture your field operations with Moowie! 📸</Text>
          </View>
        }
      />

      {/* Add Note Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
         <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '90%' }}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 24, color: '#1e293b' }}>Add Field Note</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                     <X size={20} color="#64748b" />
                  </TouchableOpacity>
               </View>

               <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Image Selector */}
                  <TouchableOpacity 
                    onPress={pickImage}
                    style={{ height: 160, backgroundColor: '#f8fafc', borderRadius: 24, borderStyle: 'dashed', borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 20 }}
                  >
                     {newNote.image ? (
                        <Image source={{ uri: newNote.image }} style={{ width: '100%', height: '100%' }} />
                     ) : (
                        <View style={{ alignItems: 'center' }}>
                           <Camera size={40} color="#cbd5e1" />
                           <Text style={{ fontFamily: 'Outfit_700Bold', color: '#94a3b8', marginTop: 8 }}>Tap to capture or upload</Text>
                        </View>
                     )}
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                     <TouchableOpacity onPress={takePhoto} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 12, paddingVertical: 12 }}>
                        <Camera size={18} color="#2563eb" />
                        <Text style={{ fontFamily: 'Outfit_700Bold', color: '#2563eb', fontSize: 13 }}>Camera</Text>
                     </TouchableOpacity>
                     <TouchableOpacity onPress={pickImage} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#f0fdf4', borderRadius: 12, paddingVertical: 12 }}>
                        <ImageIcon size={18} color="#16a34a" />
                        <Text style={{ fontFamily: 'Outfit_700Bold', color: '#16a34a', fontSize: 13 }}>Gallery</Text>
                     </TouchableOpacity>
                  </View>

                  {/* Form Fields */}
                  <View style={{ gap: 20 }}>
                     <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                           <Text style={{ fontFamily: 'Outfit_700Bold', color: '#64748b', fontSize: 12, marginBottom: 8, marginLeft: 4 }}>LATITUDE</Text>
                           <TextInput 
                              editable={false}
                              placeholder="Auto-Located"
                              placeholderTextColor="#cbd5e1"
                              style={{ backgroundColor: '#f1f5f9', borderRadius: 16, padding: 16, fontFamily: 'Outfit_600SemiBold', fontSize: 14, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f766e' }}
                              value={newNote.latitude}
                           />
                        </View>
                        <View style={{ flex: 1 }}>
                           <Text style={{ fontFamily: 'Outfit_700Bold', color: '#64748b', fontSize: 12, marginBottom: 8, marginLeft: 4 }}>LONGITUDE</Text>
                           <TextInput 
                              editable={false}
                              placeholder="Auto-Located"
                              placeholderTextColor="#cbd5e1"
                              style={{ backgroundColor: '#f1f5f9', borderRadius: 16, padding: 16, fontFamily: 'Outfit_600SemiBold', fontSize: 14, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f766e' }}
                              value={newNote.longitude}
                           />
                        </View>
                     </View>

                     <View>
                        <Text style={{ fontFamily: 'Outfit_700Bold', color: '#64748b', fontSize: 12, marginBottom: 8, marginLeft: 4 }}>NOTE TITLE</Text>
                        <TextInput 
                           placeholder="e.g. Insemination Session #4"
                           style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, fontFamily: 'Outfit_600SemiBold', fontSize: 15, borderWidth: 1, borderColor: '#f1f5f9' }}
                           value={newNote.title}
                           onChangeText={(t) => setNewNote({...newNote, title: t})}
                         />
                     </View>

                     <View>
                        <Text style={{ fontFamily: 'Outfit_700Bold', color: '#64748b', fontSize: 12, marginBottom: 8, marginLeft: 4 }}>FARMER NAME</Text>
                        <TextInput 
                           placeholder="Who is this note for?"
                           style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, fontFamily: 'Outfit_600SemiBold', fontSize: 15, borderWidth: 1, borderColor: '#f1f5f9' }}
                           value={newNote.farmer}
                           onChangeText={(t) => setNewNote({...newNote, farmer: t})}
                        />
                     </View>

                     <View>
                        <Text style={{ fontFamily: 'Outfit_700Bold', color: '#64748b', fontSize: 12, marginBottom: 8, marginLeft: 4 }}>OBSERVATIONS</Text>
                        <TextInput 
                           placeholder="Describe what you see in the field..."
                           multiline
                           numberOfLines={4}
                           style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, fontFamily: 'Outfit_500Medium', fontSize: 15, borderWidth: 1, borderColor: '#f1f5f9', height: 100, textAlignVertical: 'top' }}
                           value={newNote.description}
                           onChangeText={(t) => setNewNote({...newNote, description: t})}
                        />
                     </View>
                  </View>

                  <TouchableOpacity 
                    onPress={handleSave}
                    style={{ backgroundColor: PRIMARY, marginTop: 32, borderRadius: 20, alignItems: 'center', shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8, paddingVertical: 16 }}
                  >
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Save size={20} color="#fff" />
                        <Text style={{ color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 16 }}>Save Field Note</Text>
                     </View>
                  </TouchableOpacity>
                  
                  <View style={{ height: 40 }} />
               </ScrollView>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}
