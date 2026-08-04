import React, { ReactNode } from 'react';
import { ScreenLayout } from "@/components/ScreenLayout";

const SafeScreen = ({ children }: { children: ReactNode }) => {
  return (
    <ScreenLayout edges={["top", "bottom", "left", "right"]}>
      {children}
    </ScreenLayout>
  );
};

export default SafeScreen;
