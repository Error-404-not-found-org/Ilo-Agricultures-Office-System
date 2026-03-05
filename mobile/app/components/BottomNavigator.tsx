import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { Home, Users, Plus, FileText, Dog, X, Syringe, ClipboardList } from 'lucide-react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router'; // <--- 1. Import this

const BottomNavigator = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter(); // <--- 2. Initialize the router

  // Helper to handle navigation for tabs
  const onNavigate = (screenName: string) => {
    navigation.navigate(screenName);
  };

  const isFocused = (screenName: string) => {
    const route = state.routes.find(r => r.name === screenName);
    return route ? state.index === state.routes.indexOf(route) : false;
  };

  const activeColor = "#1f2937";
  const inactiveColor = "#9ca3af";

  // Helper to handle Modal Navigation
  const handleModalAction = (path: string) => {
    setModalVisible(false); // Close modal first
    router.push(path as any); // Navigate to the page
  };

  return (
    <View className="bg-white justify-end">

      {/* --- MODAL START --- */}
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

              {/* Header */}
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-bold text-gray-900">Quick Actions</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} className="bg-gray-100 p-2 rounded-full">
                  <X size={20} color="#374151" />
                </TouchableOpacity>
              </View>

              {/* Action Grid */}
              <View className="flex-row flex-wrap justify-between gap-4">

                {/* Action 1: Add Client */}
                <TouchableOpacity
                  onPress={() => handleModalAction('/clients/register-client')}
                  className="w-[47%] bg-gray-50 p-4 rounded-2xl items-center border border-gray-100"
                >
                  <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mb-3">
                    <Users size={24} color="#2563EB" />
                  </View>
                  <Text className="font-semibold text-gray-800">Add Client</Text>
                </TouchableOpacity>

                {/* Action 2: Add Animal */}
                <TouchableOpacity
                  onPress={() => handleModalAction('/clients/add-animal')}
                  className="w-[47%] bg-gray-50 p-4 rounded-2xl items-center border border-gray-100"
                >
                  <View className="w-12 h-12 bg-orange-100 rounded-full items-center justify-center mb-3">
                    <Dog size={24} color="#EA580C" />
                  </View>
                  <Text className="font-semibold text-gray-800">New Animal</Text>
                </TouchableOpacity>

                {/* Action 3: New Record (Placeholder) */}
                <TouchableOpacity className="w-[47%] bg-gray-50 p-4 rounded-2xl items-center border border-gray-100">
                  <View className="w-12 h-12 bg-green-100 rounded-full items-center justify-center mb-3">
                    <ClipboardList size={24} color="#16A34A" />
                  </View>
                  <Text className="font-semibold text-gray-800">Log Record</Text>
                </TouchableOpacity>

                {/* Action 4: Treatment (Placeholder) */}
                <TouchableOpacity className="w-[47%] bg-gray-50 p-4 rounded-2xl items-center border border-gray-100">
                  <View className="w-12 h-12 bg-red-100 rounded-full items-center justify-center mb-3">
                    <Syringe size={24} color="#DC2626" />
                  </View>
                  <Text className="font-semibold text-gray-800">Treatment</Text>
                </TouchableOpacity>

              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
      {/* --- MODAL END --- */}


      {/* Main Tab Bar */}
      <View className="flex-row items-end justify-between bg-gray-200 h-24 pb-6 px-4">

        {/* Home */}
        <TouchableOpacity onPress={() => onNavigate('technician.dashboard')} className="items-center justify-center flex-1 gap-1">
          <Home color={isFocused('technician.dashboard') ? activeColor : inactiveColor} size={24} strokeWidth={2} />
          <Text className={`text-xs font-semibold ${isFocused('technician.dashboard') ? 'text-gray-800' : 'text-gray-400'}`}>Home</Text>
        </TouchableOpacity>

        {/* Clients */}
        <TouchableOpacity onPress={() => onNavigate('technician.clients')} className="items-center justify-center flex-1 gap-1">
          <Users color={isFocused('technician.clients') ? activeColor : inactiveColor} size={24} strokeWidth={2} />
          <Text className={`text-xs font-semibold ${isFocused('technician.clients') ? 'text-gray-800' : 'text-gray-400'}`}>Clients</Text>
        </TouchableOpacity>

        {/* Center Button */}
        <View className="items-center justify-center flex-1">
          <TouchableOpacity
            className="w-16 h-16 bg-gray-700 rounded-full items-center justify-center shadow-lg mb-2"
            activeOpacity={0.8}
            onPress={() => setModalVisible(true)}
          >
            <Plus color="white" size={32} />
          </TouchableOpacity>
        </View>

        {/* Animals */}
        <TouchableOpacity onPress={() => onNavigate('technician.animals')} className="items-center justify-center flex-1 gap-1">
          <Dog color={isFocused('technician.animals') ? activeColor : inactiveColor} size={24} strokeWidth={2} />
          <Text className={`text-xs font-semibold ${isFocused('technician.animals') ? 'text-gray-800' : 'text-gray-400'}`}>Animals</Text>
        </TouchableOpacity>

        {/* Records */}
        <TouchableOpacity onPress={() => onNavigate('technician.records')} className="items-center justify-center flex-1 gap-1">
          <FileText color={isFocused('technician.records') ? activeColor : inactiveColor} size={24} strokeWidth={2} />
          <Text className={`text-xs font-semibold ${isFocused('technician.records') ? 'text-gray-800' : 'text-gray-400'}`}>Records</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
};

export default BottomNavigator;