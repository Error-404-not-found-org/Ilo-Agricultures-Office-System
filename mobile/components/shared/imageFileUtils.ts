import * as FileSystem from "expo-file-system/legacy";

const MIME_BY_EXTENSION: Record<string, string> = {
  gif: "image/gif",
  heic: "image/heic",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

type PreparedImageFile = {
  localUri: string;
  fileName: string;
  mimeType: string;
};

function sanitizeImageFileName(value: string) {
  return value
    .trim()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function getImageFileDetails(uri: string, explicitMimeType?: string | null) {
  const dataUriMimeType = uri
    .match(/^data:(image\/[a-z0-9.+-]+);base64,/i)?.[1]
    ?.toLowerCase();
  const mimeType = explicitMimeType
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  const uriExtension = uri
    .split(/[?#]/, 1)[0]
    .match(/\.([a-z0-9]+)$/i)?.[1]
    ?.toLowerCase()
    .replace("jpeg", "jpg");
  const mimeExtension = (mimeType || dataUriMimeType)
    ?.split("/")[1]
    ?.replace("jpeg", "jpg");
  const extension =
    (mimeExtension && MIME_BY_EXTENSION[mimeExtension]
      ? mimeExtension
      : null) ||
    (uriExtension && MIME_BY_EXTENSION[uriExtension] ? uriExtension : "jpg");

  return {
    extension,
    mimeType:
      (mimeType?.startsWith("image/") ? mimeType : dataUriMimeType) ||
      MIME_BY_EXTENSION[extension],
  };
}

function requireCacheDirectory() {
  if (!FileSystem.cacheDirectory) {
    throw new Error("Temporary photo storage is not available.");
  }
  return FileSystem.cacheDirectory;
}

async function replaceFile(destination: string) {
  await FileSystem.deleteAsync(destination, { idempotent: true });
}

export async function prepareImageFile(
  uri: string,
  preferredFileName = "photo-evidence",
): Promise<PreparedImageFile> {
  const sourceUri = uri.trim();
  if (!sourceUri) throw new Error("This photo is not available.");

  const cacheDirectory = requireCacheDirectory();
  const safeName = sanitizeImageFileName(preferredFileName) || "photo-evidence";

  if (sourceUri.startsWith("data:")) {
    const details = getImageFileDetails(sourceUri);
    const payload = sourceUri.split(",", 2)[1];
    if (!payload) throw new Error("This photo could not be prepared.");

    const fileName = `${safeName}.${details.extension}`;
    const localUri = `${cacheDirectory}${fileName}`;
    await replaceFile(localUri);
    await FileSystem.writeAsStringAsync(localUri, payload, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { localUri, fileName, mimeType: details.mimeType };
  }

  if (/^https?:\/\//i.test(sourceUri)) {
    const temporaryUri = `${cacheDirectory}${safeName}.download`;
    await replaceFile(temporaryUri);
    const result = await FileSystem.downloadAsync(sourceUri, temporaryUri);
    if (result.status < 200 || result.status >= 300) {
      await replaceFile(temporaryUri);
      throw new Error("This photo could not be downloaded.");
    }

    const contentTypeEntry = Object.entries(result.headers || {}).find(
      ([key]) => key.toLowerCase() === "content-type",
    );
    const details = getImageFileDetails(sourceUri, contentTypeEntry?.[1]);
    const fileName = `${safeName}.${details.extension}`;
    const localUri = `${cacheDirectory}${fileName}`;
    await replaceFile(localUri);
    await FileSystem.moveAsync({ from: temporaryUri, to: localUri });

    return { localUri, fileName, mimeType: details.mimeType };
  }

  if (sourceUri.startsWith("file://")) {
    const info = await FileSystem.getInfoAsync(sourceUri);
    if (!info.exists) throw new Error("This local photo is no longer available.");

    const details = getImageFileDetails(sourceUri);
    const fileName = `${safeName}.${details.extension}`;
    const localUri = `${cacheDirectory}${fileName}`;
    if (sourceUri !== localUri) {
      await replaceFile(localUri);
      await FileSystem.copyAsync({ from: sourceUri, to: localUri });
    }

    return { localUri, fileName, mimeType: details.mimeType };
  }

  throw new Error("This photo format is not supported for saving or sharing.");
}
