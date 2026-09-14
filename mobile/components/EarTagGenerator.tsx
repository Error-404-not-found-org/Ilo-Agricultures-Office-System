import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { Sparkles } from "lucide-react-native";
import { toast } from "sonner-native";
import { generateEarTagSuggestion, getEarTagValidationError } from "./earTagSuggestion";

interface EarTagGeneratorProps {
  farmerName?: string;
  existingEarTags?: (string | null | undefined)[];
  onGenerate: (tag: string) => void;
  isDark?: boolean;
}

export default function EarTagGenerator({
  farmerName,
  existingEarTags = [],
  onGenerate,
  isDark,
}: EarTagGeneratorProps) {
  const lastClickRef = React.useRef<number>(0);

  const handleGenerate = () => {
    const now = Date.now();
    if (now - lastClickRef.current < 2000) {
      return; // Silently ignore spam clicks to prevent toast pileup
    }
    lastClickRef.current = now;

    if (!farmerName) {
      toast.error("Please select a client/owner first.");
      return;
    }

    const generatedTag = generateEarTagSuggestion({
      farmerName,
      existingEarTags,
    });

    const validationError = getEarTagValidationError(generatedTag);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    onGenerate(generatedTag);
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
