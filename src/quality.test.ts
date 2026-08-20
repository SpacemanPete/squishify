import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { findQualityUnderCap } from "./quality.ts";

async function makeNoisePng(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  let seed = 123456789;
  for (let i = 0; i < raw.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    raw[i] = seed & 0xff;
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

async function encodeAt(buffer: Buffer, format: "webp", quality: number): Promise<Buffer> {
  return sharp(buffer).toFormat(format, { quality }).toBuffer();
}

describe("findQualityUnderCap", () => {
  it("encodes a result under the cap when the start quality fits", async () => {
    const image = await makeNoisePng(300, 300);
    const result = await findQualityUnderCap(image, "webp", 1_000_000);
    expect(result.met).toBe(true);
    expect(result.quality).toBe(80);
    expect(result.buffer.byteLength).toBeLessThanOrEqual(1_000_000);
  });

  it("decreases quality across attempts when the start quality is over the cap", async () => {
    const image = await makeNoisePng(1000, 1000);
    const at80 = await encodeAt(image, "webp", 80);
    const at20 = await encodeAt(image, "webp", 20);
    const cap = at20.length + Math.floor((at80.length - at20.length) / 4);
    const result = await findQualityUnderCap(image, "webp", cap, {
      start: 80,
      step: 30,
      floor: 20,
    });
    expect(result.met).toBe(true);
    expect(result.quality).toBeLessThan(80);
    expect(result.quality).toBeGreaterThanOrEqual(20);
    expect(result.buffer.byteLength).toBeLessThanOrEqual(cap);
  }, 30_000);

  it("flags a floor-reached-but-still-over-cap case", async () => {
    const image = await makeNoisePng(1000, 1000);
    const at20 = await encodeAt(image, "webp", 20);
    const result = await findQualityUnderCap(image, "webp", at20.length - 1, {
      start: 80,
      step: 30,
      floor: 20,
    });
    expect(result.met).toBe(false);
    expect(result.quality).toBe(20);
  }, 30_000);

  it("attempts at least once when start is below the floor", async () => {
    const image = await makeNoisePng(100, 100);
    const result = await findQualityUnderCap(image, "webp", 10_000_000, { start: 10, floor: 20 });
    expect(result.met).toBe(true);
    expect(result.quality).toBe(20);
  });

  it("reports the quality actually used when the step misses the floor", async () => {
    const image = await makeNoisePng(1000, 1000);
    const at20 = await encodeAt(image, "webp", 20);
    const result = await findQualityUnderCap(image, "webp", at20.length - 1, {
      start: 80,
      step: 30,
      floor: 25,
    });
    expect(result.met).toBe(false);
    expect(result.quality).toBe(20);
  }, 30_000);
});

describe("findQualityUnderCap PNG rule", () => {
  it("skips the quality loop and flags the warning for PNG output with a cap", async () => {
    const image = await makeNoisePng(300, 300);
    const fullQuality = await sharp(image).png().toBuffer();
    const result = await findQualityUnderCap(image, "png", 10_000);
    expect(result.warning).toBe("PNG output is lossless; skipping quality cap");
    expect(result.quality).toBe(100);
    expect(result.met).toBe(false);
    expect(result.buffer.equals(fullQuality)).toBe(true);
  });

  it("reports the cap met when full-quality PNG output happens to fit", async () => {
    const image = await makeNoisePng(100, 100);
    const result = await findQualityUnderCap(image, "png", 10_000_000);
    expect(result.warning).toBe("PNG output is lossless; skipping quality cap");
    expect(result.quality).toBe(100);
    expect(result.met).toBe(true);
  });
});
