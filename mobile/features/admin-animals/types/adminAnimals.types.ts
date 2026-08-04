export interface AnimalItem {
  _id: string;
  animalId?: string;
  earTag?: string;
  species?: string;
  breed?: string;
  farmerId?: {
    _id: string;
    name: string;
  };
}

export interface AnimalsResponse {
  animals: AnimalItem[];
  pages: number;
}
