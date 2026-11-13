import type { CSSProperties } from "react";
import type { GalleryLayout, ImageAlign, ImageFit, ImageSize } from "@/lib/blocks";

/** CSS for published + editor preview — never stretch source photos. */
export function imageFitClass(fit: ImageFit = "original"): string {
  switch (fit) {
    case "cover":
      return "h-full w-full object-cover object-center";
    case "contain":
      return "mx-auto h-auto max-h-full w-auto max-w-full object-contain";
    case "original":
    default:
      return "h-auto w-full max-w-full";
  }
}

export function imageSizeClass(size: ImageSize = "full", widthPercent = 100): string {
  if (widthPercent < 100) return "w-full max-w-full";
  switch (size) {
    case "small":
      return "max-w-sm";
    case "medium":
      return "max-w-xl";
    case "large":
      return "max-w-3xl";
    case "full":
    default:
      return "w-full max-w-full";
  }
}

export function imageAlignClass(align: ImageAlign = "full"): string {
  if (align === "left") return "mr-auto";
  if (align === "right") return "ml-auto";
  if (align === "center") return "mx-auto";
  return "";
}

export function galleryGridClass(layout: GalleryLayout = "pair"): string {
  if (layout === "single") return "grid grid-cols-1 gap-4";
  if (layout === "full") return "grid grid-cols-1 gap-5";
  return "grid grid-cols-1 gap-4 sm:grid-cols-2";
}

export function figureWidthStyle(widthPercent = 100): CSSProperties | undefined {
  if (widthPercent >= 100) return undefined;
  return { width: `${widthPercent}%`, maxWidth: "100%" };
}
