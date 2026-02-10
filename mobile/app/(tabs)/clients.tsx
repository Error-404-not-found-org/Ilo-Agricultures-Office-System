import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Search, Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import SafeScreen from '@/components/safeScreen'; 
import Header from '@/components/Header';

export default function ClientsScreen() {
  const router = useRouter();

  return (
    <SafeScreen>
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        
        {/* --- HEADER (Kept consistent with Home) --- */}
        <Header />

        {/* --- PAGE TITLE --- */}
        <Text className="text-3xl font-bold text-center text-black mb-8">
            Add New Entry
        </Text>

        {/* --- SELECTION CARDS --- */}
        <View className="px-6 gap-y-6">
            
            {/* Card 1: Register New Client */}
            <SelectionCard 
                title="Register New Client"
                subtitle="Use this to add new farm owner or client"
                // 1. Create a file at app/register-client.tsx for this to work
                onPress={() => router.push('/clients/register-client')} 
                icon={
                    // Custom composed icon (User + Plus)
                    <View className="flex-row items-end">
                        <MaterialCommunityIcons name="account-outline" size={64} color="black" />
                        <MaterialCommunityIcons name="plus" size={32} color="black" style={{ marginLeft: -15, marginBottom: 5 }} />
                    </View>
                }
            />

            {/* Card 2: Add Animal */}
            <SelectionCard 
                title="Add Animal to Existing Client"
                subtitle="Select a Client and Add a new Animal"
                // 2. Create a file at app/add-animal.tsx for this to work
                onPress={() => router.push('/clients/add-animal')}
                icon={
                    // Custom composed icon (Cow + Plus)
                    <View className="flex-row items-end">
                         {/* Using 'cow' icon to match the bull head style */}
                        <MaterialCommunityIcons name="cow" size={64} color="black" />
                        <MaterialCommunityIcons name="plus" size={32} color="black" style={{ marginLeft: -10, marginBottom: 5 }} />
                    </View>
                }
            />

        </View>

      </ScrollView>
    </SafeScreen>
  );
}

// --- REUSABLE BIG BUTTON COMPONENT ---
const SelectionCard = ({ title, subtitle, icon, onPress }: { title: string, subtitle: string, icon: React.ReactNode, onPress: () => void }) => (
    <TouchableOpacity 
        onPress={onPress}
        activeOpacity={0.8}
        // Tailwind classes to match the gray card look
        className="w-full bg-gray-200 rounded-[30px] p-8 h-[220px] justify-center shadow-sm"
    >
        {/* Icon Section */}
        <View className="mb-4 ml-[-5px]">
            {icon}
        </View>

        {/* Text Section */}
        <View>
            <Text className="text-xl font-bold text-black mb-2">
                {title}
            </Text>
            <Text className="text-gray-600 text-sm leading-5">
                {subtitle}
            </Text>
        </View>
    </TouchableOpacity>
);