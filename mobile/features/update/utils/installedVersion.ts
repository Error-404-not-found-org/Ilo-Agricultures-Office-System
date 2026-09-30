export function getUpToDateMessage(message: string, version: string | null): string {
  return version ? `${message} (v${version})` : message;
}

export function getInstalledVersionLabel(label: string, version: string | null): string {
  return version ? `${label} ${version}` : label;
}
