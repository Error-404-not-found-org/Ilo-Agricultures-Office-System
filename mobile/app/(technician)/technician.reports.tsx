import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, StatusBar, Image, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Printer, ChevronRight, ChevronLeft, Download, Filter, X } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { useAuth } from '@clerk/clerk-expo';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { generatePDF, generateExcel, ReportRow } from '@/lib/reportExporter';
import { toast } from 'sonner-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';

const PRIMARY = '#00643B';

const DetailRow = ({ label, value, highlightColor }: { label: string, value?: string, highlightColor?: string }) => {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 13, fontFamily: 'Outfit_700Bold', color: highlightColor || colors.textPrimary, textTransform: 'capitalize', textAlign: 'right', flex: 1, marginLeft: 16 }}>
        {value || '—'}
      </Text>
    </View>
  );
};

export default function TechnicianReportsScreen() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  const { colors, isDark } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'monthly' | 'weekly'>('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportRow[]>([]);

  // ---- SEARCH & FILTER STATES ----
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | 'AI' | 'PD' | 'CD' | 'HL'>('ALL');
  const [selectedBarangay, setSelectedBarangay] = useState<string>('ALL');

  // Temp filter states for modal
  const [tempSearchQuery, setTempSearchQuery] = useState('');
  const [tempSelectedType, setTempSelectedType] = useState<'ALL' | 'AI' | 'PD' | 'CD' | 'HL'>('ALL');
  const [tempSelectedBarangay, setTempSelectedBarangay] = useState<string>('ALL');

  // Detail Modal States
  const [selectedRow, setSelectedRow] = useState<ReportRow | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const getFullAddress = (farmer: any) => {
    if (!farmer?.address) return '—';
    if (typeof farmer.address === 'string') return farmer.address;
    const { street, barangay, city } = farmer.address;
    return [street, barangay, city].filter(Boolean).join(', ') || '—';
  };

  const fetchReportData = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    setLoading(true);
    try {
      const start = activeTab === 'monthly' ? startOfMonth(selectedDate) : startOfWeek(selectedDate);
      const end = activeTab === 'monthly' ? endOfMonth(selectedDate) : endOfWeek(selectedDate);

      const [insRes, pregRes, calvRes, healthRes] = await Promise.all([
        api.get('/technician/inseminations?limit=1000'),
        api.get('/technician/pregnancy-checks?limit=1000'),
        api.get('/technician/calvings?limit=1000'),
        api.get('/health-request')
      ]);

      const allEvents: ReportRow[] = [];

      (insRes.data?.inseminations || []).forEach((ins: any) => {
        const date = new Date(ins.inseminationDate || ins.createdAt);
        if (date >= start && date <= end) {
          allEvents.push({
            type: 'AI',
            animalId: ins.animalId?.animalId || '—',
            earTag: ins.animalId?.earTag || '—',
            brand: ins.animalId?.brand || '—',
            species: ins.animalId?.species || '—',
            breed: ins.animalId?.breed || '—',
            color: ins.animalId?.color || '—',
            address: getFullAddress(ins.farmerId),
            farmer: ins.farmerId?.name || '—',
            barangay: ins.farmerId?.address?.barangay || '—',
            date: format(date, 'MM/dd/yyyy'),
            noOfAi: ins.attemptNumber,
            estrus: ins.estrus || 'NH',
            sireBreed: ins.sireBreed || '—',
            sireCode: ins.sireCode || '—',
          });
        }
      });

      (pregRes.data?.data || []).forEach((preg: any) => {
        const date = new Date(preg.checkDate || preg.createdAt);
        if (date >= start && date <= end) {
          allEvents.push({
            type: 'PD',
            animalId: preg.animalId?.animalId || '—',
            earTag: preg.animalId?.earTag || '—',
            brand: preg.animalId?.brand || '—',
            species: preg.animalId?.species || '—',
            breed: preg.animalId?.breed || '—',
            color: preg.animalId?.color || '—',
            address: getFullAddress(preg.farmerId),
            farmer: preg.farmerId?.name || '—',
            barangay: preg.farmerId?.address?.barangay || '—',
            date: format(date, 'MM/dd/yyyy'),
            pdDate: format(date, 'MM/dd/yyyy'),
            pdResult: preg.pregnancyDiagnosis?.result || '—',
          });
        }
      });

      (calvRes.data?.data || []).forEach((calv: any) => {
        const date = new Date(calv.date || calv.createdAt);
        if (date >= start && date <= end) {
          allEvents.push({
            type: 'CD',
            animalId: calv.animalId?.animalId || '—',
            earTag: calv.animalId?.earTag || '—',
            brand: calv.animalId?.brand || '—',
            species: calv.animalId?.species || '—',
            breed: calv.animalId?.breed || '—',
            color: calv.animalId?.color || '—',
            address: getFullAddress(calv.farmerId),
            farmer: calv.farmerId?.name || '—',
            barangay: calv.farmerId?.address?.barangay || '—',
            date: format(date, 'MM/dd/yyyy'),
            cdDate: format(date, 'MM/dd/yyyy'),
            cdNum: calv.numberOfCalves,
            cdSex: calv.sexOfCalf,
            cdEase: calv.calvingEase,
          });
        }
      });

      (Array.isArray(healthRes.data) ? healthRes.data : []).forEach((health: any) => {
        const date = new Date(health.createdAt);
        if (date >= start && date <= end) {
          allEvents.push({
            type: 'HL',
            animalId: health.animalId?.animalId || '—',
            earTag: health.animalId?.earTag || '—',
            brand: health.animalId?.brand || '—',
            species: health.animalId?.species || '—',
            breed: health.animalId?.breed || '—',
            color: health.animalId?.color || '—',
            address: getFullAddress(health.farmerId),
            farmer: health.farmerId?.name || '—',
            barangay: health.farmerId?.address?.barangay || '—',
            date: format(date, 'MM/dd/yyyy'),
            sireBreed: health.issue || 'Check-up', 
            sireCode: health.status?.toUpperCase() || 'COMPLETED'
          });
        }
      });

      setReportData(allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error("Report sync error:", error);
      toast.error("Failed to sync records");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, activeTab, isLoaded, isSignedIn, api]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const changeDate = (direction: number) => {
    const newDate = new Date(selectedDate);
    if (activeTab === 'monthly') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else {
      newDate.setDate(newDate.getDate() + (direction * 7));
    }
    setSelectedDate(newDate);
  };

  const filteredReportData = reportData.filter((row) => {
    // 1. Keyword search
    if (searchQuery) {
      const match = [row.animalId, row.earTag, row.breed, row.farmer, row.sireCode, row.pdResult, row.sireBreed]
        .join(' ')
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      if (!match) return false;
    }

    // 2. Event type filter
    if (selectedType !== 'ALL' && row.type !== selectedType) {
      return false;
    }

    // 3. Barangay filter
    if (selectedBarangay !== 'ALL' && row.barangay?.toLowerCase() !== selectedBarangay.toLowerCase()) {
      return false;
    }

    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      
      {/* Fixed Header */}
      <View style={{ backgroundColor: isDark ? "#064e3e" : "#00643B", paddingBottom: 50, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingHorizontal: 24, paddingTop: insets.top + 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
               <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 24 }}>Field Reports</Text>
          </View>
          <TouchableOpacity 
            onPress={() => {
              setTempSearchQuery(searchQuery);
              setTempSelectedType(selectedType);
              setTempSelectedBarangay(selectedBarangay);
              setFilterModalOpen(true);
            }} 
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
          >
             <Filter size={18} color="#fff" />
             {(selectedType !== 'ALL' || selectedBarangay !== 'ALL' || searchQuery !== '') && (
               <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
             )}
          </TouchableOpacity>
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
            <Text style={{ color: '#fff', fontFamily: 'Outfit_800ExtraBold', fontSize: 13 }}>Moowie Auditor</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'Outfit_600SemiBold', fontSize: 11, lineHeight: 15 }}>
              Audited {filteredReportData.length} records. Your data is fully synchronized!
            </Text>
          </View>
        </View>
      </View>

      {/* CLIPPED CONTENT CONTAINER: Background color and overflow: hidden fix the overlap issue */}
      <View style={{ 
          flex: 1, 
          marginTop: -30, 
          backgroundColor: colors.background, 
          borderTopLeftRadius: 40, 
          borderTopRightRadius: 40,
          overflow: 'hidden'
      }}>
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 30, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchReportData} tintColor={isDark ? colors.primary : PRIMARY} />}
        >
           {/* Period Selector Card */}
           <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderRadius: 16, padding: 4, marginBottom: 16 }}>
                 <TouchableOpacity onPress={() => setActiveTab('monthly')} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: activeTab === 'monthly' ? (isDark ? colors.primary : '#00643B') : 'transparent' }}>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: activeTab === 'monthly' ? '#fff' : colors.textSecondary }}>Monthly</Text>
                 </TouchableOpacity>
                 <TouchableOpacity onPress={() => setActiveTab('weekly')} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: activeTab === 'weekly' ? (isDark ? colors.primary : '#00643B') : 'transparent' }}>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: activeTab === 'weekly' ? '#fff' : colors.textSecondary }}>Weekly</Text>
                 </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                 <TouchableOpacity onPress={() => changeDate(-1)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronLeft size={20} color={isDark ? colors.primary : PRIMARY} />
                 </TouchableOpacity>
                 <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontFamily: 'Outfit_900Black', color: colors.textPrimary }}>
                       {activeTab === 'monthly' ? format(selectedDate, 'MMMM yyyy') : `${format(startOfWeek(selectedDate), 'MMM d')} - ${format(endOfWeek(selectedDate), 'MMM d')}`}
                    </Text>
                 </View>
                 <TouchableOpacity onPress={() => changeDate(1)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronRight size={20} color={isDark ? colors.primary : PRIMARY} />
                 </TouchableOpacity>
              </View>
           </View>               

           {/* Metric Summary Chips */}
           <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 70, backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5', borderRadius: 16, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: isDark ? 'rgba(16,185,129,0.1)' : '#d1fae5', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 }}>
                 <Text style={{ fontFamily: 'Outfit_900Black', color: isDark ? colors.primary : '#059669', fontSize: 16 }}>{filteredReportData.filter((r) => r.type === 'AI').length}</Text>
                 <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>AI</Text>
              </View>
              <View style={{ flex: 1, minWidth: 70, backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff', borderRadius: 16, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: isDark ? 'rgba(37,99,235,0.1)' : '#dbeafe', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 }}>
                 <Text style={{ fontFamily: 'Outfit_900Black', color: '#2563EB', fontSize: 16 }}>{filteredReportData.filter((r) => r.type === 'PD').length}</Text>
                 <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>PD</Text>
              </View>
              <View style={{ flex: 1, minWidth: 70, backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#fffbeb', borderRadius: 16, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: isDark ? 'rgba(217,119,6,0.1)' : '#fef3c7', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 }}>
                 <Text style={{ fontFamily: 'Outfit_900Black', color: '#D97706', fontSize: 16 }}>{filteredReportData.filter((r) => r.type === 'CD').length}</Text>
                 <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>CD</Text>
              </View>
              <View style={{ flex: 1, minWidth: 70, backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2', borderRadius: 16, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 }}>
                 <Text style={{ fontFamily: 'Outfit_900Black', color: '#ef4444', fontSize: 16 }}>{filteredReportData.filter((r) => r.type === 'HL').length}</Text>
                 <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>HL</Text>
              </View>
           </View>
           
           {/* Export Actions */}
           <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
              <TouchableOpacity onPress={() => generatePDF(filteredReportData, format(selectedDate, 'MMMM'), format(selectedDate, 'yyyy'))} style={{ flex: 1, backgroundColor: colors.card, borderRadius: 20, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.border }}>
                 <Printer size={18} color={isDark ? colors.primary : PRIMARY} />
                 <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textPrimary, fontSize: 13 }}>PDF Report</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => generateExcel(filteredReportData, `Report_${format(selectedDate, 'MMM_yyyy')}`)} style={{ flex: 1, backgroundColor: colors.card, borderRadius: 20, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.border }}>
                 <Download size={18} color={isDark ? colors.primary : "#2563EB"} />
                 <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textPrimary, fontSize: 13 }}>Excel Sheet</Text>
              </TouchableOpacity>
           </View>

           {/* Record List */}
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary, fontSize: 18 }}>Activity Records</Text>
              <View style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                 <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: isDark ? colors.primary : '#059669', fontSize: 10 }}>{filteredReportData.length} TOTAL</Text>
              </View>
           </View>

           {loading && filteredReportData.length === 0 ? (
              <ActivityIndicator color={isDark ? colors.primary : PRIMARY} style={{ marginTop: 40 }} />
           ) : filteredReportData.length === 0 ? (
              <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 48, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                  <MaterialCommunityIcons name="file-search-outline" size={60} color={colors.textMuted} />
                  <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary, marginTop: 16 }}>No records found</Text>
              </View>
           ) : (
              filteredReportData.map((row, idx) => (
                 <TouchableOpacity 
                    key={idx} 
                    onPress={() => {
                       setSelectedRow(row);
                       setDetailModalOpen(true);
                    }}
                    style={{ backgroundColor: colors.card, borderRadius: 24, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: colors.border }}
                 >
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: row.type === 'AI' ? (isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5') : row.type === 'PD' ? (isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff') : row.type === 'HL' ? (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2') : (isDark ? 'rgba(217,119,6,0.15)' : '#fffbeb'), alignItems: 'center', justifyContent: 'center' }}>
                       <Text style={{ fontFamily: 'Outfit_900Black', color: row.type === 'AI' ? (isDark ? colors.primary : '#059669') : row.type === 'PD' ? '#2563EB' : row.type === 'HL' ? '#ef4444' : '#D97706', fontSize: 14 }}>{row.type}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                       <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 15, fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>{row.animalId}</Text>
                          <Text style={{ fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: colors.textMuted }}>{row.date}</Text>
                       </View>
                       <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                          {row.farmer} · {row.address}
                       </Text>
                       <View style={{ marginTop: 6, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: colors.background, alignSelf: 'flex-start', borderRadius: 6 }}>
                          <Text style={{ fontSize: 9, fontFamily: 'Outfit_800ExtraBold', color: colors.textSecondary, textTransform: 'uppercase' }}>
                             {row.type === 'AI' ? `Sire: ${row.sireCode} (${row.breed})` : 
                              row.type === 'PD' ? `Result: ${row.pdResult}` : 
                              row.type === 'HL' ? `Health: ${row.sireBreed}` :
                              `Calf Drop: ${row.cdNum} (${row.cdEase})`}
                          </Text>
                       </View>
                    </View>
                 </TouchableOpacity>
              ))
           )}
        </ScrollView>
      </View>

      {/* Search & Filter Modal */}
      <Modal
        visible={filterModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: colors.card, 
            borderTopLeftRadius: 30, 
            borderTopRightRadius: 30, 
            padding: 24, 
            maxHeight: '80%', 
            borderWidth: 1, 
            borderColor: colors.border 
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary, fontSize: 18 }}>Filter Accomplishments</Text>
              <TouchableOpacity onPress={() => setFilterModalOpen(false)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Keyword Search */}
            <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Keyword Search</Text>
            <TextInput
              value={tempSearchQuery}
              onChangeText={setTempSearchQuery}
              placeholder="Search farmer name, ear tag, breed..."
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.background,
                color: colors.textPrimary,
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                fontFamily: 'Outfit_500Medium',
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 20,
              }}
            />

            {/* Event Type */}
            <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Event Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {(['ALL', 'AI', 'PD', 'CD', 'HL'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setTempSelectedType(type)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    backgroundColor: tempSelectedType === type ? (isDark ? colors.primary : '#00643B') : colors.background,
                    borderWidth: 1,
                    borderColor: tempSelectedType === type ? 'transparent' : colors.border,
                  }}
                >
                  <Text style={{
                    fontFamily: 'Outfit_700Bold',
                    fontSize: 12,
                    color: tempSelectedType === type ? '#fff' : colors.textSecondary,
                  }}>
                    {type === 'ALL' ? 'All Events' : type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Barangay */}
            <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Geographic Barangay</Text>
            <ScrollView style={{ maxHeight: 150, marginBottom: 24 }} showsVerticalScrollIndicator={true}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {['ALL', 'San Miguel', 'Santa Barbara', 'Pavia', 'Oton', 'Mandurriao', 'General Luna'].map((brgy) => (
                  <TouchableOpacity
                    key={brgy}
                    onPress={() => setTempSelectedBarangay(brgy)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: tempSelectedBarangay === brgy ? (isDark ? colors.primary : '#00643B') : colors.background,
                      borderWidth: 1,
                      borderColor: tempSelectedBarangay === brgy ? 'transparent' : colors.border,
                    }}
                  >
                    <Text style={{
                      fontFamily: 'Outfit_700Bold',
                      fontSize: 11,
                      color: tempSelectedBarangay === brgy ? '#fff' : colors.textSecondary,
                    }}>
                      {brgy === 'ALL' ? 'All Barangays' : brgy}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSelectedType('ALL');
                  setSelectedBarangay('ALL');
                  setFilterModalOpen(false);
                  toast.success('Filters reset');
                }}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: colors.background,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary, fontSize: 14 }}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery(tempSearchQuery);
                  setSelectedType(tempSelectedType);
                  setSelectedBarangay(tempSelectedBarangay);
                  setFilterModalOpen(false);
                  toast.success('Filters applied');
                }}
                style={{
                  flex: 2,
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: isDark ? colors.primary : '#00643B',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontFamily: 'Outfit_700Bold', color: '#fff', fontSize: 14 }}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Detailed Accomplishment Modal */}
      <Modal
        visible={detailModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ 
            backgroundColor: colors.card, 
            borderRadius: 28, 
            width: '100%', 
            maxHeight: '80%', 
            borderWidth: 1, 
            borderColor: colors.border,
            shadowColor: '#000', 
            shadowOffset: { width: 0, height: 10 }, 
            shadowOpacity: 0.25, 
            shadowRadius: 15, 
            elevation: 8, 
            overflow: 'hidden' 
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="information-outline" size={20} color={isDark ? colors.primary : '#00643B'} />
                <Text style={{ fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>Record Details</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModalOpen(false)} style={{ padding: 4 }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <ScrollView contentContainerStyle={{ padding: 24 }}>
              {selectedRow && (
                <View style={{ gap: 20 }}>
                  
                  {/* Category Indicator Header */}
                  <View style={{ alignItems: 'center', gap: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <View style={{ 
                      width: 56, 
                      height: 56, 
                      borderRadius: 18, 
                      backgroundColor: selectedRow.type === 'AI' 
                        ? (isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5') 
                        : selectedRow.type === 'PD' 
                          ? (isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff') 
                          : selectedRow.type === 'HL' 
                            ? (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2') 
                            : (isDark ? 'rgba(217,119,6,0.15)' : '#fffbeb'), 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      <Text style={{ 
                        fontFamily: 'Outfit_900Black', 
                        color: selectedRow.type === 'AI' 
                          ? (isDark ? colors.primary : '#059669') 
                          : selectedRow.type === 'PD' 
                            ? '#2563EB' 
                            : selectedRow.type === 'HL' 
                              ? '#ef4444' 
                              : '#D97706', 
                        fontSize: 18 
                      }}>
                        {selectedRow.type}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary, textAlign: 'center' }}>
                      {selectedRow.type === 'AI' ? 'Artificial Insemination' : 
                       selectedRow.type === 'PD' ? 'Pregnancy Diagnosis' : 
                       selectedRow.type === 'CD' ? 'Calving Drop Event' : 'Clinical Health Check'}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Outfit_700Bold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {selectedRow.date}
                    </Text>
                  </View>

                  {/* Animal & Farmer Info */}
                  <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
                    <View>
                      <Text style={{ fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: colors.textMuted, textTransform: 'uppercase' }}>Subject Animal</Text>
                      <Text style={{ fontSize: 14, fontFamily: 'Outfit_700Bold', color: colors.textPrimary, marginTop: 2 }}>Tag: #{selectedRow.earTag} ({selectedRow.animalId})</Text>
                      <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textSecondary, marginTop: 1 }}>{selectedRow.breed} • {selectedRow.species} • {selectedRow.color}</Text>
                    </View>
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 }}>
                      <Text style={{ fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: colors.textMuted, textTransform: 'uppercase' }}>Client / Location</Text>
                      <Text style={{ fontSize: 13, fontFamily: 'Outfit_700Bold', color: colors.textPrimary, marginTop: 2 }}>{selectedRow.farmer}</Text>
                      <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textSecondary, marginTop: 1 }}>{selectedRow.address}</Text>
                    </View>
                  </View>

                  {/* Accomplishment Details */}
                  <View style={{ gap: 12 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Outfit_800ExtraBold', color: colors.textMuted, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 4 }}>Service Metrics</Text>
                    
                    {selectedRow.type === 'AI' && (
                      <View style={{ gap: 10 }}>
                        <DetailRow label="Sire Breed" value={selectedRow.sireBreed} />
                        <DetailRow label="Sire Semen Code" value={selectedRow.sireCode} />
                        <DetailRow label="Attempt Number" value={selectedRow.noOfAi?.toString()} />
                        <DetailRow label="Estrus Type" value={selectedRow.estrus === 'NH' ? 'Natural Heat' : 'Synchronized Heat'} />
                      </View>
                    )}

                    {selectedRow.type === 'PD' && (
                      <View style={{ gap: 10 }}>
                        <DetailRow label="Check Date" value={selectedRow.pdDate} />
                        <DetailRow label="Diagnosis Outcome" value={selectedRow.pdResult} highlightColor={selectedRow.pdResult?.toLowerCase().includes('pregnant') ? '#059669' : '#dc2626'} />
                      </View>
                    )}

                    {selectedRow.type === 'CD' && (
                      <View style={{ gap: 10 }}>
                        <DetailRow label="Calving Date" value={selectedRow.cdDate} />
                        <DetailRow label="Calves Count" value={selectedRow.cdNum?.toString()} />
                        <DetailRow label="Calving Ease" value={selectedRow.cdEase} highlightColor={selectedRow.cdEase?.toLowerCase() === 'normal' ? '#059669' : '#d97706'} />
                      </View>
                    )}

                    {selectedRow.type === 'HL' && (
                      <View style={{ gap: 10 }}>
                        <DetailRow label="Reported Issue" value={selectedRow.sireBreed} />
                        <DetailRow label="Service Status" value={selectedRow.sireCode} highlightColor="#059669" />
                      </View>
                    )}
                  </View>

                </View>
              )}
            </ScrollView>

            {/* Footer Actions */}
            <View style={{ paddingHorizontal: 24, paddingVertical: 18, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : '#f8fafc' }}>
              <TouchableOpacity 
                onPress={() => setDetailModalOpen(false)}
                style={{ width: '100%', paddingVertical: 12, borderRadius: 16, backgroundColor: isDark ? colors.primary : '#00643B', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Outfit_700Bold', color: '#fff' }}>Close Details</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>
    </View>
  );
}
