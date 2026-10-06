import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFarmerOnboarding } from "@/features/farmer-onboarding/FarmerOnboardingContext";
import { getNextFarmerOnboardingStep } from "@/features/farmer-onboarding/utils/farmerOnboarding";
import { useTheme } from "@/lib/theme";

const pages = [
  {
    title: "Your Animals",
    description: "Keep your livestock records in one place.",
    image: require("../../assets/images/onboarding_farmer_illustrations/youranimals.png"),
  },
  {
    title: "Request Services",
    description: "Need assistance from the Municipal Agriculture Office?",
    image: require("../../assets/images/onboarding_farmer_illustrations/requestservice.png"),
  },
  {
    title: "Track Your Requests",
    description: "See what is happening after you submit a request.",
    image: require("../../assets/images/onboarding_farmer_illustrations/trackyourequest.png"),
  },
  {
    title: "Your Records",
    description: "Completed services stay available in BreedSmart.",
    image: require("../../assets/images/onboarding_farmer_illustrations/yourrecords.png"),
  },
] as const;

export default function FarmerOnboardingScreen() {
  const { complete } = useFarmerOnboarding();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const page = pages[step];
  const illustrationSize = Math.min(width - 48, height * 0.38, 300);

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    await complete();
  };

  const next = () => {
    const nextStep = getNextFarmerOnboardingStep(step, pages.length);
    if (nextStep === null) {
      void finish();
    } else {
      setStep(nextStep);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }}>
      <View style={{ paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Image
            source={require("../../assets/images/breedsmart-brand-icon.png")}
            contentFit="contain"
            accessibilityLabel="BreedSmart icon"
            style={{ width: 36, height: 36 }}
          />
          <Text style={{ color: colors.primary, fontFamily: "Outfit_800ExtraBold", fontSize: 22 }}>BreedSmart</Text>
        </View>
        <Pressable
          onPress={() => void finish()}
          disabled={finishing}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          style={{ minWidth: 48, minHeight: 44, alignItems: "flex-end", justifyContent: "center" }}
        >
          <Text style={{ color: colors.primary, fontFamily: "Outfit_700Bold", fontSize: 15 }}>Skip</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <Image
          source={page.image}
          contentFit="contain"
          accessibilityLabel={`${page.title} illustration`}
          style={{ width: illustrationSize, height: illustrationSize }}
        />
        <Text style={{ marginTop: 12, textAlign: "center", color: colors.textPrimary, fontFamily: "Outfit_800ExtraBold", fontSize: 28 }}>
          {page.title}
        </Text>
        <Text style={{ marginTop: 10, maxWidth: 310, textAlign: "center", color: colors.textSecondary, fontFamily: "Outfit_400Regular", fontSize: 16, lineHeight: 23 }}>
          {page.description}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 24, gap: 22 }}>
        <View accessibilityLabel={`Page ${step + 1} of ${pages.length}`} style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
          {pages.map((item, index) => (
            <View key={item.title} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: index === step ? colors.primary : colors.border }} />
          ))}
        </View>
        <Pressable
          onPress={next}
          disabled={finishing}
          accessibilityRole="button"
          accessibilityLabel={step === pages.length - 1 ? "Get Started" : "Next"}
          style={{ minHeight: 54, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: colors.onPrimary, fontFamily: "Outfit_700Bold", fontSize: 17 }}>
            {step === pages.length - 1 ? "Get Started" : "Next  ›"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
