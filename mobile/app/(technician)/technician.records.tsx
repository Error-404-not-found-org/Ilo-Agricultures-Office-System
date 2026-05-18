import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StatusBar, TouchableOpacity, Image, Modal, TextInput, Linking, Platform } from 'react-native';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useApi } from '@/lib/api';
import { useRouter } from 'expo-router';
import { toast } from 'sonner-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Filter, Search, ClipboardList, X, MapPin, Calendar, Clock, Phone, ChevronRight, Trash2, Download } from 'lucide-react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';

const PRIMARY = "#00643B";

type FilterType = 'All' | 'AI' | 'Pregnancy' | 'Calving' | 'Health';

const getDisplayDate = (item: any) => {
  if (!item) return null;
  if (item.type === 'insemination') {
    return item.inseminationDate || item.scheduledDate || item.preferredDate || item.createdAt;
  }
  if (item.type === 'pregnancy') {
    return item.pregnancyDiagnosis?.date || item.date || item.createdAt;
  }
  if (item.type === 'calving') {
    return item.date || item.createdAt;
  }
  if (item.type === 'ai-request' || item.type === 'health-request') {
    return item.preferredDate || item.scheduledDate || item.createdAt;
  }
  return item.createdAt;
};

const ServiceLedger = () => {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('All');
  
  const [allRecords, setAllRecords] = useState<any[]>([]);

  // Calendar Date Range Filtering
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  
  // Date Picker show states
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Modal State
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string, type: string }) => {
      const endpoint = type === 'health-request' 
        ? `/health-request/${id}` 
        : type === 'insemination' 
          ? `/insemination/${id}`
          : type === 'pregnancy'
            ? `/technician/pregnancy-checks/${id}`
            : type === 'calving'
              ? `/technician/calvings/${id}`
              : `/ai-request/${id}`;
      return api.delete(endpoint);
    },
    onSuccess: () => {
      toast.success("Record deleted successfully");
      setDetailsVisible(false);
      fetchData();
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete record");
    }
  });

  const handleDelete = (item: any) => {
    Alert.alert(
      "Delete Record",
      "Are you sure you want to delete this record permanently?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => deleteMutation.mutate({ id: item.id || item._id, type: item.type }) 
        }
      ]
    );
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        api.get('/technician/inseminations'),
        api.get('/technician/pregnancy-checks'),
        api.get('/technician/calvings'),
        api.get('/ai-request'),
        api.get('/health-request')
      ]);
      
      const [insRes, pregRes, calvRes, aiRes, healthRes] = results.map(r => r.status === 'fulfilled' ? (r as any).value : { data: [] });

      const combined = [
        ...(insRes.data?.inseminations || []).map((i: any) => ({ ...i, type: 'insemination' })),
        ...(pregRes.data?.data || []).map((p: any) => ({ ...p, type: 'pregnancy' })),
        ...(calvRes.data?.data || []).map((c: any) => ({ ...c, type: 'calving' })),
        ...(Array.isArray(aiRes.data) ? aiRes.data : (aiRes.data?.data || [])).map((a: any) => ({ ...a, type: 'ai-request' })),
        ...(Array.isArray(healthRes.data) ? healthRes.data : (healthRes.data?.data || [])).map((h: any) => ({ ...h, type: 'health-request' }))
      ].sort((a, b) => new Date(getDisplayDate(b) || 0).getTime() - new Date(getDisplayDate(a) || 0).getTime());
      
      setAllRecords(combined);
    } catch (error: any) {
      console.error("Failed to fetch records:", error);
      toast.error("Error fetching ledger data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const openDetails = (item: any) => {
    setSelectedItem(item);
    setDetailsVisible(true);
  };

  // Search & Filter Logic
  const filteredRecords = useMemo(() => {
    return allRecords.filter(item => {
      // 1. Filter by Type
      if (selectedFilter !== 'All') {
        const matchesType = 
          (selectedFilter === 'AI' && (item.type === 'insemination' || item.type === 'ai-request')) ||
          (selectedFilter === 'Pregnancy' && item.type === 'pregnancy') ||
          (selectedFilter === 'Calving' && item.type === 'calving') ||
          (selectedFilter === 'Health' && item.type === 'health-request');
        if (!matchesType) return false;
      }

      // 2. Filter by Date Range (Calendar Filter)
      if (startDate || endDate) {
        const itemDateRaw = getDisplayDate(item);
        if (!itemDateRaw) return false;
        const itemTime = new Date(itemDateRaw).getTime();

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (itemTime < start.getTime()) return false;
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (itemTime > end.getTime()) return false;
        }
      }

      // 3. Filter by Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const farmerName = item.farmerId?.name?.toLowerCase() || "";
        const animalTag = item.animalId?.earTag?.toLowerCase() || item.animalId?.animalId?.toLowerCase() || "";
        const status = item.status?.toLowerCase() || "";
        return farmerName.includes(query) || animalTag.includes(query) || status.includes(query);
      }

      return true;
    });
  }, [allRecords, selectedFilter, startDate, endDate, searchQuery]);

  // Export to CSV Protocol
  const handleExportCSV = async () => {
    if (filteredRecords.length === 0) {
      toast.error("No records available to export.");
      return;
    }

    try {
      let csvContent = "Type,Activity Date,Farmer Owner,Cow/Tag ID,Breed,Status,Details\n";

      filteredRecords.forEach((item) => {
        let typeStr = "";
        switch (item.type) {
          case 'insemination': typeStr = "AI Insemination"; break;
          case 'pregnancy': typeStr = "Pregnancy Check"; break;
          case 'calving': typeStr = "Calf Drop"; break;
          case 'ai-request': typeStr = "AI Request Visit"; break;
          case 'health-request': typeStr = "Health Check"; break;
        }

        const dateRaw = getDisplayDate(item);
        const dateStr = dateRaw ? new Date(dateRaw).toLocaleDateString() : "N/A";
        const farmerName = item.farmerId?.name || "Unknown";
        const animalTag = item.animalId?.earTag || item.animalId?.animalId || "No Tag";
        const breed = item.animalId?.breed || "Unknown";
        const status = item.status || "COMPLETED";

        let details = "";
        if (item.type === 'insemination') {
          details = `Attempt #${item.attemptNumber || 1} - Sire: ${item.sireCode || 'N/A'}`;
        } else if (item.type === 'health-request') {
          details = item.technicianNote || item.remarks || "No notes";
        } else if (item.type === 'pregnancy') {
          details = `PD Result: ${item.pregnancyDiagnosis?.result || 'Pending'}`;
        } else if (item.type === 'calving') {
          details = `Ease: ${item.calvingEase || 'Natural'}`;
        }

        // Clean values to prevent CSV issues
        const cleanFarmer = farmerName.replace(/"/g, '""');
        const cleanDetails = details.replace(/"/g, '""');

        csvContent += `"${typeStr}","${dateStr}","${cleanFarmer}","${animalTag}","${breed}","${status}","${cleanDetails}"\n`;
      });

      const fileUri = (FileSystem as any).documentDirectory + `service_ledger_export_${Date.now()}.csv`;
      await (FileSystem as any).writeAsStringAsync(fileUri, csvContent, { encoding: (FileSystem as any).EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Service Ledger CSV',
          UTI: 'public.comma-separated-values-text'
        });
        toast.success("CSV Ledger Exported!");
      } else {
        toast.error("Sharing interface is unavailable");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate CSV export");
    }
  };

  const clearDateRange = () => {
    setStartDate(null);
    setEndDate(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="light-content" />

      {/* Premium Header */}
      <View style={{ backgroundColor: PRIMARY, paddingBottom: 50, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingHorizontal: 24, paddingTop: insets.top + 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
               <ClipboardList size={20} color="#fff" />
            </View>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 24 }}>Service Ledger</Text>
          </View>

          {/* Export to CSV and Calendar Filter Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              onPress={handleExportCSV}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
            >
               <Download size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setShowCalendarModal(true)}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: startDate || endDate ? '#eab308' : 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
            >
               <Calendar size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 48, height: 48 }}>
            <Image 
              source={{ uri: 'https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png' }} 
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_800ExtraBold', fontSize: 13 }}>Moowie Archivist</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'Outfit_500Medium', fontSize: 11, lineHeight: 15 }}>
               Keep track of all Artificial Inseminations, Health checks, and Pregnancy records! 📚
            </Text>
          </View>
        </View>
      </View>

      {/* Main Ledger Content */}
      <View style={{ 
          flex: 1, 
          marginTop: -30, 
          backgroundColor: '#f8fafc', 
          borderTopLeftRadius: 40, 
          borderTopRightRadius: 40,
          overflow: 'hidden'
      }}>
        
        {/* Search Bar */}
        <View style={{ paddingHorizontal: 20, paddingTop: 25 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: '#f1f5f9' }}>
             <Search size={18} color="#94a3b8" style={{ marginLeft: 8 }} />
             <TextInput 
               placeholder="Search by Farmer, Animal Ear Tag, Status..."
               placeholderTextColor="#94a3b8"
               style={{ flex: 1, marginLeft: 12, fontFamily: 'Outfit_600SemiBold', color: '#1e293b', fontSize: 13 }}
               value={searchQuery}
               onChangeText={setSearchQuery}
             />
             {searchQuery.length > 0 && (
               <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
                 <X size={16} color="#94a3b8" />
               </TouchableOpacity>
             )}
          </View>
        </View>

        {/* Date Filter Active indicator */}
        {(startDate || endDate) && (
          <View style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: '#fef9c3', borderStyle: 'solid', borderWidth: 1, borderColor: '#fef08a', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
               <Calendar size={14} color="#a16207" />
               <Text style={{ fontSize: 11, fontFamily: 'Outfit_700Bold', color: '#a16207' }}>
                 Range: {startDate ? startDate.toLocaleDateString() : '...'} - {endDate ? endDate.toLocaleDateString() : '...'}
               </Text>
            </View>
            <TouchableOpacity onPress={clearDateRange} style={{ padding: 2 }}>
               <X size={14} color="#a16207" />
            </TouchableOpacity>
          </View>
        )}

        {/* Filter Chip Row */}
        <View style={{ paddingHorizontal: 20, marginVertical: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
            {(['All', 'AI', 'Pregnancy', 'Calving', 'Health'] as FilterType[]).map((filter) => {
              const isActive = selectedFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  onPress={() => setSelectedFilter(filter)}
                  style={{
                    backgroundColor: isActive ? PRIMARY : '#fff',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isActive ? PRIMARY : '#e2e8f0'
                  }}
                >
                  <Text style={{ 
                    color: isActive ? '#fff' : '#64748b',
                    fontFamily: 'Outfit_700Bold',
                    fontSize: 12
                  }}>
                    {filter === 'AI' ? 'A.I.' : filter === 'Health' ? 'Health Logs' : filter}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Ledger Counter Badge */}
        <View style={{ paddingHorizontal: 20, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
           <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Showing {filteredRecords.length} of {allRecords.length} records
           </Text>
           {filteredRecords.length > 0 && (
             <TouchableOpacity onPress={handleExportCSV} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Download size={12} color={PRIMARY} />
                <Text style={{ fontFamily: 'Outfit_700Bold', color: PRIMARY, fontSize: 11 }}>Export CSV</Text>
             </TouchableOpacity>
           )}
        </View>

        {/* Timeline List */}
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} />}
        >
           {loading && !refreshing ? (
             <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
           ) : filteredRecords.length === 0 ? (
             <View style={{ marginTop: 60, alignItems: 'center' }}>
                <MaterialCommunityIcons name="clipboard-text-off-outline" size={64} color="#cbd5e1" />
                <Text style={{ fontFamily: 'Outfit_700Bold', color: '#94a3b8', marginTop: 16 }}>No records matching search or filter</Text>
             </View>
            ) : filteredRecords.map((item, idx) => (
              <RecordCard 
                key={`${item.type}-${item._id || idx}`} 
                item={item} 
                onPress={() => openDetails(item)}
              />
           ))}
        </ScrollView>
      </View>

      {/* Quick Details Modal */}
      <DetailsModal 
        visible={detailsVisible} 
        item={selectedItem} 
        onClose={() => setDetailsVisible(false)} 
        onDelete={handleDelete}
        isDeleting={deleteMutation.isPending}
        router={router}
      />

      {/* Date Range Selector Calendar Modal */}
      <CalendarFilterModal
        visible={showCalendarModal}
        startDate={startDate}
        endDate={endDate}
        onClose={() => setShowCalendarModal(false)}
        onSelectStart={(date: Date) => setStartDate(date)}
        onSelectEnd={(date: Date) => setEndDate(date)}
        onClear={clearDateRange}
        showStartPicker={showStartPicker}
        showEndPicker={showEndPicker}
        setShowStartPicker={setShowStartPicker}
        setShowEndPicker={setShowEndPicker}
      />
    </View>
  );
};

const RecordCard = ({ item, onPress }: any) => {
  let title = "";
  let icon = "clipboard-text";
  let color = PRIMARY;
  let bg = "#ecfdf5";
  
  switch(item.type) {
    case 'insemination': title = `AI Insemination #${item.attemptNumber || 1}`; icon = "needle"; break;
    case 'pregnancy': title = "Pregnancy Check"; icon = "heart-pulse"; color = "#2563EB"; bg = "#eff6ff"; break;
    case 'calving': title = "Calf Drop"; icon = "baby-carriage"; color = "#D97706"; bg = "#fffbeb"; break;
    case 'ai-request': title = "AI Request Visit"; icon = "bullseye-arrow"; break;
    case 'health-request': title = "Health Check / Visit"; icon = "medical-bag"; color = "#ef4444"; bg = "#fef2f2"; break;
  }

  const dateRaw = getDisplayDate(item);
  const date = dateRaw ? new Date(dateRaw).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

  return (
    <TouchableOpacity 
      activeOpacity={0.8}
      onPress={onPress}
      style={{ backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10, elevation: 1, borderWidth: 1, borderColor: '#f1f5f9' }}
    >
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name={icon as any} size={26} color={color} />
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontFamily: 'Outfit_700Bold', color: '#1e293b' }}>{title}</Text>
              <Text style={{ fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: '#94a3b8' }}>{date}</Text>
          </View>
          <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: '#64748b', marginTop: 2 }}>
              Farmer: {item.farmerId?.name || 'Unknown'} · Cow: {item.animalId?.earTag || item.animalId?.animalId || 'No Tag'}
          </Text>
          <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.status === 'pending' ? '#f59e0b' : item.status === 'in-progress' ? '#2563EB' : '#10b981' }} />
              <Text style={{ fontSize: 9, fontFamily: 'Outfit_800ExtraBold', color: '#94a3b8', textTransform: 'uppercase' }}>{item.status || 'COMPLETED'}</Text>
          </View>
        </View>
        <ChevronRight size={18} color="#cbd5e1" />
    </TouchableOpacity>
  );
};

