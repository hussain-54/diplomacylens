const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export type OptimizedImage = {
  file: File;
  width: number;
  height: number;
  originalBytes: number;
  optimizedBytes: number;
  skipped: boolean;
};

/**
 * Gentle client-side prep before upload:
 * - Validates JPG/JPEG/PNG/WEBP
 * - Only downscales when the long edge exceeds maxDimension
 * - Keeps the original file when re-encoding would hurt quality or size
 * - Uses high WebP/JPEG quality to avoid soft/distorted photos
 */
export async function optimizeImageFile(
  file: File,
  options?: { maxDimension?: number; quality?: number; force?: boolean },
): Promise<OptimizedImage> {
  const maxDimension = options?.maxDimension ?? 3200;
  const quality = options?.quality ?? 0.92;
  const mime = (file.type || "").toLowerCase();

  if (!ALLOWED_TYPES.has(mime) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error("Only JPG, JPEG, PNG, and WEBP images are supported.");
  }

  const originalBytes = file.size;

  // Already web-ready and under size cap — upload as-is (no second encode).
  if (
    !options?.force &&
    originalBytes <= 2.5 * 1024 * 1024 &&
    (mime === "image/jpeg" || mime === "image/jpg" || mime === "image/webp" || mime === "image/png")
  ) {
    try {
      const dims = await readImageSize(file);
      if (Math.max(dims.width, dims.height) <= maxDimension) {
        return {
          file,
          width: dims.width,
          height: dims.height,
          originalBytes,
          optimizedBytes: originalBytes,
          skipped: true,
        };
      }
    } catch {
      /* fall through to canvas path */
    }
  }

  const bitmap = await loadBitmap(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    // No downscale needed and caller didn't force — keep original bytes/pixels.
    if (scale === 1 && !options?.force) {
      return {
        file,
        width: bitmap.width,
        height: bitmap.height,
        originalBytes,
        optimizedBytes: originalBytes,
        skipped: true,
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not optimize image.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const preferPng = mime === "image/png";
    const webp = preferPng ? null : await canvasToBlob(canvas, "image/webp", quality);
    const jpeg =
      !webp || webp.size === 0 ? await canvasToBlob(canvas, "image/jpeg", quality) : null;
    const png = preferPng ? await canvasToBlob(canvas, "image/png") : null;
    const blob = png && png.size > 0 ? png : webp && webp.size > 0 ? webp : jpeg;
    if (!blob) throw new Error("Image optimization failed.");

    // Prefer original when the "optimized" file is not meaningfully smaller.
    if (blob.size >= originalBytes * 0.95 && scale === 1) {
      return {
        file,
        width: bitmap.width,
        height: bitmap.height,
        originalBytes,
        optimizedBytes: originalBytes,
        skipped: true,
      };
    }

    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_") || "image";
    const optimized = new File([blob], `${base}.${ext}`, {
      type: blob.type,
      lastModified: Date.now(),
    });

    return {
      file: optimized,
      width,
      height,
      originalBytes,
      optimizedBytes: optimized.size,
      skipped: false,
    };
  } finally {
    bitmap.close?.();
  }
}

async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close?.();
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read image."));
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read image."));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read image.");
    ctx.drawImage(img, 0, 0);
    return createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}
