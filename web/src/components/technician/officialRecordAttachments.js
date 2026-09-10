import { isSafeImagePreviewUrl } from "../ui/imagePreviewUrl";

const ATTACHMENT_NAMES = {
  ai: { display: "AI_Evidence", download: "AI" },
  health: { display: "Health_Photo", download: "Health" },
  pregnancy: { display: "Pregnancy_Photo", download: "Pregnancy" },
  calving: { display: "Calving_Photo", download: "Calving" },
};

const sanitizeFilenamePart = (value, fallback) => {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
};

const attachmentExtension = (url) => {
  try {
    const match = new URL(url).pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
    return match?.[1]?.toLowerCase() || "jpg";
  } catch {
    return "jpg";
  }
};

const attachmentDateStamp = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "undated";
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return [part("year"), part("month"), part("day")]
    .filter(Boolean)
    .join("-");
};

export const normalizeRecordAttachments = (record) => {
  const naming = ATTACHMENT_NAMES[record?.type] || {
    display: "Attachment",
    download: "Record",
  };
  const animal = record?.animalId || {};
  const earTag = sanitizeFilenamePart(
    animal.earTag || animal.animalId,
    "animal",
  );
  const date = attachmentDateStamp(record?.details?.serviceDate || record?.date);

  const rawAttachments = Array.isArray(record?.attachments) ? record.attachments : [];

  const extraUrls = [
    ...(Array.isArray(record?.photos) ? record.photos : []),
    ...(Array.isArray(record?.details?.farmerRequest?.photos) ? record.details.farmerRequest.photos : []),
    ...(Array.isArray(record?.healthRequestId?.photos) ? record.healthRequestId.photos : []),
    record?.photoUrl,
    record?.imageUrl,
    record?.healthRequestId?.imageUrl,
    record?.healthRequestId?.photoUrl,
    record?.details?.farmerRequest?.photoUrl,
    record?.details?.imageUrl,
    record?.details?.photoUrl,
  ]
    .filter((url) => typeof url === "string" && url.trim().length > 0)
    .map((url) => url.trim());

  const allUrls = new Set([
    ...rawAttachments
      .map((attachment) =>
        typeof attachment === "string" ? attachment : attachment?.url,
      )
      .filter(Boolean),
    ...extraUrls,
  ]);

  return Array.from(allUrls)
    .map((url) => String(url).trim())
    .filter(isSafeImagePreviewUrl)
    .map((url, index) => {
      const extension = attachmentExtension(url);
      const position = index + 1;
      return {
        url,
        displayName: `${naming.display}_${position}.${extension}`,
        downloadName: `${naming.download}_${earTag}_${date}_${position}.${extension}`,
        extension,
        sourceType: record?.type || "record",
      };
    });
};

export const downloadRecordAttachment = async (attachment) => {
  const response = await fetch(attachment.url, {
    mode: "cors",
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error("Attachment download failed.");
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = attachment.downloadName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};
