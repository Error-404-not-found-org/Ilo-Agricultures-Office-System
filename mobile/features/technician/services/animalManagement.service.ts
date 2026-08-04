import { AxiosInstance } from "axios";

export interface UpdateAnimalWizardPayload {
  animalId?: string;
  earTag?: string;
  brand?: string;
  species: string;
  breed: string;
  color?: string;
  imageUrl?: string | null;
  birthDate: string;
  
  aiDate?: string;
  noOfAI?: string;
  estrusType?: string;
  sireBreed?: string;
  sireCode?: string;

  pdDate?: string;
  pdResult?: string;
  
  calfDate?: string;
  calfId?: string;
  calfSex?: string;
  calvingEase?: string;
}

export const getAnimalsAll = async (
  api: AxiosInstance,
  { page, limit, search }: { page: number; limit: number; search: string }
) => {
  const response = await api.get("/animals/all", {
    params: {
      page,
      limit,
      search: search || undefined,
    },
  });
  return response.data || { animals: [], total: 0, pages: 1 };
};

export const getAnimalDetails = async (api: AxiosInstance, id: string) => {
  const response = await api.get(`/animals/${id}`);
  return response.data;
};

export const getAnimalMedicalRecords = async (api: AxiosInstance, id: string) => {
  const response = await api.get(`/medical/${id}`);
  return Array.isArray(response.data) ? response.data : response.data?.data || [];
};

export const deleteAnimal = async (api: AxiosInstance, id: string) => {
  const response = await api.delete(`/animals/${id}`);
  return response.data;
};

export const updateAnimalWizard = async (
  api: AxiosInstance,
  id: string,
  payload: UpdateAnimalWizardPayload
) => {
  const response = await api.put(`/animals/wizard/${id}`, payload);
  return response.data;
};

export const getAnimalsByFarmer = async (api: AxiosInstance, farmerId: string) => {
  const response = await api.get(`/animals/farmer/${farmerId}`);
  return response.data || [];
};
