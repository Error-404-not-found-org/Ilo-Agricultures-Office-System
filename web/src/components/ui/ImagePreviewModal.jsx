import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import Modal from "./Modal";
import {
  imagePreviewUrl,
  isSafeImagePreviewUrl,
} from "./imagePreviewUrl";

const imageLabel = (image, index) =>
  (typeof image === "object" &&
    (image?.displayName || image?.name || image?.label)) ||
  `Photo ${index + 1}`;

const hasImageLabel = (image) =>
  typeof image === "object" &&
  Boolean(image?.displayName || image?.name || image?.label);

export default function ImagePreviewModal({
  images = [],
  selectedImage = null,
  onSelectImage,
  onClose,
  title = "Photo preview",
  onDownload,
  downloadingUrl = "",
  errorMessage = "",
}) {
  const [retainedImage, setRetainedImage] = useState(selectedImage);
  const selectedUrl = imagePreviewUrl(selectedImage);
  const retainedUrl = imagePreviewUrl(retainedImage);

  if (selectedImage && selectedUrl !== retainedUrl) {
    setRetainedImage(selectedImage);
  }

  const visibleImage = selectedImage || retainedImage;
  const visibleUrl = imagePreviewUrl(visibleImage);
  const previewImages = images.filter(isSafeImagePreviewUrl);
  const matchedIndex = previewImages.findIndex(
    (image) => imagePreviewUrl(image) === visibleUrl,
  );
  const currentIndex = matchedIndex >= 0 ? matchedIndex : 0;
  const currentImage =
    matchedIndex >= 0 ? previewImages[matchedIndex] : previewImages[0] || null;
  const currentUrl = imagePreviewUrl(currentImage);
  const currentLabel = imageLabel(currentImage, currentIndex);
  const modalTitle = hasImageLabel(currentImage) ? currentLabel : title;
  const hasMultipleImages = previewImages.length > 1;

  const selectImage = (index) => {
    if (!hasMultipleImages) return;
    const nextIndex =
      (index + previewImages.length) % previewImages.length;
    onSelectImage?.(previewImages[nextIndex]);
  };

  useEffect(() => {
    if (!selectedImage || !hasMultipleImages) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "ArrowLeft") selectImage(currentIndex - 1);
      if (event.key === "ArrowRight") selectImage(currentIndex + 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <Modal
      isOpen={Boolean(selectedImage)}
      onClose={onClose}
      title={modalTitle}
      subtitle={
        hasMultipleImages
          ? `${currentIndex + 1} of ${previewImages.length}`
          : hasImageLabel(currentImage)
            ? title
            : "Image preview"
      }
      icon={<ImageIcon size={20} aria-hidden="true" />}
      size="4xl"
      closeOnEscape
      closeOnBackdropClick
      backdropClassName="bg-transparent"
      actions={
        <>
          {currentUrl && (
            <a
              href={currentUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm"
            >
              <ExternalLink size={16} aria-hidden="true" />
              Open original
            </a>
          )}
          {onDownload && currentImage && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onDownload(currentImage)}
              disabled={downloadingUrl === currentUrl}
            >
              {downloadingUrl === currentUrl ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Download size={16} aria-hidden="true" />
              )}
              Download
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close preview
          </button>
        </>
      }
    >
      {currentUrl && (
        <div className="space-y-3">
          <figure className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-box bg-base-200 p-2 sm:min-h-72">
            <img
              src={currentUrl}
              alt={`Preview of ${currentLabel}`}
              className="max-h-[58vh] max-w-full object-contain"
            />
            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  className="btn btn-circle btn-sm absolute left-3 top-1/2 -translate-y-1/2 shadow-md"
                  onClick={() => selectImage(currentIndex - 1)}
                  aria-label="View previous image"
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn btn-circle btn-sm absolute right-3 top-1/2 -translate-y-1/2 shadow-md"
                  onClick={() => selectImage(currentIndex + 1)}
                  aria-label="View next image"
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </>
            )}
          </figure>
          {hasMultipleImages && (
            <p className="text-center text-xs text-base-content/60" aria-live="polite">
              Image {currentIndex + 1} of {previewImages.length}
            </p>
          )}
          {errorMessage && (
            <div role="alert" className="alert alert-error alert-soft text-sm">
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
