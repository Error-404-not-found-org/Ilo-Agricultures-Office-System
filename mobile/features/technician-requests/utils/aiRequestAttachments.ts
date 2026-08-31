const cleanAttachmentUrl = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const getAIRequestAttachmentUrls = (request: any): string[] =>
  Array.from(
    new Set(
      [
        request?.photos,
        request?.imageUrl,
        request?.attachments?.urls,
        request?.attachments,
      ]
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map(cleanAttachmentUrl)
        .filter(Boolean),
    ),
  );
