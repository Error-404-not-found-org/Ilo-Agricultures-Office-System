import { useState } from "react";
import { UserRound } from "lucide-react";

export default function UserAvatar({
  name,
  imageUrl,
  size = 40,
  sizeClass = "h-10 w-10",
  className = "",
}) {
  const source = typeof imageUrl === "string" ? imageUrl.trim() : "";
  const [failedSource, setFailedSource] = useState(null);
  const showImage = Boolean(source) && failedSource !== source;
  const accessibleName = name || "User";

  return (
    <div
      className={`avatar shrink-0 ${showImage ? "" : "avatar-placeholder"} ${className}`.trim()}
      aria-label={showImage ? undefined : `${accessibleName} profile image unavailable`}
    >
      <div
        className={`${sizeClass} overflow-hidden rounded-full border border-base-300 bg-base-200 text-base-content/70`}
      >
        {showImage ? (
          <img
            src={source}
            alt={`${accessibleName} profile`}
            width={size}
            height={size}
            loading="lazy"
            className="h-full w-full rounded-full object-cover"
            onError={() => setFailedSource(source)}
          />
        ) : (
          <UserRound size={Math.max(16, Math.round(size * 0.45))} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
