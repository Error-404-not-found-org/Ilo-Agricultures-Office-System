import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { getFarmerOfficialRecordDetail } from "../services/farmerReports.service";
import type { OfficialRecordKind } from "../types/farmerReports.types";

type OfficialRecordDetailParams = {
  animalId?: string;
  sourceId?: string;
  sourceKind?: OfficialRecordKind;
};

export const useOfficialRecordDetail = ({
  animalId,
  sourceId,
  sourceKind,
}: OfficialRecordDetailParams) => {
  const api = useApi();

  return useQuery({
    queryKey: [
      "farmer",
      "official-record-detail",
      animalId,
      sourceKind,
      sourceId,
    ],
    queryFn: () =>
      getFarmerOfficialRecordDetail(
        api,
        animalId || "",
        sourceKind as OfficialRecordKind,
        sourceId || "",
      ),
    enabled: Boolean(animalId && sourceId && sourceKind),
    staleTime: 30_000,
  });
};
