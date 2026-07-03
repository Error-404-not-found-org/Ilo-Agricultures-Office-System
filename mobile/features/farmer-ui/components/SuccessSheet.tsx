import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

export function SuccessSheet({ visible, title, message, actionLabel = "Done", onClose }: { visible: boolean; title: string; message: string; actionLabel?: string; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end"><View className="p-6 pb-10 items-center" style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}><View className="w-14 h-14 rounded-full items-center justify-center" style={{ backgroundColor: colors.tint }}><CheckCircle2 size={30} color={colors.primary} /></View><Text className="mt-4 text-center" style={{ color: colors.textPrimary, fontFamily: "Outfit_700Bold", fontSize: 19 }}>{title}</Text><Text className="mt-2 text-center" style={{ color: colors.textSecondary, fontFamily: "Outfit_500Medium", fontSize: 13, lineHeight: 19 }}>{message}</Text><TouchableOpacity onPress={onClose} className="w-full py-3.5 mt-6 items-center" style={{ borderRadius: 8, backgroundColor: colors.primary }}><Text className="text-white" style={{ fontFamily: "Outfit_700Bold", fontSize: 13 }}>{actionLabel}</Text></TouchableOpacity></View></View>
    </Modal>
  );
}
