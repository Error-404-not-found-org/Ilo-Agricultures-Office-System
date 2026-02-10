import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { ArrowRight, Syringe, UserPlus, Activity } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SafeScreen from "@/components/safeScreen"
import Header from '@/components/Header';
import { useRouter } from 'expo-router';

// --- IMPORT THE BUTTON HERE ---
import { SignOutButton } from '../components/sign-out-button'; 

export default function HomeScreen() {

  const router = useRouter();

  return (
    <SafeScreen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 150 }}  // change it to 24 later after testing
        showsVerticalScrollIndicator={false}
      >

        {/* --- HEADER --- */}
        <Header />

        {/* --- HERO CARD --- */}
        <View className="mx-6 bg-slate-100 rounded-[32px] p-6 mb-8 shadow-sm">
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="text-lg font-bold text-slate-900">Pending Insemination</Text>
              <Text className="text-slate-500 text-sm mb-2">Today's Tasks</Text>
            </View>
            <View className="bg-white px-3 py-1 rounded-full">
              <Text className="text-xs font-bold text-slate-700">Today</Text>
              
            </View>
          </View>

          <Text className="text-7xl font-medium text-slate-900 mb-6 tracking-tighter">00</Text>

          <View className="flex-row justify-between border-t border-slate-300 pt-5">
            <StatItem label="Urgent" value="0" color="text-red-600" />
            <View className="w-[1px] h-full bg-slate-300" />
            <StatItem label="Routine" value="0" color="text-slate-900" />
            <View className="w-[1px] h-full bg-slate-300"   />
            <StatItem label="Follow-up" value="0" color="text-slate-900" />
          </View>
          
        </View>

        {/* --- ACTION GRID --- */}
        <View className="px-6 flex-row flex-wrap justify-between gap-y-4 mb-8">
          <ActionCard
            title="Animals Assigned"
            subtitle="View List"
            icon={<MaterialCommunityIcons name="cow" size={28} color="#1F2937" />}
          />
          <ActionCard
            title="Pregnancy Checks"
            subtitle="Due Date"
            icon={<Activity size={28} color="#1F2937" />}
          />
          <ActionCard
            title="Add Clients"
            subtitle="New Profile"
            onPress={() => router.push('/clients/register-client')}
            icon={<UserPlus size={28} color="#1F2937" />}
          />
          <ActionCard
            title="Record Result"
            subtitle="Log Completed"
            icon={<Syringe size={28} color="#1F2937" />}
          />
        </View>
{/* --- SIGN OUT BUTTON REMOVE LATER AFTER TESTTING--- */}
        <View className="px-6">
          <SignOutButton />
        </View>
        

      </ScrollView>
    </SafeScreen>
  );
}

// --- SUB COMPONENTS ---

const StatItem = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <View className="items-center flex-1">
    <Text className="text-slate-500 text-xs mb-1">{label}</Text>
    <Text className={`text-2xl font-semibold ${color}`}>{value}</Text>
  </View>
);

const ActionCard = ({ title, subtitle, icon, onPress }: { title: string, subtitle: string, icon: React.ReactNode, onPress? : () => void }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    className="w-[48%] bg-gray-100 rounded-[28px] p-5 justify-between min-h-[160px] border border-transparent active:border-gray-300"
    onPress={onPress}
  >
    <View>
      <View className="mb-4 bg-white self-start p-2 rounded-full shadow-sm">{icon}</View>
      <Text className="font-bold text-gray-900 text-[15px] leading-5 mb-1">{title}</Text>
      <Text className="text-gray-500 text-xs">{subtitle}</Text>
    </View>
    <View className="flex-row items-center justify-between mt-2">
      <Text className="text-gray-800 font-semibold text-sm">Check</Text>
      <ArrowRight size={18} color="#1F2937" />
    </View>
  </TouchableOpacity>
);