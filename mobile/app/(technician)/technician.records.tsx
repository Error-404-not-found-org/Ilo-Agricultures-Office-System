import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StatusBar, TouchableOpacity, StyleSheet } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import { useApi } from '@/lib/api';
import RecordCard from '@/components/RecordCard';

const Records = () => {
  const api = useApi();
  const [activeTab, setActiveTab] = useState<'history' | 'requests'>('history');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'history') {
        const [insRes, pregRes, calvRes] = await Promise.all([
          api.get('/technician/inseminations'),
          api.get('/technician/pregnancy-checks'),
          api.get('/technician/calvings')
        ]);
        
        const combined = [
          ...(insRes.data.inseminations || []).map((i: any) => ({ ...i, type: 'insemination' })),
          ...(pregRes.data.pregnancyChecks || []).map((p: any) => ({ ...p, type: 'pregnancy' })),
          ...(calvRes.data.calvings || []).map((c: any) => ({ ...c, type: 'calving' }))
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setHistoryRecords(combined);
      } else {
        const [aiRes, healthRes] = await Promise.all([
          api.get('/ai-request'),
          api.get('/health-request')
        ]);
        
        const combined = [
          ...(aiRes.data || []).map((a: any) => ({ ...a, type: 'ai-request' })),
          ...(healthRes.data || []).map((h: any) => ({ ...h, type: 'health-request' }))
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setServiceRequests(combined);
      }
    } catch (error: any) {
      console.error("Failed to fetch records:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const renderHistoryItem = (item: any) => {
    let title = "";
    switch(item.type) {
      case 'insemination': title = `Insemination #${item.attemptNumber}`; break;
      case 'pregnancy': title = `Pregnancy Check: ${item.pregnancyDiagnosis?.result || 'Pending'}`; break;
      case 'calving': title = `Calving: ${item.numberOfCalves || 1} Calf`; break;
    }

    return (
      <RecordCard 
        key={item._id}
        id={item._id}
        title={title}
        subtitle={item.animalId?.earTag || item.animalId?.animalId || "No Tag"}
        date={item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
        status={item.status || "Completed"}
        statusColor="text-slate-500"
        onPress={() => {}}
      />
    );
  };

  const renderRequestItem = (item: any) => {
    const isAI = item.type === 'ai-request';
    return (
      <View key={item._id} style={styles.card}>
        <View style={styles.cardHeader}>
            <Text style={styles.timestamp}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "RECENT"}</Text>
            <View style={[styles.badge, item.status === 'pending' ? styles.badgePending : styles.badgeApproved]}>
                <Text style={[styles.badgeText, item.status === 'pending' ? styles.badgeTextPending : styles.badgeTextApproved]}>
                    {item.status || 'pending'}
                </Text>
            </View>
        </View>
        <Text style={styles.cardTitle}>{isAI ? "AI Service Request" : "Health Service Request"}</Text>
        <Text style={styles.cardSubtitle}>Farmer: <Text style={{fontWeight: 'bold'}}>{item.farmerId?.name || "Farmer"}</Text></Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.greenTop} />

      <Header />
      
      <View style={styles.contentCard}>
        <View style={styles.tabBar}>
            <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setActiveTab('history')}
                style={[styles.tab, activeTab === 'history' ? styles.tabActive : null]}
            >
                <Text style={[styles.tabText, activeTab === 'history' ? styles.tabTextActive : null]}>Activity History</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setActiveTab('requests')}
                style={[styles.tab, activeTab === 'requests' ? styles.tabActive : null]}
            >
                <Text style={[styles.tabText, activeTab === 'requests' ? styles.tabTextActive : null]}>Service Requests</Text>
            </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
             <View style={styles.centered}>
                <ActivityIndicator size="large" color="#00643B" />
             </View>
        ) : (
            <ScrollView 
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#00643B"]} />
                }
            >
                {activeTab === 'history' ? (
                    historyRecords.map(renderHistoryItem)
                ) : (
                    serviceRequests.map(renderRequestItem)
                )}
            </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' } as ViewStyle,
    greenTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 220, backgroundColor: '#00643B' } as ViewStyle,
    contentCard: { flex: 1, backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 24, marginTop: 8 } as ViewStyle,
    tabBar: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 6, borderRadius: 16, marginBottom: 20 } as ViewStyle,
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12 } as ViewStyle,
    tabActive: { backgroundColor: 'white' } as ViewStyle,
    tabText: { fontWeight: 'bold', color: '#64748B', fontSize: 14 } as TextStyle,
    tabTextActive: { color: '#00643B' } as TextStyle,
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 60 } as ViewStyle,
    card: { backgroundColor: 'white', padding: 20, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' } as ViewStyle,
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } as ViewStyle,
    timestamp: { fontSize: 10, color: '#94A3B8', fontWeight: 'bold' } as TextStyle,
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 } as ViewStyle,
    badgePending: { backgroundColor: '#FFFBEB' } as ViewStyle,
    badgeApproved: { backgroundColor: '#ECFDF5' } as ViewStyle,
    badgeText: { fontSize: 10, fontWeight: 'bold' } as TextStyle,
    badgeTextPending: { color: '#D97706' } as TextStyle,
    badgeTextApproved: { color: '#059669' } as TextStyle,
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' } as TextStyle,
    cardSubtitle: { fontSize: 14, color: '#64748B', marginTop: 4 } as TextStyle
});

import { ViewStyle, TextStyle } from 'react-native';

export default Records;
