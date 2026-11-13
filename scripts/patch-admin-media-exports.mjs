import fs from "node:fs";

const path = "src/lib/admin.functions.ts";
let s = fs.readFileSync(path, "utf8");

const reexport = `// MEDIA LIBRARY / DAM — implemented in media.functions.ts
export {
  type MediaAssetRow,
  listMediaFolders,
  upsertMediaFolder,
  deleteMediaFolder,
  listMediaAssets,
  listMediaAssetsPage,
  getMediaAssetCounts,
  listMediaUploaders,
  updateMediaAsset,
  moveMediaAssets,
  bulkUpdateMediaTags,
  bulkSetMediaCategory,
  trashMediaAssets,
  restoreMediaAssets,
  deleteMediaAsset,
  permanentlyDeleteMediaAssets,
  replaceMediaAssetFile,
  listMediaAssetUsages,
  syncMediaAssetUsages,
  uploadHeroImage,
  uploadMediaAsset,
  uploadMediaAssetsBulk,
  getMediaSettings,
  updateMediaSettings,
  getMediaStorageStats,
  listMediaGalleries,
  getGalleryCounts,
  getMediaGallery,
  upsertMediaGallery,
  deleteMediaGallery,
  duplicateMediaGallery,
  addMediaToGallery,
  removeMediaFromGallery,
  reorderGalleryMedia,
  getPublicGalleryBySlug,
} from "@/lib/media.functions";

`;

// Remove first uploadHeroImage / uploadMediaAsset / uploadMediaAssetsBulk block (legacy copies)
const uploadStart = s.indexOf("export const uploadHeroImage = async");
const categoriesStart = s.indexOf("// CATEGORIES / TAXONOMY");
if (uploadStart > 0 && categoriesStart > uploadStart) {
  // Keep indexMediaAsset helper if present just before uploadHeroImage
  const indexStart = s.lastIndexOf("const indexMediaAsset", uploadStart);
  const cutFrom = indexStart > 0 && indexStart < uploadStart ? indexStart : uploadStart;
  s = s.slice(0, cutFrom) + s.slice(categoriesStart);
}

const mediaStart = s.indexOf("// MEDIA LIBRARY / DAM");
const commentsOrNext = s.indexOf("\nexport const listPendingComments");
const commentsAlt = s.indexOf("\n// COMMENTS");
const afterMedia =
  commentsOrNext > 0
    ? commentsOrNext
    : commentsAlt > 0
      ? commentsAlt
      : s.indexOf("\nexport const getNewsroomSettings");

if (mediaStart < 0 || afterMedia < 0) {
  console.error("Could not locate media block", { mediaStart, afterMedia });
  process.exit(1);
}

s = s.slice(0, mediaStart) + reexport + s.slice(afterMedia);
fs.writeFileSync(path, s);
console.log("Patched admin.functions.ts media exports");
