import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar, FileDown, Printer, ChevronRight, ChevronLeft, Download } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { useAuth } from '@clerk/clerk-expo';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { generatePDF, generateExcel, ReportRow } from '@/lib/reportExporter';
import { toast } from 'sonner-native';

const PRIMARY = '#00643B';

export default function TechnicianReportsScreen() {
  const router = useRouter();
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'monthly' | 'weekly'>('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportRow[]>([]);

  const fetchReportData = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    setLoading(true);
    try {
      const start = activeTab === 'monthly' ? startOfMonth(selectedDate) : startOfWeek(selectedDate);
      const end = activeTab === 'monthly' ? endOfMonth(selectedDate) : endOfWeek(selectedDate);

      // Fetch all relevant records
      const [insRes, pregRes, calvRes] = await Promise.all([
        api.get('/technician/inseminations'),
        api.get('/technician/pregnancy-checks'),
        api.get('/technician/calvings'),
      ]);

      const allEvents: ReportRow[] = [];

      // Process Inseminations
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
            address: ins.farmerId?.location || '—',
            farmer: ins.farmerId?.name || '—',
            date: format(date, 'MM/dd/yyyy'),
            noOfAi: ins.attemptNumber,
            estrus: ins.estrus || 'NH',
            sireBreed: ins.sireBreed || '—',
            sireCode: ins.sireCode || '—',
          });
        }
      });

      // Process Pregnancy Checks
      (pregRes.data?.pregnancyChecks || []).forEach((preg: any) => {
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
            address: preg.farmerId?.location || '—',
            farmer: preg.farmerId?.name || '—',
            date: format(date, 'MM/dd/yyyy'),
            pdDate: format(date, 'MM/dd/yyyy'),
            pdResult: preg.pregnancyDiagnosis?.result || '—',
          });
        }
      });

      // Process Calvings
      (calvRes.data?.calvings || []).forEach((calv: any) => {
        const date = new Date(calv.calvingDate || calv.createdAt);
        if (date >= start && date <= end) {
          allEvents.push({
            type: 'CD',
            animalId: calv.animalId?.animalId || '—',
            earTag: calv.animalId?.earTag || '—',
            brand: calv.animalId?.brand || '—',
            species: calv.animalId?.species || '—',
            breed: calv.animalId?.breed || '—',
            color: calv.animalId?.color || '—',
            address: calv.farmerId?.location || '—',
            farmer: calv.farmerId?.name || '—',
            date: format(date, 'MM/dd/yyyy'),
            cdDate: format(date, 'MM/dd/yyyy'),
            cdNum: calv.numberOfCalves,
            cdSex: calv.sexOfCalf,
            cdEase: calv.calvingEase,
          });
        }
      });

      setReportData(allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error("Report fetch error:", error);
      toast.error("Failed to generate report data");
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

  const handleExportPDF = () => {
    generatePDF(reportData, format(selectedDate, 'MMMM'), format(selectedDate, 'yyyy'));
  };

  const handleExportExcel = () => {
    generateExcel(reportData, `Technician_Report_${format(selectedDate, 'MMM_yyyy')}`);
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={{ backgroundColor: PRIMARY }} className="pt-14 pb-6 px-6 shadow-md">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white/20 rounded-full">
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-white">Record Reports</Text>
          <View className="w-10" />
        </View>
      </View>

      <ScrollView className="flex-1">
        {/* Tab Switcher */}
        <View className="flex-row bg-white dark:bg-slate-900 mx-6 mt-6 rounded-2xl p-1 shadow-sm border border-slate-100 dark:border-slate-800">
          <TouchableOpacity 
            onPress={() => setActiveTab('monthly')}
            className={`flex-1 py-3 rounded-xl items-center ${activeTab === 'monthly' ? 'bg-[#00643B]' : ''}`}
          >
            <Text className={`font-bold ${activeTab === 'monthly' ? 'text-white' : 'text-slate-500'}`}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('weekly')}
            className={`flex-1 py-3 rounded-xl items-center ${activeTab === 'weekly' ? 'bg-[#00643B]' : ''}`}
          >
            <Text className={`font-bold ${activeTab === 'weekly' ? 'text-white' : 'text-slate-500'}`}>Weekly</Text>
          </TouchableOpacity>
        </View>

        {/* Period Selector */}
        <View className="mx-6 mt-6 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => changeDate(-1)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full">
            <ChevronLeft size={24} color={PRIMARY} />
          </TouchableOpacity>
          
          <View className="items-center">
            <Text className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Reporting Period</Text>
            <Text className="text-lg font-bold text-slate-800 dark:text-white">
              {activeTab === 'monthly' ? format(selectedDate, 'MMMM yyyy') : `${format(startOfWeek(selectedDate), 'MMM d')} - ${format(endOfWeek(selectedDate), 'MMM d, yyyy')}`}
            </Text>
          </View>

          <TouchableOpacity onPress={() => changeDate(1)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full">
            <ChevronRight size={24} color={PRIMARY} />
          </TouchableOpacity>
        </View>

        {/* Preview Table Header */}
        <View className="px-6 mt-8 flex-row justify-between items-end">
          <View>
            <Text className="text-2xl font-black text-slate-800 dark:text-white">Report Preview</Text>
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">{reportData.length} Activities Found</Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={handleExportPDF} className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl border border-emerald-100 dark:border-emerald-800">
              <Printer size={20} color={PRIMARY} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExportExcel} className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl border border-blue-100 dark:border-blue-800">
              <Download size={20} color="#2563EB" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Table Preview */}
        <ScrollView horizontal showsHorizontalScrollIndicator={true} className="mt-4 px-6 mb-8">
          <View className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm">
            {/* Table Header Row */}
            <View className="flex-row bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <TableCol label="Data" width={60} isHeader />
              <TableCol label="Animal ID" width={100} isHeader />
              <TableCol label="Tag" width={80} isHeader />
              <TableCol label="Species" width={80} isHeader />
              <TableCol label="Breed" width={100} isHeader />
              <TableCol label="Farmer" width={120} isHeader />
              <TableCol label="Date" width={100} isHeader />
              <TableCol label="Result/Details" width={150} isHeader />
            </View>

            {loading ? (
              <View className="py-20 items-center justify-center w-[790px]">
                <ActivityIndicator size="large" color={PRIMARY} />
              </View>
            ) : reportData.length === 0 ? (
              <View className="py-20 items-center justify-center w-[790px]">
                <Calendar size={48} color="#cbd5e1" />
                <Text className="text-slate-400 font-bold mt-4">No data for this period</Text>
              </View>
            ) : (
              reportData.map((row, idx) => (
                <View key={idx} className={`flex-row border-b border-slate-50 dark:border-slate-800/50 ${idx % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-slate-800/20'}`}>
                  <TableCol label={row.type} width={60} color={row.type === 'AI' ? '#059669' : row.type === 'PD' ? '#2563EB' : '#D97706'} bold />
                  <TableCol label={row.animalId} width={100} />
                  <TableCol label={row.earTag} width={80} />
                  <TableCol label={row.species} width={80} />
                  <TableCol label={row.breed} width={100} />
                  <TableCol label={row.farmer} width={120} />
                  <TableCol label={row.date} width={100} />
                  <TableCol 
                    label={row.type === 'AI' ? `Sire: ${row.sireCode}` : row.type === 'PD' ? `Result: ${row.pdResult}` : `Calf: ${row.cdSex} (${row.cdEase})`} 
                    width={150} 
                  />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const TableCol = ({ label, width, isHeader, color, bold }: { label: string; width: number; isHeader?: boolean; color?: string; bold?: boolean }) => (
  <View style={{ width }} className="p-4 items-center justify-center">
    <Text 
      numberOfLines={1}
      style={{ color: color || undefined }}
      className={`${isHeader ? 'text-[10px] font-black uppercase text-slate-400 tracking-tighter' : 'text-[13px] text-slate-600 dark:text-slate-300'} ${bold ? 'font-bold' : ''}`}
    >
      {label}
    </Text>
  </View>
);
