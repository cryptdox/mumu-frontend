import imageCompression from "browser-image-compression";
import { LIMITS } from "@/config";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const IMAGE_ACCEPT = ACCEPTED.join(",");

/**
 * Make a picked photo fit the 1 MB limit: big phone photos are resized and
 * re-encoded in the browser before upload. GIFs can't be shrunk this way.
 */
export async function prepareImage(file: File): Promise<File> {
  if (!ACCEPTED.includes(file.type)) throw new Error("Pick a JPEG, PNG, WebP or GIF image");
  if (file.type === "image/gif") {
    if (file.size > LIMITS.imageBytes) throw new Error("GIFs must be under 1 MB");
    return file;
  }
  if (file.size <= LIMITS.imageBytes * 0.9 && file.size < 400_000) return file;
  const out = await imageCompression(file, { maxSizeMB: 0.9, maxWidthOrHeight: 2048, useWebWorker: true, fileType: file.type === "image/png" ? "image/webp" : file.type });
  if (out.size > LIMITS.imageBytes) throw new Error("Couldn't make this image small enough — try another");
  return out;
}
