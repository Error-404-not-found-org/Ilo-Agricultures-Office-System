import React from "react";
import { AsyncState } from "@/features/farmer-ui/components";

interface EmptyClientsStateProps {
  loading: boolean;
}

export function EmptyClientsState({ loading }: EmptyClientsStateProps) {
  if (loading) {
    return <AsyncState state="loading" />;
  }

  return (
    <AsyncState
      state="empty"
      title="No farmers found"
      message="Try searching for a different name or changing the barangay filter."
    />
  );
}
