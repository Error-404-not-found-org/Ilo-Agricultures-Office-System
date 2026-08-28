export type EstrusType = "Natural" | "Synchronized" | "Induced";
export type PreviousAIEntryMode = "history_only" | "continue_tracking";

export interface AIRecordingValues {
  inseminationDate: Date;
  inseminationTime: Date;
  estrus: EstrusType | "";
  sireBreed: string;
  sireCode: string;
  semenDosesUsed: string;
  technicianNote: string;
}

export interface NormalizedInseminationDetails {
  inseminationDate: string;
  time: string;
  estrus: EstrusType;
  sireBreed: string;
  sireCode: string;
  semenDosesUsed: number;
  technicianNote?: string;
}

export interface SelectedFarmer {
  _id: string;
  name: string;
  phoneNumber?: string | null;
  address?: any;
  [key: string]: any;
}

export interface SelectedAnimal {
  _id: string;
  name?: string;
  animalId?: string;
  earTag?: string;
  breed?: string;
  species?: string;
  gender?: string;
  sex?: string;
  reproductiveStatus?: string;
  birthDate?: string;
  farmerId?: string | { _id?: string };
  [key: string]: any;
}

export interface RequestLinkedContext {
  workflowId: string;
  farmer: SelectedFarmer;
  animal: SelectedAnimal;
  scheduledDate: string | null;
  visitPeriod: "morning" | "afternoon" | null;
  heatSigns: string[];
  farmerNotes: string[];
  attachmentUrls: string[];
  requestKind: "initial_ai" | "re_insemination";
  attemptNumber: number | null;
  previousAttempt: {
    id: string;
    attemptNumber: number | null;
    inseminationDate: string | null;
    outcome: string | null;
  } | null;
  status: string;
  raw: any;
}

export interface RouteDisplayFallback {
  farmerName?: string;
  animalName?: string;
  earTag?: string;
  scheduleDate?: string;
  visitPeriod?: string;
}

export type RecordAIRouteMode =
  | {
      kind: "request-linked";
      workflowId: string;
      taskId?: string;
      routeFarmerId?: string;
      routeAnimalId?: string;
      fallback: RouteDisplayFallback;
    }
  | {
      kind: "direct";
      source?: string;
      farmerId?: string;
      animalId?: string;
    }
  | {
      kind: "invalid";
      message: string;
      fallback: RouteDisplayFallback;
    };

export interface ReviewSnapshot {
  farmer: SelectedFarmer;
  animal: SelectedAnimal;
  details: NormalizedInseminationDetails;
}

export interface RequestLinkedInseminationPayload {
  farmerId: string;
  animalId: string;
  requestId: string;
  taskId?: string;
  inseminationDetails: NormalizedInseminationDetails;
}

export interface DirectInseminationPayload {
  farmerId: string;
  animalId: string;
  animalDetails: null;
  inseminationDetails: NormalizedInseminationDetails & { status: "done" };
}

export interface PreviousInseminationPayload extends DirectInseminationPayload {
  entryMode: PreviousAIEntryMode;
}
