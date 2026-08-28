export const getAuthoritativeReproductiveStatus = (animal: any) =>
  String(
    animal?.effectiveReproductiveStatus ||
      animal?.reproductiveStatus ||
      "",
  );

export const isBackendPostpartumRecovery = (animal: any) =>
  animal?.nextAction?.phase === "RECOVERY_PERIOD" ||
  animal?.nextAction?.type === "WAIT_FOR_POSTPARTUM_RECOVERY";

export const shouldUseLegacyPostpartumFallback = (animal: any) =>
  !animal?.effectiveReproductiveStatus;