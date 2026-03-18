import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, StyleSheet, Platform } from 'react-native';
import { Home, User, Plus, FileText, Dog, X, Syringe, MessageCircleQuestion } from 'lucide-react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';

// Premium Theme Colors
const COLORS = {
  primary: '#00643B', // Match specific green
  active: '#00643B',
  inactive: '#94a3b8',
  background: '#ffffff',
  surface: '#f8fafc',
};

const FarmerBottomNavigator = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();

  const onNavigate = (screenName: string) => {
    navigation.navigate(screenName);
  };

  const isFocused = (screenName: string) => {
    const route = state.routes.find(r => r.name === screenName);
    return route ? state.index === state.routes.indexOf(route) : false;
  };

  const handleModalAction = (path: string) => {
      setModalVisible(false);
      router.push(path as any); 
  };

  return (
    <>
      {/* --- FARMER SPECIFIC MODAL (Premium Redesign) --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
            className="flex-1 bg-slate-900/60 justify-end" 
            activeOpacity={1} 
            onPress={() => setModalVisible(false)}
        >
            <TouchableWithoutFeedback>
                <View className="bg-white rounded-t-[40px] px-6 pt-8 pb-12" style={styles.modalShadow}>
                    
                    {/* Handle indicator */}
                    <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mb-6" />

                    <View className="flex-row justify-between items-center mb-8">
                        <Text className="text-2xl font-bold text-slate-800 tracking-tight">Request Services</Text>
                        <TouchableOpacity 
                            onPress={() => setModalVisible(false)} 
                            className="w-10 h-10 bg-slate-50 rounded-full items-center justify-center"
                        >
                            <X size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* FARMER ACTIONS: Request AI, Report Sickness */}
                    <View className="flex-row flex-wrap justify-between gap-y-4">
                        <ModalAction 
                            icon={<Syringe size={24} color={COLORS.primary} />} 
                            label="Request AI" 
                            onPress={() => handleModalAction('/(farmer)/request-ai')} 
                        />
                        <ModalAction 
                            icon={<MessageCircleQuestion size={24} color="#dc2626" />} 
                            label="Report Issue" 
                            onPress={() => handleModalAction('/(farmer)/report-sickness')} 
                        />
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* --- MAIN TAB BAR (Floating Glassmorphic Redesign) --- */}
      <View style={styles.tabContainer}>
        <View className="flex-row items-center justify-between bg-white/95 rounded-full px-2 h-[72px]" style={styles.tabBarShadow}>
            
          <TabItem 
            icon={Home} 
            label="Farm" 
            isFocused={isFocused('index')} 
            onPress={() => onNavigate('index')} 
          />
          <TabItem 
            icon={Dog} 
            label="Animals" 
            isFocused={isFocused('add-animal')} 
            onPress={() => onNavigate('add-animal')} 
          />

          {/* Floating Center FAB */}
          <View className="items-center justify-center px-1">
            <TouchableOpacity
              className="w-14 h-14 bg-[#00643B] rounded-full items-center justify-center -top-6 border-4 border-[#F8FAFC]"
              style={styles.fabShadow}
              activeOpacity={0.9}
              onPress={() => setModalVisible(true)}
            >
              <Plus color="white" size={30} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <TabItem 
            icon={FileText} 
            label="Records" 
            isFocused={isFocused('farmer.records')} 
            onPress={() => onNavigate('farmer.records')} 
          />
          <TabItem 
            icon={User} 
            label="Profile" 
            isFocused={isFocused('profile')} 
            onPress={() => onNavigate('profile')} 
          />
          
        </View>
      </View>
    </>
  );
};

// --- SUB COMPONENTS ---

const TabItem = ({ icon: Icon, label, isFocused, onPress }: any) => (
  <TouchableOpacity 
    onPress={onPress} 
    className="items-center justify-center flex-1 h-full"
    activeOpacity={0.6}
  >
    <View className={`items-center justify-center ${isFocused ? 'bg-emerald-50 w-14 h-10 rounded-2xl' : ''}`}>
        <Icon 
            color={isFocused ? COLORS.active : COLORS.inactive} 
            size={24} 
            strokeWidth={isFocused ? 2.5 : 2} 
        />
    </View>
    <Text 
        className={`text-[10px] tracking-wide mt-1 font-semibold ${isFocused ? 'text-[#00643B]' : 'text-slate-400'}`}
    >
        {label}
    </Text>
  </TouchableOpacity>
);

const ModalAction = ({ icon, label, onPress }: { icon: any, label: string, onPress?: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      className="w-[47%] bg-white p-5 rounded-[24px] items-center border border-slate-100"
      style={styles.actionShadow}
    >
      <View className="w-14 h-14 bg-emerald-50 rounded-full items-center justify-center mb-3">
        {icon}
      </View>
      <Text className="font-bold text-slate-700 text-[13px]">{label}</Text>
    </TouchableOpacity>
);

// --- STYLES ---

const styles = StyleSheet.create({
  tabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 20,
    right: 20,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  tabBarShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
  },
  fabShadow: {
    shadowColor: "#00643B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  modalShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  actionShadow: {
    shadowColor: "#94a3b8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  }
});

export default FarmerBottomNavigator;