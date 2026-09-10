export const TECHNICIAN_RECORDS_TARGET = {
  pathname: "/(technician)/(tabs)/technician.records",
} as const;

type ConfirmedHealthResponseSubmission<T> = {
  submit: () => Promise<T>;
  refresh: () => Promise<void>;
  acknowledge: () => void;
  navigate: () => void;
};

export async function runConfirmedHealthResponseSubmission<T>({
  submit,
  refresh,
  acknowledge,
  navigate,
}: ConfirmedHealthResponseSubmission<T>) {
  const response = await submit();
  await refresh();
  acknowledge();
  navigate();
  return response;
}
