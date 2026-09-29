export function requireApiUrl(value: string | undefined): string {
  const url = value?.trim();
  if (!url) throw new Error('Missing EXPO_PUBLIC_API_URL');
  return url;
}
