export function getUpToDateMessage(message: string, version: string | null): string {
  return version ? `${message} (v${version})` : message;
}
