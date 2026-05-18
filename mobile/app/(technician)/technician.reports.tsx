import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Printer, ChevronRight, ChevronLeft, Download, Filter } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { useAuth } from '@clerk/clerk-expo';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { generatePDF, generateExcel, ReportRow } from '@/lib/reportExporter';
import { toast } from 'sonner-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PRIMARY = '#00643B';

export default function TechnicianReportsScreen() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'monthly' | 'weekly'>('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportRow[]>([]);

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
        api.get('/technician/inseminations'),
        api.get('/technician/pregnancy-checks'),
        api.get('/technician/calvings'),
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

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <StatusBar barStyle="light-content" />
      
      {/* Fixed Header */}
      <View style={{ backgroundColor: PRIMARY, paddingBottom: 50, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingHorizontal: 24, paddingTop: insets.top + 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
               <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 24 }}>Field Reports</Text>
          </View>
          <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
             <Filter size={18} color="#fff" />
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
              Audited {reportData.length} records. Your data is fully synchronized!
            </Text>
          </View>
        </View>
      </View>

      {/* CLIPPED CONTENT CONTAINER: Background color and overflow: hidden fix the overlap issue */}
      <View style={{ 
          flex: 1, 
          marginTop: -30, 
          backgroundColor: '#f9fafb', // Matches page bg
          borderTopLeftRadius: 40, 
          borderTopRightRadius: 40,
          overflow: 'hidden' // CLIPS the scrolling items so they don't go onto the green bg
      }}>
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 30, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchReportData} tintColor={PRIMARY} />}
        >
           {/* Period Selector Card */}
           <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 16, padding: 4, marginBottom: 16 }}>
                 <TouchableOpacity onPress={() => setActiveTab('monthly')} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: activeTab === 'monthly' ? '#00643B' : 'transparent' }}>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: activeTab === 'monthly' ? '#fff' : '#64748b' }}>Monthly</Text>
                 </TouchableOpacity>
                 <TouchableOpacity onPress={() => setActiveTab('weekly')} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: activeTab === 'weekly' ? '#00643B' : 'transparent' }}>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: activeTab === 'weekly' ? '#fff' : '#64748b' }}>Weekly</Text>
                 </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                 <TouchableOpacity onPress={() => changeDate(-1)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronLeft size={20} color={PRIMARY} />
                 </TouchableOpacity>
                 <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontFamily: 'Outfit_900Black', color: '#1e293b' }}>
                       {activeTab === 'monthly' ? format(selectedDate, 'MMMM yyyy') : `${format(startOfWeek(selectedDate), 'MMM d')} - ${format(endOfWeek(selectedDate), 'MMM d')}`}
                    </Text>
                 </View>
                 <TouchableOpacity onPress={() => changeDate(1)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronRight size={20} color={PRIMARY} />
                 </TouchableOpacity>
              </View>
           </View>

           {/* Export Actions */}
           <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
              <TouchableOpacity onPress={() => generatePDF(reportData, format(selectedDate, 'MMMM'), format(selectedDate, 'yyyy'))} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#f1f5f9' }}>
                 <Printer size={18} color={PRIMARY} />
                 <Text style={{ fontFamily: 'Outfit_700Bold', color: '#1e293b', fontSize: 13 }}>PDF Report</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => generateExcel(reportData, `Report_${format(selectedDate, 'MMM_yyyy')}`)} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#f1f5f9' }}>
                 <Download size={18} color="#2563EB" />
                 <Text style={{ fontFamily: 'Outfit_700Bold', color: '#1e293b', fontSize: 13 }}>Excel Sheet</Text>
              </TouchableOpacity>
           </View>

           {/* Record List */}
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: '#1e293b', fontSize: 18 }}>Activity Records</Text>
              <View style={{ backgroundColor: '#ecfdf5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                 <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: '#059669', fontSize: 10 }}>{reportData.length} TOTAL</Text>
              </View>
           </View>

           {loading && reportData.length === 0 ? (
              <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
           ) : reportData.length === 0 ? (
              <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 48, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}>
                 <MaterialCommunityIcons name="file-search-outline" size={60} color="#cbd5e1" />
                 <Text style={{ fontFamily: 'Outfit_700Bold', color: '#94a3b8', marginTop: 16 }}>No records found</Text>
              </View>
           ) : (
              reportData.map((row, idx) => (
                 <View key={idx} style={{ backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' }}>
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: row.type === 'AI' ? '#ecfdf5' : row.type === 'PD' ? '#eff6ff' : row.type === 'HL' ? '#fef2f2' : '#fffbeb', alignItems: 'center', justifyContent: 'center' }}>
                       <Text style={{ fontFamily: 'Outfit_900Black', color: row.type === 'AI' ? '#059669' : row.type === 'PD' ? '#2563EB' : row.type === 'HL' ? '#ef4444' : '#D97706', fontSize: 14 }}>{row.type}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                       <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 15, fontFamily: 'Outfit_700Bold', color: '#1e293b' }}>{row.animalId}</Text>
                          <Text style={{ fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: '#94a3b8' }}>{row.date}</Text>
                       </View>
                       <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: '#64748b', marginTop: 2 }} numberOfLines={1}>
                          {row.farmer} · {row.address}
                       </Text>
                       <View style={{ marginTop: 6, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f8fafc', alignSelf: 'flex-start', borderRadius: 6 }}>
                          <Text style={{ fontSize: 9, fontFamily: 'Outfit_800ExtraBold', color: '#475569', textTransform: 'uppercase' }}>
                             {row.type === 'AI' ? `Sire: ${row.sireCode} (${row.breed})` : 
                              row.type === 'PD' ? `Result: ${row.pdResult}` : 
                              row.type === 'HL' ? `Health: ${row.sireBreed}` :
                              `Calf Drop: ${row.cdNum} (${row.cdEase})`}
                          </Text>
                       </View>
                    </View>
                 </View>
              ))
           )}
        </ScrollView>
      </View>
    </View>
  );
}
