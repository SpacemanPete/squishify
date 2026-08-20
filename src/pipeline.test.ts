import { copyFile, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runBatch, type PromptConfig } from "./index.ts";

const FIXTURES = path.resolve("tests/fixtures");
const FIXTURE_NAMES = [
  "photo.jpg",
  "photo.png",
  "photo.webp",
  "photo.tiff",
  "photo.gif",
  "corrupt.jpg",
];

let tempDirs: string[] = [];

async function tempCopyDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "squooshy-e2e-"));
  tempDirs.push(dir);
  for (const name of FIXTURE_NAMES) {
    await copyFile(path.join(FIXTURES, name), path.join(dir, name));
  }
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.map((d) => rm(d, { recursive: true, force: true })));
  tempDirs = [];
});

const webpConfig: PromptConfig = {
  resize: null,
  format: "webp",
  capBytes: null,
  prefix: "",
  suffix: "",
};

describe("end-to-end pipeline over fixtures", () => {
  it("converts every supported fixture and skips corrupt input", async () => {
    const dir = await tempCopyDir();
    const result = await runBatch(dir, path.join(dir, "processed"), webpConfig);

    expect(result.status).toBe("completed");
    expect(result.processed.map((p) => p.output).sort()).toEqual([
      "photo-1.webp",
      "photo-2.webp",
      "photo-3.webp",
      "photo.webp",
    ]);
    expect(result.skipped.map((s) => s.source)).toEqual(["corrupt.jpg", "photo.gif"]);
    expect(result.skipped[0]?.reason).toMatch(/^unreadable:/);
    expect(result.skipped[1]?.reason).toBe("unsupported format: gif");
    expect(result.errors).toHaveLength(0);

    const outputs = (await readdir(path.join(dir, "processed"))).sort();
    expect(outputs).toEqual(["photo-1.webp", "photo-2.webp", "photo-3.webp", "photo.webp"]);
    for (const p of result.processed) {
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      expect(p.size).toBeGreaterThan(0);
    }
  });

  it("leaves source fixtures byte-identical after a run", async () => {
    const dir = await tempCopyDir();
    const before = new Map<string, Buffer>();
    for (const name of FIXTURE_NAMES) {
      before.set(name, await readFile(path.join(dir, name)));
    }

    await runBatch(dir, path.join(dir, "processed"), webpConfig);

    for (const [name, buffer] of before) {
      const after = await readFile(path.join(dir, name));
      expect(after.equals(buffer), `${name} was modified`).toBe(true);
    }
  });

  it("honors a 500 KB cap or reports it as unmeetable", async () => {
    const dir = await tempCopyDir();
    const result = await runBatch(dir, path.join(dir, "processed"), {
      ...webpConfig,
      capBytes: 500 * 1024,
    });

    expect(result.processed).toHaveLength(4);
    for (const p of result.processed) {
      expect(p.size <= 500 * 1024 || p.capMet === false).toBe(true);
    }
  }, 60000);
});
