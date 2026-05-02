import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import { Home, Users, Plus, FileText, Activity, X, UserPlus, Dog } from 'lucide-react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

// Admin Theme Colors
const COLORS = {
  primary: '#0f172a', // Dark Navy
  active: '#2563EB',  // Admin Blue
  inactive: '#94a3b8',
  background: '#ffffff',
  darkBackground: '#0f172a',
  darkSurface: '#1e293b',
};

const AdminBottomNavigator = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();

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
      {/* --- ADMIN QUICK ACTION MODAL --- */}
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
            <View className="bg-white dark:bg-slate-900 rounded-t-[40px] px-6 pt-8 pb-12" style={[styles.modalShadow, { paddingBottom: insets.bottom + 20 }]}>
              <View className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full self-center mb-6" />
              
              <View className="flex-row justify-between items-center mb-8">
                <Text className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Admin Actions</Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-full items-center justify-center"
                >
                  <X size={20} color={colorScheme === 'dark' ? '#94a3b8' : '#64748b'} />
                </TouchableOpacity>
              </View>

              <View className="flex-row flex-wrap justify-between gap-y-4">
                <ModalAction
                  icon={<UserPlus size={24} color={COLORS.active} />}
                  label="Create User"
                  onPress={() => handleModalAction('/(admin)/create-user')}
                />
                <ModalAction
                  icon={<Dog size={24} color={COLORS.active} />}
                  label="All Animals"
                  onPress={() => handleModalAction('/(admin)/admin.animals')}
                />
                <ModalAction
                  icon={<Activity size={24} color={COLORS.active} />}
                  label="Records"
                  onPress={() => handleModalAction('/(admin)/admin.records')}
                />
                <ModalAction
                  icon={<Users size={24} color={COLORS.active} />}
                  label="All Users"
                  onPress={() => handleModalAction('/(admin)/admin.users')}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* --- MAIN TAB BAR — flat, flush, no floating (Technician Design) --- */}
      <View style={[styles.tabContainer, { 
        paddingBottom: Math.max(insets.bottom, 12),
        backgroundColor: colorScheme === 'dark' ? COLORS.darkBackground : COLORS.background,
      }]}>
        <View style={[styles.topBorder, { backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#f1f5f9' }]} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            backgroundColor: colorScheme === 'dark' ? COLORS.darkBackground : COLORS.background,
            paddingTop: 8,
          }}
        >
          <TabItem
            icon={Home}
            label="Home"
            isFocused={isFocused('admin.dashboard')}
            onPress={() => onNavigate('admin.dashboard')}
            colorScheme={colorScheme}
          />
          <TabItem
            icon={Users}
            label="Users"
            isFocused={isFocused('admin.users')}
            onPress={() => onNavigate('admin.users')}
            colorScheme={colorScheme}
          />

          {/* Center FAB — rises above bar via negative marginTop */}
          <View style={{ flex: 1, alignItems: 'center', marginTop: -20 }}>
            <TouchableOpacity
              style={[styles.fab, styles.fabShadow, { borderColor: colorScheme === 'dark' ? COLORS.darkBackground : '#ffffff' }]}
              activeOpacity={0.9}
              onPress={() => setModalVisible(true)}
            >
              <Plus color="white" size={28} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <TabItem
            icon={Dog}
            label="Animals"
            isFocused={isFocused('admin.animals')}
            onPress={() => onNavigate('admin.animals')}
            colorScheme={colorScheme}
          />
          <TabItem
            icon={FileText}
            label="Records"
            isFocused={isFocused('admin.records')}
            onPress={() => onNavigate('admin.records')}
            colorScheme={colorScheme}
          />
        </View>
      </View>
    </>
  );
};

// --- SUB COMPONENTS ---

const TabItem = ({ icon: Icon, label, isFocused, onPress, colorScheme }: any) => (
  <TouchableOpacity
    onPress={onPress}
    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8, paddingBottom: 4 }}
    activeOpacity={0.6}
  >
    <View
      style={
        isFocused
          ? { backgroundColor: colorScheme === 'dark' ? '#1e3a8a' : '#eff6ff', width: 52, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }
          : { alignItems: 'center', justifyContent: 'center' }
      }
    >
      <Icon color={isFocused ? COLORS.active : COLORS.inactive} size={22} strokeWidth={isFocused ? 2.5 : 2} />
    </View>
    <Text style={{ fontSize: 10, color: isFocused ? COLORS.active : COLORS.inactive, fontWeight: '600', marginTop: 2 }}>
      {label}
    </Text>
  </TouchableOpacity>
);


const ModalAction = ({ icon, label, onPress }: { icon: any; label: string; onPress?: () => void }) => (
  <TouchableOpacity
    onPress={onPress}
    className="w-[47%] bg-white dark:bg-slate-800 p-5 rounded-[24px] items-center border border-slate-100 dark:border-slate-700"
    style={styles.actionShadow}
  >
    <View className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-full items-center justify-center mb-3">{icon}</View>
    <Text className="font-bold text-slate-700 dark:text-slate-200 text-[13px]">{label}</Text>
  </TouchableOpacity>
);


// --- STYLES ---

const styles = StyleSheet.create({
  tabContainer: {
    backgroundColor: '#ffffff',
    elevation: 16,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
  },
  topBorder: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  fabShadow: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  modalShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  actionShadow: {
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});

export default AdminBottomNavigator;
