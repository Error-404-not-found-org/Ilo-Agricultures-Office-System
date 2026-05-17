import React from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, 
  RefreshControl, Alert, Image 
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, Syringe, Stethoscope, Clock, 
  Trash2, AlertCircle, ChevronRight, CheckCircle2 
} from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { format } from 'date-fns';
import { toast } from 'sonner-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#00643B';

export default function MyRequests() {
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('all');
  const [allRequests, setAllRequests] = React.useState<any[]>([]);

  const { data: aiData, isLoading: loadingAi, isRefetching: refetchingAi, refetch: refetchAi } = useQuery({
    queryKey: ['farmer', 'ai-requests', page, status],
    queryFn: async () => {
      let aiStatus = status;
      // Map 'done' filter to 'done' for AI
      const res = await api.get(`/ai-request/my?page=${page}&limit=10&status=${aiStatus}`);
      return res.data;
    }
  });

  const { data: healthData, isLoading: loadingHealth, isRefetching: refetchingHealth, refetch: refetchHealth } = useQuery({
    queryKey: ['farmer', 'health-requests', page, status],
    queryFn: async () => {
      let healthStatus = status;
      if (status === 'done') healthStatus = 'resolved';
      if (status === 'rejected') healthStatus = 'cancelled';
      
      const res = await api.get(`/health-request/my?page=${page}&limit=10&status=${healthStatus}`);
      return res.data;
    }
  });

  React.useEffect(() => {
    if (aiData?.data || healthData?.data) {
      const aiItems = (aiData?.data || []).map((r: any) => ({ ...r, type: 'ai' }));
      const healthItems = (healthData?.data || []).map((r: any) => ({ ...r, type: 'health' }));
      
      const combined = [...aiItems, ...healthItems].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      if (page === 1) {
        setAllRequests(combined);
      } else {
        setAllRequests(prev => {
            const existingIds = new Set(prev.map(p => `${p.type}-${p._id}`));
            const uniqueNew = combined.filter(c => !existingIds.has(`${c.type}-${c._id}`));
            return [...prev, ...uniqueNew].sort((a, b) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
        });
      }
    }
  }, [aiData, healthData, page, status]);

  const isLoading = (loadingAi && page === 1) || (loadingHealth && page === 1);
  const isRefetching = refetchingAi || refetchingHealth;
  
  const hasMore = (aiData?.page < aiData?.pages) || (healthData?.page < healthData?.pages);

  const onRefresh = () => {
    setPage(1);
    refetchAi();
    refetchHealth();
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    setPage(1);
    setAllRequests([]);
  };

  const loadMore = () => {
    if (hasMore && !isLoading && !isRefetching) {
      setPage(prev => prev + 1);
    }
  };

  const STATUS_FILTERS = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'In-Progress', value: 'in-progress' },
    { label: 'Resolved', value: 'done' },
  ];

  const handleDelete = (id: string, type: string, animalTag: string) => {
    const endpoint = type === 'ai' ? `/ai-request/${id}` : `/health-request/${id}`;
    
    Alert.alert(
      "Cancel Request?",
      `Are you sure you want to cancel this request for ${animalTag}? This action cannot be undone.`,
      [
        { text: "No, Keep it", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(endpoint);
              toast.success("Request cancelled successfully");
              queryClient.invalidateQueries({ queryKey: ['farmer', 'ai-requests'] });
              queryClient.invalidateQueries({ queryKey: ['farmer', 'health-requests'] });
            } catch (err: any) {
              toast.error(err.response?.data?.message || "Failed to cancel request");
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return { bg: '#FEF3C7', text: '#92400E' };
      case 'approved': return { bg: '#ECFDF5', text: '#065F46' };
      case 'in-progress': return { bg: '#EFF6FF', text: '#1E40AF' };
      case 'done': 
      case 'resolved': return { bg: '#F1F5F9', text: '#475569' };
      case 'rejected':
      case 'cancelled': return { bg: '#FEF2F2', text: '#991B1B' };
      default: return { bg: '#F1F5F9', text: '#475569' };
    }
  };

  return (
    <View className="flex-1 bg-[#F9FAFB] dark:bg-slate-950">
      {/* Header */}
      <View style={{ paddingTop: insets.top + 10 }} className="bg-white dark:bg-slate-800 px-6 pb-4 border-b border-gray-100 dark:border-slate-700 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-slate-50 dark:bg-slate-700 rounded-full">
          <ArrowLeft size={20} color={PRIMARY} />
        </TouchableOpacity>
        <Text className="text-lg font-black text-slate-800 dark:text-white">Service Hub</Text>
        <View className="w-10" />
      </View>

      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 150 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={PRIMARY} />
        }
      >
        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Track and manage your requests</Text>

        {/* Status Filter Bar */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          className="mb-8 -mx-1"
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => handleStatusChange(f.value)}
              className={`px-6 py-2.5 rounded-full mr-3 border ${status === f.value ? 'bg-emerald-800 border-emerald-800' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700'}`}
            >
              <Text className={`text-[12px] font-black uppercase tracking-widest ${status === f.value ? 'text-white' : 'text-slate-400'}`}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Quick Request Hub */}
        <View className="mb-10 flex-row gap-4">
          <TouchableOpacity 
            onPress={() => router.push('/(farmer)/request-ai')}
            className="flex-1 bg-white dark:bg-slate-800 p-5 rounded-[28px] border border-gray-100 dark:border-slate-700 items-center shadow-sm"
          >
            <View className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl items-center justify-center mb-3">
              <Syringe size={24} color={PRIMARY} />
            </View>
            <Text className="text-[13px] font-black text-slate-800 dark:text-white">Request AI</Text>
            <Text className="text-[9px] text-slate-400 font-bold mt-1 text-center">Artificial Breeding</Text>
          </TouchableOpacity>

          <TouchableOpacity 
             onPress={() => router.push('/(farmer)/report-sickness')}
             className="flex-1 bg-white dark:bg-slate-800 p-5 rounded-[28px] border border-gray-100 dark:border-slate-700 items-center shadow-sm"
          >
            <View className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-2xl items-center justify-center mb-3">
              <Stethoscope size={24} color="#9A3412" />
            </View>
            <Text className="text-[13px] font-black text-slate-800 dark:text-white">Request Vet</Text>
            <Text className="text-[9px] text-slate-400 font-bold mt-1 text-center">Health Checkup</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-4">Request Activity</Text>

        {isLoading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : allRequests.length > 0 ? (
          allRequests.map((req: any) => {
            const statusStyle = getStatusColor(req.status);
            const isHealth = req.type === 'health';
            const canDelete = req.status === 'pending' || req.status === 'rejected' || req.status === 'approved' || req.status === 'cancelled' || req.status === 'done' || req.status === 'resolved';

            return (
              <View 
                key={`${req.type}-${req._id}`}
                className="bg-white dark:bg-slate-800 rounded-[32px] p-5 mb-5 border border-gray-100 dark:border-slate-700 shadow-sm"
              >
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-3">
                    <View className={`w-10 h-10 rounded-2xl items-center justify-center ${isHealth ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                      {isHealth ? <Stethoscope size={20} color="#9A3412" /> : <Syringe size={20} color={PRIMARY} />}
                    </View>
                    <View>
                      <Text className="text-[15px] font-black text-slate-800 dark:text-white">{isHealth ? 'Health Checkup' : 'AI Insemination'}</Text>
                      <Text className="text-[11px] text-slate-400 font-bold">{format(new Date(req.createdAt), 'MMM d, yyyy')}</Text>
                    </View>
                  </View>
                  
                  <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: statusStyle.bg }}>
                    <Text className="text-[9px] font-black uppercase tracking-widest" style={{ color: statusStyle.text }}>{req.status}</Text>
                  </View>
                </View>

                {/* Animal Info */}
                <View className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl items-center justify-center border border-gray-100 dark:border-slate-700">
                      <Image 
                        source={{ uri: req.animalId?.imageUrl || 'https://via.placeholder.com/100' }} 
                        className="w-8 h-8 rounded-lg"
                      />
                    </View>
                    <View>
                      <Text className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{req.animalId?.earTag || req.animalId?.animalId || 'N/A'}</Text>
                      <Text className="text-[10px] text-slate-400">{req.animalId?.breed || 'Unknown'}</Text>
                    </View>
                  </View>
                  {!isHealth && (
                    <View className="items-end">
                        <Text className="text-[10px] font-bold text-slate-400 uppercase">Attempt</Text>
                        <Text className="text-[12px] font-black text-slate-800 dark:text-white">#{req.attemptNumber || 1}</Text>
                    </View>
                  )}
                </View>

                {/* Comment / Reason */}
                {req.comment || req.reason ? (
                   <View className="mb-4">
                      <Text className="text-[10px] font-bold text-slate-400 uppercase mb-1">{isHealth ? 'Symptoms' : 'Notes'}</Text>
                      <Text className="text-[12px] text-slate-600 dark:text-slate-400 italic">"{req.comment || req.reason}"</Text>
                   </View>
                ) : null}

                {/* Scheduled Info if approved */}
                {req.status === 'approved' && req.scheduledDate && (
                  <View className="flex-row items-center gap-2 mb-4 bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                    <Clock size={14} color={PRIMARY} />
                    <Text className="text-[12px] font-bold text-[#00643B] dark:text-emerald-400">
                      Scheduled for {format(new Date(req.scheduledDate), 'MMM d, h:mm a')}
                    </Text>
                  </View>
                )}

                {/* Technician Info */}
                {req.approvedBy && (
                  <View className="flex-row items-center gap-2 mb-4">
                    <CheckCircle2 size={14} color={PRIMARY} />
                    <Text className="text-[11px] text-slate-500 font-medium">Assigned to: {req.approvedBy.name || 'Technician'}</Text>
                  </View>
                )}

                {/* Actions */}
                <View className="flex-row gap-3 pt-2 border-t border-gray-50 dark:border-slate-700/50">
                   {req.animalId?._id && (
                    <TouchableOpacity 
                        onPress={() => router.push(`/(farmer)/animal-details?id=${req.animalId?._id}`)}
                        className="flex-row items-center gap-2"
                    >
                        <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Animal Details</Text>
                        <ChevronRight size={12} color="#94a3b8" />
                    </TouchableOpacity>
                   )}
                  
                  <View className="flex-1" />

                  {canDelete && (
                    <TouchableOpacity 
                      onPress={() => handleDelete(req._id, req.type, req.animalId?.earTag || req.animalId?.animalId || 'this animal')}
                      className="bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl flex-row items-center gap-2"
                    >
                      <Trash2 size={14} color="#EF4444" />
                      <Text className="text-[11px] font-black text-red-600">
                        {req.status === 'pending' ? 'Cancel' : 'Remove'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <View className="py-20 items-center">
            <AlertCircle size={48} color="#CBD5E1" />
            <Text className="mt-4 text-slate-500 font-bold">No Active Requests</Text>
            <Text className="mt-2 text-slate-400 text-center text-sm">
              Your service requests will appear here once you submit them.
            </Text>
          </View>
        )}

        {hasMore && (
          <TouchableOpacity 
            onPress={loadMore}
            disabled={isRefetching}
            className="py-4 items-center bg-white dark:bg-slate-800 rounded-[20px] border border-gray-100 dark:border-slate-700 mt-2 mb-10"
          >
            {isRefetching ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <Text className="text-[12px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Load Older Requests</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
