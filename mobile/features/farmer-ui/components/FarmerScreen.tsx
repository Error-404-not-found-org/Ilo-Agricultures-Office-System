import React from "react";
import { type ScrollViewProps, type ViewProps } from "react-native";
import { ScreenLayout } from "@/components/ScreenLayout";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  bottomInset?: number;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
} & ViewProps;

export function FarmerScreen({ children, scroll = false, bottomInset = 112, contentContainerStyle, style, ...props }: Props) {
  return (
    <ScreenLayout
      scrollable={scroll}
      bottomInset={bottomInset}
      contentContainerStyle={contentContainerStyle}
      contentStyle={!scroll ? style : undefined}
      style={scroll ? style : undefined}
      edges={["left", "right"]}
      {...props}
    >
      {children}
    </ScreenLayout>
  );
}
