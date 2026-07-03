import React from "react";
import { ScrollView, View, type ScrollViewProps, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  bottomInset?: number;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
} & ViewProps;

export function FarmerScreen({ children, scroll = false, bottomInset = 112, contentContainerStyle, style, ...props }: Props) {
  const { colors } = useTheme();
  const content = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[{ paddingBottom: bottomInset }, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  ) : children;

  return (
    <SafeAreaView edges={["left", "right"]} style={[{ flex: 1, backgroundColor: colors.background }, style]} {...props}>
      {content}
    </SafeAreaView>
  );
}
