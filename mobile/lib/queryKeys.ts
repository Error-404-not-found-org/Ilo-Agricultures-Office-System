export const userKeys = {
  all: ["user"] as const,
  me: () => [...userKeys.all, "me"] as const,
  activity: () => [...userKeys.all, "activity"] as const,
  milestones: () => [...userKeys.all, "milestones"] as const,
};

export const animalKeys = {
  all: ["animals"] as const,
  mine: () => [...animalKeys.all, "my-all"] as const,
  detail: (id: string) => [...animalKeys.all, "detail", id] as const,
  medical: (id: string) => ["medical", id] as const,
  timeline: (id: string) => ["animal-records", "timeline", id] as const,
};

export const breedingKeys = {
  tracker: (id: string) => ["animal", id, "pregnancy-tracker"] as const,
};

export const animalRecordKeys = {
  all: ["animal-records"] as const,
  timeline: (id: string) => [...animalRecordKeys.all, "timeline", id] as const,
  records: (id: string) => [...animalRecordKeys.all, "records", id] as const,
};

export const aiRequestKeys = {
  all: ["ai-requests"] as const,
  my: () => [...aiRequestKeys.all, "my"] as const,
  pendingOutcome: () => [...aiRequestKeys.all, "pending-outcome"] as const,
  detail: (id: string) => [...aiRequestKeys.all, "detail", id] as const,
  walkIn: () => [...aiRequestKeys.all, "walk-in"] as const,
};

export const healthRequestKeys = {
  all: ["health-requests"] as const,
  my: () => [...healthRequestKeys.all, "my"] as const,
  detail: (id: string) => [...healthRequestKeys.all, "detail", id] as const,
};

export const notificationKeys = {
  all: ["notifications"] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

export const technicianKeys = {
  all: ["technician"] as const,
  dashboard: () => [...technicianKeys.all, "dashboard"] as const,
  requests: () => [...technicianKeys.all, "requests"] as const,
  workQueue: () => [...technicianKeys.all, "work-queue"] as const,
  records: () => [...technicianKeys.all, "records"] as const,
  tasks: () => [...technicianKeys.all, "tasks"] as const,
  analytics: () => [...technicianKeys.all, "analytics"] as const,
  assignedFarmers: () => [...technicianKeys.all, "assigned-farmers"] as const,
  scheduledVisits: () => [...technicianKeys.all, "visits"] as const,
};

export const adminKeys = {
  all: ["admin"] as const,
  dashboard: () => [...adminKeys.all, "dashboard"] as const,
  users: () => [...adminKeys.all, "users"] as const,
  animals: () => [...adminKeys.all, "animals"] as const,
  records: () => [...adminKeys.all, "records"] as const,
};

export const taskKeys = {
  all: ["tasks"] as const,
  list: () => [...taskKeys.all, "list"] as const,
  detail: (id: string) => [...taskKeys.all, "detail", id] as const,
};
