import React from "react";
import { AsyncState } from "@/features/farmer-ui/components";

interface EmptyAnimalsStateProps {
  loading: boolean;
}

export function EmptyAnimalsState({ loading }: EmptyAnimalsStateProps) {
  if (loading) {
    return <AsyncState state="loading" />;
  }

  return (
    <AsyncState
      state="empty"
      title="No animals found"
      message="Try searching for a different ear tag, breed, or owner."
    />
  );
}
