const readString = (value) =>
  typeof value === "string" ? value.trim() : "";

export const APP_DOWNLOAD_URL = readString(
  import.meta.env.VITE_BREEDSMART_APP_DOWNLOAD_URL,
);

export const APP_DOWNLOAD_PAGE_URL =
  "https://www.breedsmartoton.site/download-app";

export const APP_DEEP_LINK_URL =
  readString(import.meta.env.VITE_BREEDSMART_APP_DEEP_LINK_URL) ||
  "ilo-agriculture://";

export const getDownloadQrUrl = (downloadPageUrl = APP_DOWNLOAD_PAGE_URL) =>
  downloadPageUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(downloadPageUrl)}`
    : "";
