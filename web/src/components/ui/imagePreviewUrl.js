const DATA_IMAGE_URL =
  /^data:image\/(?:avif|bmp|gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i;

export const imagePreviewUrl = (image) =>
  typeof image === "string" ? image : image?.url || image?.src || "";

export const isSafeImagePreviewUrl = (image) => {
  const value = imagePreviewUrl(image).trim();
  if (DATA_IMAGE_URL.test(value)) return true;

  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
