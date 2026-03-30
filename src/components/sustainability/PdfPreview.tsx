// src/components/sustainability/PdfPreview.tsx

"use client";

import { useEffect } from "react";

type Props = {
  fileUrl: string;
  onDone?: () => void;
};

export default function PdfPreview({ fileUrl, onDone }: Props) {
  useEffect(() => {
    if (!fileUrl) return;
    window.open(fileUrl, "_blank", "noopener,noreferrer");
    onDone?.();
  }, [fileUrl, onDone]);

  return null;
}