import React from "react";
import { AppPageHeader } from "@/components/AppPageHeader";

type FarmerRequestHeaderProps = {
  title: string;
  includeSafeTop?: boolean;
  onBack?: () => void;
  showBackButton?: boolean;
};

export function FarmerRequestHeader({
  title,
  includeSafeTop = true,
  onBack,
  showBackButton = true,
}: FarmerRequestHeaderProps) {
  return (
    <AppPageHeader
      title={title}
      includeSafeTop={includeSafeTop}
      onBack={onBack}
      showBackButton={showBackButton}
    />
  );
}
