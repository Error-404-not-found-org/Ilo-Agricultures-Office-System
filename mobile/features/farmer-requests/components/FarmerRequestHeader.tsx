import React from "react";
import { AppPageHeader } from "@/components/AppPageHeader";

type FarmerRequestHeaderProps = {
  title: string;
  includeSafeTop?: boolean;
  onBack?: () => void;
};

export function FarmerRequestHeader({
  title,
  includeSafeTop = true,
  onBack,
}: FarmerRequestHeaderProps) {
  return <AppPageHeader title={title} includeSafeTop={includeSafeTop} onBack={onBack} />;
}
