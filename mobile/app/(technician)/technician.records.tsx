import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StatusBar } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import { useApi } from '@/lib/api';
import RecordCard from '@/components/RecordCard';
import { useRouter } from 'expo-router';

// Define the shape of our data
interface Insemination {
  _id: string;
  farmerId: string;
  animalId: string;
  inseminationDate: string;
  status: string;
  attemptNumber: number;
}

const Records = () => {
  const api = useApi();
  const router = useRouter();
  const [records, setRecords] = useState<Insemination[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Function to fetch data
  const fetchRecords = async () => {
    try {
      // Currently only fetching inseminations as other endpoints return empty arrays
      const response = await api.get('/technician/inseminations');
      setRecords(response.data.inseminations);
    } catch (error) {
      console.error("Failed to fetch records:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    // Add sample data for visualization
    const sampleData: Insemination[] = [
      {
        _id: 'sample-1',
        farmerId: 'farmer-1',
        animalId: 'animal-1',
        inseminationDate: new Date().toISOString(),
        status: 'approved',
        attemptNumber: 1,
      },
      {
        _id: 'sample-2',
        farmerId: 'farmer-2',
        animalId: 'animal-2',
        inseminationDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        status: 'pending',
        attemptNumber: 2,
      },
      {
        _id: 'sample-3',
        farmerId: 'farmer-3',
        animalId: 'animal-3',
        inseminationDate: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        status: 'rejected',
        attemptNumber: 1,
      }
    ];
    setRecords(sampleData);
    
    // Uncomment this to fetch real data
    // fetchRecords();
    setLoading(false);
  }, []);

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRecords();
  }, []);

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
        case 'approved': return 'text-[#059669]';
        case 'pending': return 'text-[#d97706]';
        case 'rejected': return 'text-[#dc2626]';
        default: return 'text-slate-500';
    }
  };

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <StatusBar barStyle="light-content" />
      
      {/* Absolute Green Top Background */}
      <View className="absolute top-0 left-0 right-0 h-[220px] bg-[#00643B]" />

      <Header />
      
      {/* Overlapping White Curve Card */}
      <View 
        className="flex-1 bg-[#F9FAFB] rounded-t-[32px] px-6 pt-8 mt-2 shadow-lg"
        style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 8 }}
      >
        <View className="mb-6">
            <Text className="text-[24px] font-bold text-slate-800">Records</Text>
            <Text className="text-slate-500 text-[14px] font-medium mt-1">Recent inseminations and checks.</Text>
        </View>

        {loading ? (
             <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#00643B" />
             </View>
        ) : (
            <ScrollView 
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00643B" />
                }
            >
                {records.length === 0 ? (
                    <View className="mt-10 items-center">
                        <Text className="text-slate-400">No records found</Text>
                    </View>
                ) : (
                    records.map((item) => (
                        <RecordCard 
                            key={item._id}
                            id={item._id}
                            title={`Insemination Attempt #${item.attemptNumber}`}
                            subtitle={`ID: ${item._id.substring(0, 8)}...`}
                            date={new Date(item.inseminationDate).toLocaleDateString()}
                            status={item.status}
                            statusColor={getStatusColor(item.status)}
                            onPress={() => console.log("View details for", item._id)}
                        />
                    ))
                )}
            </ScrollView>
        )}
      </View>
    </View>
  );
}

export default Records;