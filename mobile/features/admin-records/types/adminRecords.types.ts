export interface RecordAnimal {
  _id: string;
  earTag?: string;
  animalId?: string;
}

export interface RecordFarmer {
  _id: string;
  name: string;
}

export interface InseminationRecord {
  _id: string;
  animalId?: RecordAnimal;
  farmerId?: RecordFarmer;
  inseminationDate?: string;
  sireCode?: string;
  status?: string;
  createdAt?: string;
}

export interface PregnancyRecord {
  _id: string;
  animalId?: RecordAnimal;
  farmerId?: RecordFarmer;
  pregnancyDiagnosis?: {
    date?: string;
    result?: string;
  };
  createdAt?: string;
}

export interface CalvingRecord {
  _id: string;
  animalId?: RecordAnimal;
  farmerId?: RecordFarmer;
  date?: string;
  calfSex?: string;
  createdAt?: string;
}
