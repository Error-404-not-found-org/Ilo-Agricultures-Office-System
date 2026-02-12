import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import SafeScreen from '@/components/safeScreen';
import Header from '@/components/Header';
import RecordCard from '@/components/RecordCard';

// Define the shape of our data (reusing for now, can be moved to types later)
interface Insemination {
  _id: string;
  farmerId: string;
  animalId: string;
  inseminationDate: string;
  status: string;
  attemptNumber: number;
}

const FarmerRecords = () => {
  const [records, setRecords] = useState<Insemination[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // START: Sample Data for Farmer
    const sampleData: Insemination[] = [
      {
        _id: 'farm-rec-1',
        farmerId: 'me',
        animalId: 'Bessie',
        inseminationDate: new Date().toISOString(),
        status: 'pending',
        attemptNumber: 1,
      },
      {
        _id: 'farm-rec-2',
        farmerId: 'me',
        animalId: 'Daisy',
        inseminationDate: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
        status: 'approved',
        attemptNumber: 1,
      },
       {
        _id: 'farm-rec-3',
        farmerId: 'me',
        animalId: 'MooMoo',
        inseminationDate: new Date(Date.now() - 500000000).toISOString(), 
        status: 'rejected',
        attemptNumber: 2,
      }
    ];
    // END: Sample Data

    // Simulate network delay
    setTimeout(() => {
        setRecords(sampleData);
        setLoading(false);
    }, 1000);

  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate refresh (reload sample data)
    setTimeout(() => {
        setRefreshing(false);
    }, 1000);
  }, []);

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
        case 'approved': return 'text-green-600';
        case 'pending': return 'text-yellow-600';
        case 'rejected': return 'text-red-600';
        default: return 'text-gray-600';
    }
  };

  return (
    <SafeScreen>
      <View className="flex-1 bg-gray-50">
        <Header />
        
        <View className="px-6 mb-4">
            <Text className="text-2xl font-bold text-gray-900">My Records</Text>
            <Text className="text-gray-500">History of my animals</Text>
        </View>

        {loading ? (
             <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#2563EB" />
             </View>
        ) : (
            <ScrollView 
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {records.length === 0 ? (
                    <View className="mt-10 items-center">
                        <Text className="text-gray-400">No records found</Text>
                    </View>
                ) : (
                    records.map((item) => (
                        <RecordCard 
                            key={item._id}
                            id={item._id}
                            title={`Insemination Attempt #${item.attemptNumber}`}
                            subtitle={`Animal: ${item.animalId}`} // Display Animal Name for Farmer
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
    </SafeScreen>
  );
}

export default FarmerRecords;