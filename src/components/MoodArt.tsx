"use client";

import { useState } from "react";
import type { PaletteColor } from "@/types";

interface MoodArtProps {
  url?: string;
  palette?: PaletteColor[];
  alt?: string;
  className?: string;
  rounded?: string;
}

/**
 * Renders generated mood-art with a graceful loading shimmer and a
 * palette strip fallback if the image hasn't loaded or is missing.
 */
export function MoodArt({ url, palette, alt = "Mood art", className = "", rounded = "rounded-2xl" }: MoodArtProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div className={`relative overflow-hidden ${rounded} ${className}`}>
      {url && !errored ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`h-full w-full object-cover transition-opacity duration-700 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        // Palette-based fallback when no art / generation failed.
        <div className="grid h-full w-full grid-cols-1">
          {palette && palette.length > 0 ? (
            <div className="flex h-full w-full">
              {palette.map((c, i) => (
                <div key={i} style={{ backgroundColor: c.hex }} className="flex-1" />
              ))}
            </div>
          ) : (
            <div className="skeleton h-full w-full" />
          )}
        </div>
      )}
      {!loaded && url && !errored && <div className="skeleton absolute inset-0" />}
    </div>
  );
}
