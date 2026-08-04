import { useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { useApi } from "@/lib/api";
import { useTechnicianAnimal } from "@/features/technician/hooks/useTechnicianAnimal";
import { toast } from "sonner-native";

export function useAnimalContext() {
  const api = useApi();
  const params = useLocalSearchParams();

  // Support both animalId and motherId params
  const animalIdParam = (params.animalId || params.motherId) as string;
  const farmerIdParam = params.farmerId as string;
  const requestIdParam = params.requestId as string;
  const taskIdParam = params.taskId as string;
  const pregnancyIdParam = params.pregnancyId as string;
  const sourceParam = params.source as string; // 'dashboard' | 'animal-profile' | 'request' | 'fab'

  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<any>(null);
  const [animals, setAnimals] = useState<any[]>([]);
  const [loadingAnimals, setLoadingAnimals] = useState(false);

  // If there's an initial animalIdParam, the context is locked.
  const isLocked = !!animalIdParam;

  // 1. Fetch details of initial animal/mother if present
  const { animalDetailsQuery } = useTechnicianAnimal(animalIdParam);

  useEffect(() => {
    if (animalIdParam && animalDetailsQuery.data) {
      const animalData = animalDetailsQuery.data;
      setSelectedAnimal(animalData);
      if (animalData.farmerId) {
        setSelectedFarmer(animalData.farmerId);
      }
    }
  }, [animalIdParam, animalDetailsQuery.data]);

  // 2. Fetch list of animals when a farmer is selected
  useEffect(() => {
    const fetchAnimals = async () => {
      if (!selectedFarmer?._id) {
        setAnimals([]);
        return;
      }
      // If context is locked, we don't need to load the other animals of the farmer.
      if (isLocked) return;

      setLoadingAnimals(true);
      try {
        const res = await api.get(`/animals/farmer/${selectedFarmer._id}`);
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setAnimals(list);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load farmer animals");
      } finally {
        setLoadingAnimals(false);
      }
    };

    fetchAnimals();
  }, [selectedFarmer?._id, isLocked, api]);

  const handleClearContext = () => {
    if (isLocked) return; // Cannot clear locked context
    setSelectedAnimal(null);
  };

  const handleClearAll = () => {
    if (isLocked) return;
    setSelectedAnimal(null);
    setSelectedFarmer(null);
    setAnimals([]);
  };

  return {
    selectedFarmer,
    setSelectedFarmer,
    selectedAnimal,
    setSelectedAnimal,
    animals,
    loadingAnimals,
    isLocked,
    requestId: requestIdParam,
    taskId: taskIdParam,
    pregnancyId: pregnancyIdParam,
    source: sourceParam,
    handleClearContext,
    handleClearAll,
  };
}
