import sharp from "sharp";

export type OutputFormat = "jpeg" | "webp" | "avif" | "png";

export interface QualityResult {
  met: boolean;
  quality: number;
  buffer: Buffer;
}

export interface QualityOptions {
  start?: number;
  step?: number;
  floor?: number;
}

export async function findQualityUnderCap(
  buffer: Buffer,
  format: OutputFormat,
  capBytes: number,
  { start = 80, step = 10, floor = 20 }: QualityOptions = {},
): Promise<QualityResult> {
  if (format === "png") {
    console.warn("PNG output is lossless; skipping quality cap");
    const encoded = await sharp(buffer).png().toBuffer();
    return { met: encoded.byteLength <= capBytes, quality: 100, buffer: encoded };
  }
  let floorResult: QualityResult | undefined;
  for (let quality = start; quality >= floor; quality -= step) {
    const encoded = await sharp(buffer).toFormat(format, { quality }).toBuffer();
    if (encoded.byteLength <= capBytes) {
      return { met: true, quality, buffer: encoded };
    }
    floorResult = { met: false, quality: floor, buffer: encoded };
  }
  return floorResult as QualityResult;
}
