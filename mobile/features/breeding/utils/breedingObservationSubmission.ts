import type { BreedingObservationPayload } from "../services/breedingObservation.service";

type SubmissionLock = { current: boolean };

type QueryInvalidator = {
  invalidateQueries: (filters: {
    queryKey: readonly unknown[];
  }) => Promise<unknown>;
};

type RunSingleSubmissionOptions<T> = {
  lock: SubmissionLock;
  submit: () => Promise<T>;
  onSuccess: (result: T) => void | Promise<void>;
  onError: (error: unknown) => void | Promise<void>;
};

export const createBreedingObservationSubmissionFingerprint = (
  requestId: string,
  payload: BreedingObservationPayload,
) => JSON.stringify({ requestId, payload });

export const createBreedingObservationIdempotencyKey = () =>
  `farmer-observation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function invalidateBreedingObservationQueries(
  queryClient: QueryInvalidator,
  animalId?: string,
) {
  const queryKeys: readonly (readonly unknown[])[] = [
    ...(animalId
      ? [
          ["animal", animalId] as const,
          ["animal", animalId, "pregnancy-tracker"] as const,
          ["animals", "detail", animalId] as const,
        ]
      : []),
    ["animal-records"],
    ["ai-requests"],
    ["farmer", "ai-requests"],
    ["user", "milestones"],
    ["breeding-milestones"],
  ];

  void Promise.allSettled(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

export async function runSingleBreedingObservationSubmission<T>({
  lock,
  submit,
  onSuccess,
  onError,
}: RunSingleSubmissionOptions<T>): Promise<boolean> {
  if (lock.current) return false;

  lock.current = true;
  try {
    const result = await submit();
    await onSuccess(result);
    return true;
  } catch (error) {
    await onError(error);
    return false;
  } finally {
    lock.current = false;
  }
}
