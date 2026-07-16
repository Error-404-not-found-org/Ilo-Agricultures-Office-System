export interface AnimalOwner {
  _id: string;
  name: string;
}

export interface Animal {
  _id: string;
  earTag?: string;
  animalId?: string;
  species?: string;
  breed?: string;
  imageUrl?: string;
  reproductiveStatus?: string;
  farmerId?: AnimalOwner;
  farmer?: string;
}

export interface AnimalsFetchParams {
  page: number;
  limit: number;
  search: string;
  city?: string;
  barangay?: string;
  reproductiveStatus?: string;
}

export interface AnimalsResponse {
  animals: Animal[];
  total: number;
  pages: number;
}
