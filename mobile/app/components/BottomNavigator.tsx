import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, StyleSheet, Platform } from 'react-native';
import { Home, Users, Plus, FileText, Dog, X, Syringe, ClipboardList } from 'lucide-react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';

// Premium Theme Colors
const COLORS = {
  primary: '#0f766e', // Deep Teal
  active: '#0d9488', // Bright Teal
  inactive: '#94a3b8', // Slate 400
  background: '#ffffff',
  surface: '#f8fafc',
};

const BottomNavigator = ({ state, descriptors, navigation }: BottomTabBarProps) => {
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
      {/* --- QUICK ACTION MODAL (Premium Redesign) --- */}
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
                <Text className="text-2xl font-bold text-slate-800 tracking-tight">Quick Actions</Text>
                <TouchableOpacity 
                    onPress={() => setModalVisible(false)} 
                    className="w-10 h-10 bg-slate-50 rounded-full items-center justify-center"
                >
                  <X size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View className="flex-row flex-wrap justify-between gap-y-4">
                <ModalAction 
                    icon={<Users size={24} color="#0d9488" />} 
                    label="Add Client" 
                    onPress={() => handleModalAction('/clients/register-client')} 
                />
                <ModalAction 
                    icon={<Dog size={24} color="#0d9488" />} 
                    label="New Animal" 
                    onPress={() => handleModalAction('/clients/add-animal')} 
                />
                <ModalAction 
                    icon={<ClipboardList size={24} color="#0d9488" />} 
                    label="Log Record" 
                />
                <ModalAction 
                    icon={<Syringe size={24} color="#0d9488" />} 
                    label="Treatment" 
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* --- MAIN TAB BAR (Floating Glassmorphic Redesign) --- */}
      <View style={styles.tabContainer}>
        <View className="flex-row items-center justify-between bg-white/95 rounded-full px- h-[72px]" style={styles.tabBarShadow}>
            
          <TabItem 
            icon={Home} 
            label="Home" 
            isFocused={isFocused('technician.dashboard')} 
            onPress={() => onNavigate('technician.dashboard')} 
          />
          <TabItem 
            icon={Users} 
            label="Clients" 
            isFocused={isFocused('technician.clients')} 
            onPress={() => onNavigate('technician.clients')} 
          />

          {/* Floating Center FAB */}
          <View className="items-center justify-center px-1">
            <TouchableOpacity
              className="w-14 h-14 bg-[#0f766e] rounded-full items-center justify-center -top-6 border-4 border-[#F8FAFC]"
              style={styles.fabShadow}
              activeOpacity={0.9}
              onPress={() => setModalVisible(true)}
            >
              <Plus color="white" size={30} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <TabItem 
            icon={Dog} 
            label="Animals" 
            isFocused={isFocused('technician.animals')} 
            onPress={() => onNavigate('technician.animals')} 
          />
          <TabItem 
            icon={FileText} 
            label="Records" 
            isFocused={isFocused('technician.records')} 
            onPress={() => onNavigate('technician.records')} 
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
    <View className={`items-center justify-center ${isFocused ? 'bg-teal-50/80 w-14 h-10 rounded-2xl' : ''}`}>
        <Icon 
            color={isFocused ? COLORS.active : COLORS.inactive} 
            size={24} 
            strokeWidth={isFocused ? 2.5 : 2} 
        />
    </View>
    <Text 
        className={`text-[10px] tracking-wide mt-1 font-semibold ${isFocused ? 'text-teal-700' : 'text-slate-400'}`}
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
      <View className="w-14 h-14 bg-teal-50 rounded-full items-center justify-center mb-3">
        {icon}
      </View>
      <Text className="font-bold text-slate-700 text-[13px]">{label}</Text>
    </TouchableOpacity>
);

// --- STYLES ---

const styles = StyleSheet.create({
  tabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 32, // 24,16 if it is too high the tab bar will be too high
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
    shadowColor: "#0f766e",
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

export default BottomNavigator;