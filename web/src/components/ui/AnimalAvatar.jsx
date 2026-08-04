import { useState } from "react";
import { Beef } from "lucide-react";

export default function AnimalAvatar({
  reference,
  imageUrl,
  size = 36,
  sizeClass = "h-9 w-9",
  className = "",
}) {
  const source = typeof imageUrl === "string" ? imageUrl.trim() : "";
  const [failedSource, setFailedSource] = useState(null);
  const showImage = Boolean(source) && failedSource !== source;
  const accessibleName = reference || "Animal";

  return (
    <div
      className={`avatar shrink-0 ${showImage ? "" : "avatar-placeholder"} ${className}`.trim()}
      aria-label={showImage ? undefined : `${accessibleName} image unavailable`}
    >
      <div
        className={`${sizeClass} overflow-hidden rounded-full border border-base-300 bg-base-200 text-primary/60`}
      >
        {showImage ? (
          <img
            src={source}
            alt={`${accessibleName} livestock`}
            width={size}
            height={size}
            loading="lazy"
            className="h-full w-full rounded-full object-cover"
            onError={() => setFailedSource(source)}
          />
        ) : (
          <Beef size={Math.max(16, Math.round(size * 0.5))} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
