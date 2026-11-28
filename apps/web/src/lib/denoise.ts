import type { RgbaImage } from "@negarlab/ip";
import { decodeImageBlob } from "./decodeImage";
import { encodePng } from "./png";

export async function denoiseNlm(image: RgbaImage, strength: number): Promise<RgbaImage> {
  const form = new FormData();
  form.append("file", await encodePng(image), "image.png");
  form.append("strength", String(strength));
  const response = await fetch("/api/v1/denoise", { method: "POST", body: form });
  if (!response.ok) throw new Error(`nlm_failed_${response.status}`);
  return decodeImageBlob(await response.blob());
}
