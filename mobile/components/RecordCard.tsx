import { View, Text, TouchableOpacity } from 'react-native';
import React from 'react';
import { ChevronRight } from 'lucide-react-native';

interface RecordCardProps {
  id: string;
  title: string;       // e.g., "Insemination #123"
  subtitle: string;    // e.g., "Farmer: John Doe"
  date: string;        // e.g., "Oct 24, 2023"
  status: string;      // e.g., "Pending", "Success"
  statusColor?: string; // e.g., "text-yellow-600", "text-green-600"
  onPress?: () => void;
}

const RecordCard = ({ title, subtitle, date, status, statusColor = "text-gray-600", onPress }: RecordCardProps) => {
  return (
    <TouchableOpacity 
      activeOpacity={0.7}
      onPress={onPress}
      className="bg-white p-4 rounded-2xl mb-3 border border-gray-100 shadow-sm flex-row items-center justify-between"
    >
      <View className="flex-1">
        <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-gray-400 font-medium uppercase">{date}</Text>
            <Text className={`text-xs font-bold uppercase ${statusColor}`}>{status}</Text>
        </View>
        <Text className="text-base font-bold text-gray-900 mb-0.5" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-sm text-gray-500" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      
      <View className="pl-3">
        <ChevronRight size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
};

export default RecordCard;
