import sharp from "sharp";

export type OutputFormat = "jpeg" | "webp" | "avif" | "png";

export interface QualityResult {
  met: boolean;
  quality: number;
  buffer: Buffer;
  warning?: string;
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
    const encoded = await sharp(buffer).png().toBuffer();
    return {
      met: encoded.byteLength <= capBytes,
      quality: 100,
      buffer: encoded,
      warning: "PNG output is lossless; skipping quality cap",
    };
  }
  const stepSize = Math.max(step, 1);
  let quality = Math.max(start, floor);
  for (;;) {
    const encoded = await sharp(buffer).toFormat(format, { quality }).toBuffer();
    if (encoded.byteLength <= capBytes) {
      return { met: true, quality, buffer: encoded };
    }
    if (quality <= floor) {
      return { met: false, quality, buffer: encoded };
    }
    quality -= stepSize;
  }
}
