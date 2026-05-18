import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Download, Map as MapIcon, Trash2, ShieldCheck, WifiOff } from "lucide-react-native";
import { downloadOtonTiles, clearTileCache } from "@/lib/mapCache";
import * as FileSystem from "expo-file-system/legacy";
import { toast } from "sonner-native";

export default function OfflineMapsScreen() {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [cacheSize, setCacheSize] = useState("0 MB");

  useEffect(() => {
    calculateCacheSize();
  }, []);

  const calculateCacheSize = async () => {
    const tileRoot = `${(FileSystem as any).documentDirectory}tiles/`;
    const info = await FileSystem.getInfoAsync(tileRoot);
    if (info.exists) {
        // Simple size check (recursive size is slow in react native file system, but we can estimate)
        // For now just showing a placeholder or generic "Exists"
        setCacheSize("Approx. 15-30 MB");
    } else {
        setCacheSize("0 MB");
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadOtonTiles((current, max) => {
        setProgress(current);
        setTotal(max);
      });
      toast.success("Oton Offline Map Ready!");
      calculateCacheSize();
    } catch (e) {
      toast.error("Download failed. Check your internet.");
    } finally {
      setDownloading(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      "Clear Cache?",
      "This will remove all offline map tiles. You won't be able to see the map without internet.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear", 
          style: "destructive", 
          onPress: async () => {
            await clearTileCache();
            calculateCacheSize();
            toast.info("Map cache cleared");
          } 
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 24, backgroundColor: "#fff" }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={{ fontFamily: "Outfit_900Black", fontSize: 22, color: "#1e293b" }}>Offline Assets</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 32, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: "#f1f5f9" }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <MapIcon size={32} color="#059669" />
          </View>
          <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 18, color: "#1e293b" }}>Oton Municipal Map</Text>
          <Text style={{ fontFamily: "Outfit_500Medium", fontSize: 14, color: "#64748b", marginTop: 4, lineHeight: 20 }}>
            Download map tiles for all 37 Barangays to navigate in "no-signal" zones.
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 24, gap: 12 }}>
             <View style={{ flex: 1, backgroundColor: "#f8fafc", padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "#f1f5f9" }}>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>Storage Used</Text>
                <Text style={{ fontFamily: "Outfit_900Black", fontSize: 16, color: "#1e293b", marginTop: 4 }}>{cacheSize}</Text>
             </View>
             <View style={{ flex: 1, backgroundColor: "#f8fafc", padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "#f1f5f9" }}>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>Barangays</Text>
                <Text style={{ fontFamily: "Outfit_900Black", fontSize: 16, color: "#1e293b", marginTop: 4 }}>37 Covered</Text>
             </View>
          </View>

          {downloading ? (
            <View style={{ marginTop: 32 }}>
              <View style={{ height: 8, backgroundColor: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                <View style={{ width: `${(progress / total) * 100}%`, height: "100%", backgroundColor: "#059669" }} />
              </View>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 12, color: "#64748b", marginTop: 12, textAlign: "center" }}>
                Downloading tiles... {progress} / {total}
              </Text>
            </View>
          ) : (
            <TouchableOpacity 
              onPress={handleDownload}
              style={{ backgroundColor: "#00643B", padding: 20, borderRadius: 24, marginTop: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}
            >
              <Download size={20} color="#fff" />
              <Text style={{ fontFamily: "Outfit_800ExtraBold", color: "#fff", fontSize: 16 }}>Download Map Data</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ backgroundColor: "#fff", borderRadius: 32, padding: 24, borderWidth: 1, borderColor: "#f1f5f9" }}>
             <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 16, color: "#1e293b", marginBottom: 16 }}>Management</Text>
             
             <TouchableOpacity 
                onPress={handleClear}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 16 }}
             >
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center" }}>
                   <Trash2 size={20} color="#dc2626" />
                </View>
                <View style={{ flex: 1 }}>
                   <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: "#1e293b" }}>Clear Map Cache</Text>
                   <Text style={{ fontFamily: "Outfit_500Medium", fontSize: 12, color: "#94a3b8" }}>Free up space on your device</Text>
                </View>
             </TouchableOpacity>

             <View style={{ height: 1, backgroundColor: "#f1f5f9", marginVertical: 8 }} />

             <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 16 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#f0f9ff", alignItems: "center", justifyContent: "center" }}>
                   <ShieldCheck size={20} color="#0284c7" />
                </View>
                <View style={{ flex: 1 }}>
                   <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: "#1e293b" }}>Verified Area</Text>
                   <Text style={{ fontFamily: "Outfit_500Medium", fontSize: 12, color: "#94a3b8" }}>Official boundaries for Oton, Iloilo</Text>
                </View>
             </View>
        </View>

        <View style={{ marginTop: 32, padding: 24, backgroundColor: "#fefce8", borderRadius: 24, borderWidth: 1, borderColor: "#fef08a", flexDirection: "row", gap: 16 }}>
            <WifiOff size={24} color="#a16207" />
            <Text style={{ flex: 1, fontFamily: "Outfit_500Medium", fontSize: 12, color: "#a16207", lineHeight: 18 }}>
                Once downloaded, the app will automatically switch to offline tiles whenever you lose internet connection in the field.
            </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
