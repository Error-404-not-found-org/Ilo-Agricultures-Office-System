import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { Sparkles } from "lucide-react-native";
import { toast } from "sonner-native";

interface EarTagGeneratorProps {
  farmerName?: string;
  animalCount: number;
  onGenerate: (tag: string) => void;
  isDark?: boolean;
}

export default function EarTagGenerator({
  farmerName,
  animalCount,
  onGenerate,
  isDark,
}: EarTagGeneratorProps) {
  const handleGenerate = () => {
    if (!farmerName) {
      toast.error("Please select a client/owner first.");
      return;
    }

    const nameParts = farmerName.trim().toUpperCase().split(/\s+/);
    let initials = "";
    if (nameParts.length > 1) {
      initials = nameParts[0][0] + nameParts[nameParts.length - 1][0];
    } else if (nameParts.length > 0 && nameParts[0].length > 0) {
      initials = nameParts[0][0];
    }

    const nextNum = (animalCount || 0) + 1;
    const numStr = nextNum.toString().padStart(2, "0");
    const generatedTag = `${numStr}${initials}`;

    onGenerate(generatedTag);
    toast.success(`Generated tag: ${generatedTag}`);
  };

  return (
    <TouchableOpacity
      onPress={handleGenerate}
      className={`flex-row items-center justify-center px-2 py-1 rounded-lg border ${
        isDark
          ? "bg-green-950/30 border-green-800/50"
          : "bg-green-50 border-green-200"
      }`}
      style={{ alignSelf: "flex-start" }}
    >
      <Sparkles
        size={10}
        color={isDark ? "#86efac" : "#15803d"}
        style={{ marginRight: 4 }}
      />
      <Text
        className={`font-outfit-bold text-[9px] uppercase tracking-wider ${
          isDark ? "text-green-300" : "text-green-900"
        }`}
      >
        Generate TAG
      </Text>
    </TouchableOpacity>
  );
}
