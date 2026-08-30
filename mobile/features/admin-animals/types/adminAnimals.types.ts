export interface AnimalItem {
  _id: string;
  animalId?: string;
  earTag?: string;
  species?: string;
  breed?: string;
  farmerId?: {
    _id: string;
    name: string;
    address?: {
      barangay?: string;
    };
  };
  reproductiveStatus?: string;
}

export interface AnimalRegistrySummary {
  total: number;
  cattle: number;
  pregnant: number;
  available: number;
}

export interface AnimalsResponse {
  animals: AnimalItem[];
  total: number;
  pages: number;
  summary: AnimalRegistrySummary;
}