const CalendarFilterModal = ({ visible, startDate, endDate, onClose, onSelectStart, onSelectEnd, onClear, showStartPicker, showEndPicker, setShowStartPicker, setShowEndPicker }: any) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={{ borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, backgroundColor: '#fff' }}>
          
          <View style={{ width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontFamily: 'Outfit_900Black', color: '#1e293b' }}>Filter by Date Range</Text>
            <TouchableOpacity onPress={onClose}>
               <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 16, marginBottom: 24 }}>
             {/* Start Date */}
             <View>
                <Text style={{ fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: '#64748b', textTransform: 'uppercase', marginBottom: 6, marginLeft: 2 }}>Start Date</Text>
                <TouchableOpacity 
                  onPress={() => setShowStartPicker(true)}
                  style={{ backgroundColor: '#f8fafc', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                   <Text style={{ fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: startDate ? '#1e293b' : '#94a3b8' }}>
                      {startDate ? startDate.toLocaleDateString() : 'Select start date'}
                   </Text>
                   <Calendar size={18} color={PRIMARY} />
                </TouchableOpacity>
             </View>

             {/* End Date */}
             <View>
                <Text style={{ fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: '#64748b', textTransform: 'uppercase', marginBottom: 6, marginLeft: 2 }}>End Date</Text>
                <TouchableOpacity 
                  onPress={() => setShowEndPicker(true)}
                  style={{ backgroundColor: '#f8fafc', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                   <Text style={{ fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: endDate ? '#1e293b' : '#94a3b8' }}>
                      {endDate ? endDate.toLocaleDateString() : 'Select end date'}
                   </Text>
                   <Calendar size={18} color={PRIMARY} />
                </TouchableOpacity>
             </View>
          </View>

          {/* Date Picker Triggers */}
          {showStartPicker && (
            <DateTimePicker
              value={startDate || new Date()}
              mode="date"
              display="default"
              onChange={(e, date) => {
                setShowStartPicker(false);
                if (date) onSelectStart(date);
              }}
            />
          )}

          {showEndPicker && (
            <DateTimePicker
              value={endDate || new Date()}
              mode="date"
              display="default"
              onChange={(e, date) => {
                setShowEndPicker(false);
                if (date) onSelectEnd(date);
              }}
            />
          )}

          <View style={{ flexDirection: 'row', gap: 12 }}>
             <TouchableOpacity 
                onPress={() => {
                  onClear();
                  onClose();
                }}
                style={{ flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
             >
                <Text style={{ color: '#64748b', fontFamily: 'Outfit_800ExtraBold', fontSize: 15 }}>Clear Filters</Text>
             </TouchableOpacity>

             <TouchableOpacity 
                onPress={onClose}
                style={{ flex: 1, backgroundColor: PRIMARY, paddingVertical: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
             >
                <Text style={{ color: '#fff', fontFamily: 'Outfit_800ExtraBold', fontSize: 15 }}>Apply Range</Text>
             </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

const DetailsModal = ({ visible, item, onClose, onDelete, isDeleting, router }: any) => {
  if (!item) return null;

  const farmer = item.farmerId || {};
  const animal = item.animalId || {};
  
  const dateRaw = getDisplayDate(item);
  const date = dateRaw ? new Date(dateRaw).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A';
  const time = dateRaw ? new Date(dateRaw).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A';

  const address = farmer.address 
    ? [farmer.address.street, farmer.address.barangay, farmer.address.city].filter(Boolean).join(', ') 
    : 'No address provided';

  const handleCall = () => {
    const phone = farmer.address?.phoneNumber || farmer.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const status = item.status?.toUpperCase() || 'COMPLETED';
  const statusColor = item.status === 'pending' ? '#f59e0b' : item.status === 'rejected' ? '#ef4444' : '#10b981';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 }}>
          
          <View style={{ width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <View style={{ flex: 1 }}>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Outfit_900Black', color: PRIMARY, textTransform: 'uppercase', letterSpacing: 1 }}>RECORD DETAILS</Text>
                  <View style={{ backgroundColor: `${statusColor}20`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Outfit_800ExtraBold', color: statusColor }}>{status}</Text>
                  </View>
               </View>
               <Text style={{ fontSize: 24, fontFamily: 'Outfit_900Black', color: '#1e293b' }}>
                  {item.type === 'insemination' ? 'AI Insemination' : item.type === 'health-request' ? 'Health Log / Visit' : item.type === 'pregnancy' ? 'Pregnancy Check' : item.type === 'calving' ? 'Calf Drop' : 'Medical Record'}
               </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
               <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={{ backgroundColor: '#f8fafc', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#f1f5f9' }}>
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                 <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#ecfdf5', overflow: 'hidden' }}>
                    {(farmer.imageUrl || farmer.photoUrl || farmer.image) ? (
                       <Image source={{ uri: farmer.imageUrl || farmer.photoUrl || farmer.image }} style={{ width: 60, height: 60 }} />
                    ) : (
                       <Text style={{ fontSize: 24, fontFamily: 'Outfit_900Black', color: PRIMARY }}>{farmer.name?.charAt(0) || '?'}</Text>
                    )}
                 </View>
                <View style={{ flex: 1 }}>
                   <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: '#1e293b' }}>{farmer.name || 'Unknown Farmer'}</Text>
                   <Text style={{ fontSize: 12, fontFamily: 'Outfit_600SemiBold', color: '#64748b' }}>Farmer Owner</Text>
                </View>
                <TouchableOpacity onPress={handleCall} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' }}>
                   <Phone size={20} color="#fff" />
                </TouchableOpacity>
             </View>

             <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 16 }} />

             <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                   <MapPin size={16} color={PRIMARY} />
                   <Text style={{ fontSize: 14, fontFamily: 'Outfit_500Medium', color: '#475569', flex: 1 }}>{address}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                   <Calendar size={16} color={PRIMARY} />
                   <Text style={{ fontSize: 14, fontFamily: 'Outfit_500Medium', color: '#475569' }}>{date}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                   <Clock size={16} color={PRIMARY} />
                   <Text style={{ fontSize: 14, fontFamily: 'Outfit_500Medium', color: '#475569' }}>{time}</Text>
                </View>
                
                {/* Specific Record Technical Details */}
                <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 4 }} />
                
                {item.type === 'insemination' && (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#94a3b8', fontFamily: 'Outfit_700Bold', fontSize: 10, textTransform: 'uppercase' }}>Attempt No.</Text>
                      <Text style={{ color: '#334155', fontFamily: 'Outfit_900Black', fontSize: 12 }}>#{item.attemptNumber || 1}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#94a3b8', fontFamily: 'Outfit_700Bold', fontSize: 10, textTransform: 'uppercase' }}>Sire Code</Text>
                      <Text style={{ color: '#334155', fontFamily: 'Outfit_900Black', fontSize: 12 }}>{item.sireCode || 'N/A'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#94a3b8', fontFamily: 'Outfit_700Bold', fontSize: 10, textTransform: 'uppercase' }}>Pregnancy Status</Text>
                      <Text style={{ color: item.pregnancyStatus === 'Pregnant' ? '#10b981' : '#64748b', fontFamily: 'Outfit_900Black', fontSize: 12 }}>{item.pregnancyStatus || 'Pending'}</Text>
                    </View>
                  </View>
                )}

                {item.type === 'health-request' && (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#94a3b8', fontFamily: 'Outfit_700Bold', fontSize: 10, textTransform: 'uppercase' }}>Type of Service</Text>
                      <Text style={{ color: '#334155', fontFamily: 'Outfit_900Black', fontSize: 12 }}>{item.typeOfService || 'Medical Check'}</Text>
                    </View>
                    {item.details?.medicineName && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#94a3b8', fontFamily: 'Outfit_700Bold', fontSize: 10, textTransform: 'uppercase' }}>Medicine</Text>
                        <Text style={{ color: '#047857', fontFamily: 'Outfit_900Black', fontSize: 12 }}>{item.details.medicineName}</Text>
                      </View>
                    )}
                  </View>
                )}

                {(item.note || item.technicianNote || item.remarks) && (
                  <View style={{ marginTop: 8, backgroundColor: 'rgba(226, 232, 240, 0.5)', padding: 12, borderRadius: 12, borderStyle: 'solid', borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.5)' }}>
                    <Text style={{ color: '#94a3b8', fontFamily: 'Outfit_900Black', fontSize: 8, textTransform: 'uppercase', marginBottom: 4 }}>Remarks / Notes</Text>
                    <Text style={{ color: '#475569', fontFamily: 'Outfit_500Medium', fontSize: 12, fontStyle: 'italic' }}>
                      "{item.note || item.technicianNote || item.remarks}"
                    </Text>
                  </View>
                )}
             </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24, paddingHorizontal: 4 }}>
             <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="cow" size={24} color="#3b82f6" />
             </View>
             <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Outfit_700Bold', color: '#1e293b' }}>Target: {animal.earTag || animal.animalId || 'No Tag'}</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: '#64748b' }}>{animal.breed || 'Unknown'} · {animal.species || 'Unknown'}</Text>
             </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
             <TouchableOpacity 
                onPress={() => {
                  onClose();
                  router.push(`/(technician)/animal-details?id=${animal._id || animal.id}`);
                }}
                style={{ flex: 3, backgroundColor: PRIMARY, paddingVertical: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}
              >
                <Text style={{ color: '#fff', fontFamily: 'Outfit_800ExtraBold', fontSize: 15 }}>View Profile</Text>
                <ChevronRight size={18} color="#fff" />
             </TouchableOpacity>

             <TouchableOpacity 
                onPress={() => onDelete(item)}
                disabled={isDeleting}
                style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fecaca' }}
             >
                {isDeleting ? <ActivityIndicator size="small" color="#ef4444" /> : <Trash2 size={22} color="#ef4444" />}
             </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

export default ServiceLedger;
