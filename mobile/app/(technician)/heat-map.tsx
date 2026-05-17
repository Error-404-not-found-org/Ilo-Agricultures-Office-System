import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Filter, Layers, Info } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PRIMARY = '#00643B';

export default function HeatMapScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" />
      
      {/* Premium Dark Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: 'rgba(15, 23, 42, 0.9)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_800ExtraBold', fontSize: 18 }}>Herd Insights</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Outfit_500Medium', fontSize: 11 }}>Oton, Iloilo · Live Data</Text>
          </View>
        </View>
        <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <Filter size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Map View Area */}
      <View style={{ flex: 1, backgroundColor: '#1e293b', overflow: 'hidden' }}>
        <Image 
          source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1200&q=80' }} 
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />

        {/* Mock Live Coordinates Overlays */}
        {/* In Heat - Red Dot */}
        <View style={{ position: 'absolute', top: '45%', left: '50%', width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' }} />
        </View>
        
        {/* Pregnant - Blue Dot */}
        <View style={{ position: 'absolute', top: '58%', left: '35%', width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(59, 130, 246, 0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' }} />
        </View>
        
        {/* Normal - Green Dot */}
        <View style={{ position: 'absolute', top: '30%', left: '62%', width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(16, 185, 129, 0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981' }} />
        </View>

        {/* Floating Controls */}
        <View style={{ position: 'absolute', right: 16, top: 16, gap: 12 }}>
          <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.8)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <Layers size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.8)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <MapPin size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Legend Overlay */}
        <View style={{ position: 'absolute', left: 16, bottom: 24, right: 16 }}>
          <View style={{ backgroundColor: 'rgba(15,23,42,0.9)', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
               <Text style={{ color: '#fff', fontFamily: 'Outfit_800ExtraBold', fontSize: 14 }}>Status Legend</Text>
               <Info size={16} color="rgba(255,255,255,0.4)" />
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
               <LegendItem color="#ef4444" label="In Heat" count="12" />
               <LegendItem color="#3b82f6" label="Pregnant" count="45" />
               <LegendItem color="#10b981" label="Normal" count="128" />
            </View>

            <TouchableOpacity 
              activeOpacity={0.8}
              style={{ backgroundColor: PRIMARY, marginTop: 16, paddingVertical: 12, borderRadius: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontFamily: 'Outfit_700Bold', fontSize: 13 }}>Generate Field Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const LegendItem = ({ color, label, count }: any) => (
  <View style={{ alignItems: 'center', gap: 4 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: '#fff', fontFamily: 'Outfit_700Bold', fontSize: 12 }}>{count}</Text>
    </View>
    <Text style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Outfit_500Medium', fontSize: 10 }}>{label}</Text>
  </View>
);
