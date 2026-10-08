// Anchors are selected-month accomplishments; context is authorized history only.
export function buildUnaipMonthlyRows(report) {
  const aiById = new Map((report.context?.artificialInsemination ?? []).map((ai) => [ai.recordId, ai]));
  const pdById = new Map((report.context?.pregnancyDiagnosis ?? []).map((pd) => [pd.recordId, pd]));
  const records = report.records ?? [];

  if (report.serviceType === "ai") {
    return records.map((ai) => ({ type: "AI", ai, pd: null, calving: null }));
  }
  if (report.serviceType === "pregnancy") {
    return records.map((pd) => ({
      type: "PD", ai: aiById.get(pd.linkedInseminationId) ?? null, pd, calving: null,
    }));
  }
  if (report.serviceType === "calving") {
    return records.map((calving) => {
      const pd = pdById.get(calving.linkedPregnancyId) ?? null;
      const conflict = pd && calving.linkedInseminationId && pd.linkedInseminationId &&
        calving.linkedInseminationId !== pd.linkedInseminationId;
      const aiId = calving.linkedInseminationId || pd?.linkedInseminationId;
      return {
        type: "CD",
        ai: conflict ? null : aiById.get(aiId) ?? null,
        pd: conflict ? null : pd,
        calving,
      };
    });
  }
  return [];
}
