import { useState } from "react";
import { Beef } from "lucide-react";

export default function AnimalImageFallback({ imageUrl, tag, className = "", iconSize = 40 }) {
  const [hasImageError, setHasImageError] = useState(false);
  const hasImage = Boolean(imageUrl) && !hasImageError;

  return (
    <figure className={`flex items-center justify-center bg-base-200 ${className}`}>
      {hasImage ? (
        <img
          src={imageUrl}
          alt={`Animal ${tag}`}
          className="h-full w-full object-cover"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-primary/45" aria-label={`Image unavailable for animal ${tag}`}>
          <Beef size={iconSize} />
        </div>
      )}
    </figure>
  );
}
