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

const validAttachmentUrl = (value) => {
  try {
    return ["http:", "https:"].includes(new URL(String(value || "")).protocol);
  } catch {
    return false;
  }
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

  return (Array.isArray(record?.attachments) ? record.attachments : [])
    .filter((attachment) => validAttachmentUrl(attachment?.url))
    .map((attachment, index) => {
      const extension = attachmentExtension(attachment.url);
      const position = index + 1;
      return {
        url: String(attachment.url).trim(),
        displayName: `${naming.display}_${position}.${extension}`,
        downloadName: `${naming.download}_${earTag}_${date}_${position}.${extension}`,
        extension,
        sourceType: attachment.category || record.type || "record",
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
