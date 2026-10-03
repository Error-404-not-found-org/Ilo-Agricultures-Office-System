export const ATTACHMENT_LIMIT = 5;
// The server accepts at most 10 MiB of JSON. Measure the whole encoded body,
// including Health's compatibility imageUrl, and reserve 2 MiB of headroom.
export const ATTACHMENT_PAYLOAD_BUDGET_BYTES = 8 * 1024 * 1024;
export const ATTACHMENT_TOO_LARGE_MESSAGE =
  "These photos are too large to upload together. Remove a photo or choose smaller images.";

export type RequestAttachment = {
  uri: string;
  base64: string;
  assetKey?: string;
};

export const remainingAttachmentSlots = (count: number) =>
  Math.max(0, ATTACHMENT_LIMIT - count);

export const getAttachmentAssetKey = (asset: { assetId?: string | null; uri: string }) =>
  asset.assetId ? `id:${asset.assetId}` : `uri:${asset.uri}`;

export const mergeAttachmentImages = <T extends RequestAttachment>(
  existing: T[],
  added: T[],
): T[] => {
  const seen = new Set(existing.map((item) => item.assetKey).filter(Boolean));
  const result = [...existing];
  for (const item of added) {
    if (result.length >= ATTACHMENT_LIMIT) break;
    if (item.assetKey && seen.has(item.assetKey)) continue;
    if (item.assetKey) seen.add(item.assetKey);
    result.push(item);
  }
  return result;
};

const utf8ByteLength = (value: string) => {
  let bytes = 0;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      bytes += 4;
      index++;
    } else bytes += 3;
  }
  return bytes;
};

export const getAttachmentPayloadError = (payload: unknown): string | null => {
  const encoded = JSON.stringify(payload);
  return utf8ByteLength(encoded) > ATTACHMENT_PAYLOAD_BUDGET_BYTES
    ? ATTACHMENT_TOO_LARGE_MESSAGE
    : null;
};
