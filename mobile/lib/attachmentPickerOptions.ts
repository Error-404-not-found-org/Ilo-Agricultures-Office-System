export const getAttachmentPickerOptions = (
  source: "camera" | "library",
  remainingSlots: number,
) => ({
  mediaTypes: ["images"] as ["images"],
  allowsEditing: false,
  allowsMultipleSelection: source === "library",
  ...(source === "library" ? { selectionLimit: remainingSlots } : {}),
  quality: 0.7,
  base64: false,
});
