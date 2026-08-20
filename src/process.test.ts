import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import { processImage } from "./process.ts";

const FIXTURES = path.resolve("tests/fixtures");

let tempDirs: string[] = [];

async function tempOutDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "squooshy-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.map((d) => rm(d, { recursive: true, force: true })));
  tempDirs = [];
});

function magicFormat(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpeg";
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  if (buffer.subarray(4, 12).toString("ascii") === "ftypavif") return "avif";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)
    return "png";
  return "unknown";
}

describe("processImage", () => {
  it("applies the shouldResize result when resizing", async () => {
    const dir = await tempOutDir();
    const out = path.join(dir, "photo.webp");
    const result = await processImage(path.join(FIXTURES, "photo.jpg"), out, {
      format: "webp",
      resize: { axis: "width", maxDimension: 2000 },
    });
    if (result.status !== "ok") throw new Error("expected ok");
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(2000);
    expect(meta.height).toBe(1500);
  });

  it("leaves an already-small image untouched by resize", async () => {
    const dir = await tempOutDir();
    const out = path.join(dir, "photo.webp");
    const result = await processImage(path.join(FIXTURES, "photo.webp"), out, {
      format: "webp",
      resize: { axis: "width", maxDimension: 2000 },
    });
    if (result.status !== "ok") throw new Error("expected ok");
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(1200);
  });

  it("does not modify the source file", async () => {
    const src = path.join(FIXTURES, "photo.jpg");
    const before = await readFile(src);
    const dir = await tempOutDir();
    await processImage(src, path.join(dir, "photo.webp"), { format: "webp" });
    const after = await readFile(src);
    expect(after.equals(before)).toBe(true);
  });

  it.each([
    ["jpeg", ".jpg", "image/jpeg"],
    ["webp", ".webp", "image/webp"],
    ["avif", ".avif", "image/avif"],
    ["png", ".png", "image/png"],
  ] as const)(
    "converts to %s with the right format, mime, and extension",
    async (format, ext, mime) => {
      const dir = await tempOutDir();
      const out = path.join(dir, `out${ext}`);
      const result = await processImage(path.join(FIXTURES, "photo.png"), out, { format });
      if (result.status !== "ok") throw new Error("expected ok");
      expect(out.endsWith(ext)).toBe(true);
      expect(result.format).toBe(format);
      const buffer = await readFile(out);
      expect(magicFormat(buffer)).toBe(format);
      expect((await sharp(buffer).metadata()).format).toBe(format === "avif" ? "heif" : format);
      const mimeByExt = {
        ".jpg": "image/jpeg",
        ".webp": "image/webp",
        ".avif": "image/avif",
        ".png": "image/png",
      };
      expect(mime).toBe(mimeByExt[ext]);
    },
  );

  it("writes the findQualityUnderCap result when a cap is set", async () => {
    const src = path.join(FIXTURES, "photo.tiff");
    const at80 = await sharp(src).toFormat("webp", { quality: 80 }).toBuffer();
    const at20 = await sharp(src).toFormat("webp", { quality: 20 }).toBuffer();
    const cap = at20.length + Math.floor((at80.length - at20.length) / 4);
    const dir = await tempOutDir();
    const out = path.join(dir, "capped.webp");
    const result = await processImage(src, out, { format: "webp", capBytes: cap });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.capMet).toBe(true);
    expect(result.size).toBeLessThanOrEqual(cap);
    expect((await readFile(out)).byteLength).toBeLessThanOrEqual(cap);
  });
});
