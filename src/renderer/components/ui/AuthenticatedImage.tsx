import { useEffect, useState } from "react";

import { fetchBlob } from "@/lib/api";

type AuthenticatedImageProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
};

export function AuthenticatedImage({ src, alt, className }: AuthenticatedImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function load() {
      if (!src) {
        setResolvedSrc(null);
        return;
      }

      if (/^data:/i.test(src)) {
        setResolvedSrc(src);
        return;
      }

      try {
        const blob = await fetchBlob(src);
        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setResolvedSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setResolvedSrc(null);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (!resolvedSrc) {
    return null;
  }

  return <img alt={alt} className={className} src={resolvedSrc} />;
}
