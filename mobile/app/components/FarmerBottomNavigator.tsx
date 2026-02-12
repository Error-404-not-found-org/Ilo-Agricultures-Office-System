import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { Home, User, Plus, FileText, Dog, X, Syringe, MessageCircleQuestion } from 'lucide-react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';

const FarmerBottomNavigator = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();

  const onNavigate = (screenName: string) => {
    navigation.navigate(screenName);
  };

  const isFocused = (screenName: string) => {
    return state.routes[state.index].name === screenName;
  };

  const activeColor = "#1f2937"; 
  const inactiveColor = "#9ca3af";

  const handleModalAction = (path: string) => {
      setModalVisible(false);
      // Ensure these paths exist in your app structure later
      router.push(path as any); 
  };

  return (
    <View className="bg-white justify-end">
      
      {/* --- FARMER SPECIFIC MODAL --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
            className="flex-1 bg-black/50 justify-end" 
            activeOpacity={1} 
            onPress={() => setModalVisible(false)}
        >
            <TouchableWithoutFeedback>
                <View className="bg-white rounded-t-[32px] p-6 pb-10">
                    
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-xl font-bold text-gray-900">Request Services</Text>
                        <TouchableOpacity onPress={() => setModalVisible(false)} className="bg-gray-100 p-2 rounded-full">
                            <X size={20} color="#374151" />
                        </TouchableOpacity>
                    </View>

                    {/* FARMER ACTIONS: Request AI, Report Sickness, etc. */}
                    <View className="flex-row flex-wrap justify-between gap-4">
                        
                        <TouchableOpacity 
                            onPress={() => handleModalAction('/(farmer)/request-ai')}
                            className="w-[47%] bg-gray-50 p-4 rounded-2xl items-center border border-gray-100"
                        >
                            <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mb-3">
                                <Syringe size={24} color="#2563EB" />
                            </View>
                            <Text className="font-semibold text-gray-800">Request AI</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                             onPress={() => handleModalAction('/(farmer)/report-sickness')}
                            className="w-[47%] bg-gray-50 p-4 rounded-2xl items-center border border-gray-100"
                        >
                             <View className="w-12 h-12 bg-red-100 rounded-full items-center justify-center mb-3">
                                <MessageCircleQuestion size={24} color="#DC2626" />
                            </View>
                            <Text className="font-semibold text-gray-800">Report Issue</Text>
                        </TouchableOpacity>

                    </View>
                </View>
            </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* --- FARMER TAB BAR (Simpler than Technician) --- */}
      <View className="flex-row items-end justify-between bg-gray-200 h-24 pb-6 px-6">

        {/* Home */}
        <TouchableOpacity onPress={() => onNavigate('index')} className="items-center justify-center flex-1 gap-1">
          <Home color={isFocused('index') ? activeColor : inactiveColor} size={24} strokeWidth={2} />
          <Text className={`text-xs font-semibold ${isFocused('index') ? 'text-gray-800' : 'text-gray-400'}`}>Farm</Text>
        </TouchableOpacity>

        {/* Animals */}
        <TouchableOpacity onPress={() => onNavigate('add-animal')} className="items-center justify-center flex-1 gap-1">
          <Dog color={isFocused('add-animal') ? activeColor : inactiveColor} size={24} strokeWidth={2} />
          <Text className={`text-xs font-semibold ${isFocused('add-animal') ? 'text-gray-800' : 'text-gray-400'}`}>Animals</Text>
        </TouchableOpacity>

        {/* Center Button (Quick Request) */}
        <View className="items-center justify-center flex-1">
            <TouchableOpacity 
              className="w-14 h-14 bg-green-600 rounded-full items-center justify-center shadow-lg mb-2"
              activeOpacity={0.8}
              onPress={() => setModalVisible(true)}
            >
              <Plus color="white" size={28} />
            </TouchableOpacity>
        </View>

        {/* Records */}
        <TouchableOpacity onPress={() => onNavigate('farmer.records')} className="items-center justify-center flex-1 gap-1">
          <FileText color={isFocused('farmer.records') ? activeColor : inactiveColor} size={24} strokeWidth={2} />
          <Text className={`text-xs font-semibold ${isFocused('farmer.records') ? 'text-gray-800' : 'text-gray-400'}`}>Records</Text>
        </TouchableOpacity>

        {/* Profile */}
        <TouchableOpacity onPress={() => onNavigate('profile')} className="items-center justify-center flex-1 gap-1">
          <User color={isFocused('profile') ? activeColor : inactiveColor} size={24} strokeWidth={2} />
          <Text className={`text-xs font-semibold ${isFocused('profile') ? 'text-gray-800' : 'text-gray-400'}`}>Profile</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
};

export default FarmerBottomNavigator;