export type HeaderSyncDestination =
  | "/(farmer)/sync-center"
  | "/(technician)/sync-history";

export function getHeaderSyncDestination(
  segments: readonly string[],
): HeaderSyncDestination | null {
  if (segments.includes("(admin)")) return null;
  if (segments.includes("(technician)")) {
    return "/(technician)/sync-history";
  }
  if (segments.includes("(farmer)")) return "/(farmer)/sync-center";
  return null;
}
