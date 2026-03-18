import { View, Text, TouchableOpacity, ScrollView, StatusBar, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, CalendarClock, Syringe, Info, CheckCircle2 } from 'lucide-react-native';

const MOCK_NOTIFICATIONS = [
  { id: '1', title: 'Insemination Approved', message: 'Your request for Cow # 1 has been approved by the technician.', time: '2h ago', type: 'success', isRead: false },
  { id: '2', title: 'Upcoming Pregnancy Check', message: 'Cow # 4 is due for a pregnancy check tommorow.', time: '5h ago', type: 'alert', isRead: false },
  { id: '3', title: 'System Maintenance', message: 'The app will be down for 30 minutes tonight at 11PM for an upgrade.', time: '1d ago', type: 'system', isRead: true },
  { id: '4', title: 'New Technician Assigned', message: 'Maria has been assigned as your regional technician.', time: '2d ago', type: 'info', isRead: true },
];

export default function NotificationsScreen() {
  const router = useRouter();

  const getIcon = (type: string) => {
    switch (type) {
        case 'success': return <View className="w-12 h-12 bg-emerald-100 rounded-full items-center justify-center"><CheckCircle2 size={24} color="#059669" /></View>;
        case 'alert': return <View className="w-12 h-12 bg-amber-100 rounded-full items-center justify-center"><CalendarClock size={24} color="#D97706" /></View>;
        case 'system': return <View className="w-12 h-12 bg-slate-100 rounded-full items-center justify-center"><Bell size={24} color="#475569" /></View>;
        default: return <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center"><Info size={24} color="#2563EB" /></View>;
    }
  };

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <StatusBar barStyle="light-content" />
      
      {/* Absolute Green Top Background */}
      <View className="absolute top-0 left-0 right-0 h-[180px] bg-[#00643B]" />

      {/* Header Area */}
      <View className="pt-14 px-6 mb-6 flex-row items-center justify-between">
          <TouchableOpacity 
              onPress={() => router.back()} 
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          >
              <ArrowLeft size={22} color="white" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-white tracking-wide">Notifications</Text>
          <View className="w-10" /> 
      </View>

      {/* Overlapping White Curve Card */}
      <View 
        className="flex-1 bg-[#F9FAFB] rounded-t-[32px] px-6 pt-8 shadow-lg"
        style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 8 }}
      >
        <View className="flex-row justify-between items-center mb-6">
            <Text className="text-[20px] font-bold text-slate-800">Recent Updates</Text>
            <TouchableOpacity>
                <Text className="text-emerald-700 font-bold text-sm">Mark all as read</Text>
            </TouchableOpacity>
        </View>

        {MOCK_NOTIFICATIONS.length > 0 ? (
            <FlatList 
                data={MOCK_NOTIFICATIONS}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        activeOpacity={0.7}
                        className={`flex-row p-4 mb-3 rounded-2xl border ${item.isRead ? 'bg-white border-slate-100' : 'bg-emerald-50/50 border-emerald-100'}`}
                    >
                        {getIcon(item.type)}
                        
                        <View className="flex-1 ml-4 justify-center">
                            <View className="flex-row justify-between items-start mb-1">
                                <Text className={`text-base font-bold ${item.isRead ? 'text-slate-800' : 'text-slate-900'}`}>{item.title}</Text>
                                {!item.isRead && <View className="w-2.5 h-2.5 bg-emerald-500 rounded-full mt-1.5" />}
                            </View>
                            <Text className={`text-[13px] leading-5 ${item.isRead ? 'text-slate-500' : 'text-slate-600 font-medium'}`}>{item.message}</Text>
                            <Text className="text-slate-400 text-xs mt-2 font-medium">{item.time}</Text>
                        </View>
                    </TouchableOpacity>
                )}
            />
        ) : (
            <View className="flex-1 items-center justify-center opacity-50 pb-20">
                <Bell size={64} color="#94a3b8" />
                <Text className="text-slate-500 font-medium text-lg mt-4">You're all caught up!</Text>
            </View>
        )}
      </View>
    </View>
  );
}