export const TECHNICIAN_MY_WORK_COMPLETED_TARGET = {
  pathname: "/(technician)/(tabs)/technician.requests",
  params: {
    section: "myWork",
    workState: "completed",
  },
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
