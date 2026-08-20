import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  text: vi.fn<() => Promise<unknown>>(),
  select: vi.fn<() => Promise<unknown>>(),
  confirm: vi.fn<() => Promise<unknown>>(),
  cancel: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
  isCancel: vi.fn((value: unknown) => value === Symbol.for("clack:cancel")),
}));

vi.mock("@clack/prompts", () => ({
  text: mocks.text,
  select: mocks.select,
  confirm: mocks.confirm,
  cancel: mocks.cancel,
  isCancel: mocks.isCancel,
  log: { warn: mocks.logWarn, info: mocks.logInfo },
}));

import {
  CANCEL,
  confirmSummary,
  promptConfig,
  promptInputDirectory,
  summaryText,
} from "./index.ts";

const FIXTURES = path.resolve("tests/fixtures");

let dirs: string[] = [];

async function makeDir(files: Record<string, string> = {}): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "squooshy-prompt-"));
  dirs.push(dir);
  for (const [name, src] of Object.entries(files)) {
    await copyFile(path.join(FIXTURES, src), path.join(dir, name));
  }
  return dir;
}

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  dirs = [];
});

describe("promptInputDirectory", () => {
  it("accepts a valid folder containing supported images", async () => {
    const dir = await makeDir({ "photo.jpg": "photo.jpg" });
    mocks.text.mockResolvedValueOnce(dir);
    await expect(promptInputDirectory()).resolves.toBe(dir);
    expect(mocks.logWarn).not.toHaveBeenCalled();
  });

  it("rejects a missing path and loops back with a friendly re-enter message", async () => {
    const dir = await makeDir({ "photo.jpg": "photo.jpg" });
    mocks.text.mockResolvedValueOnce(path.join(dir, "nope"));
    mocks.text.mockResolvedValueOnce(dir);
    await expect(promptInputDirectory()).resolves.toBe(dir);
    expect(mocks.logWarn).toHaveBeenCalledWith(expect.stringContaining("try again"));
  });

  it("rejects a non-directory path and loops back", async () => {
    const dir = await makeDir({ "photo.jpg": "photo.jpg" });
    mocks.text.mockResolvedValueOnce(path.join(dir, "photo.jpg"));
    mocks.text.mockResolvedValueOnce(dir);
    await expect(promptInputDirectory()).resolves.toBe(dir);
    expect(mocks.logWarn).toHaveBeenCalled();
  });

  it("rejects an image-less folder and loops back", async () => {
    const dir = await makeDir();
    await writeFile(path.join(dir, "notes.txt"), "not an image");
    const withImg = await makeDir({ "photo.png": "photo.png" });
    mocks.text.mockResolvedValueOnce(dir);
    mocks.text.mockResolvedValueOnce(withImg);
    await expect(promptInputDirectory()).resolves.toBe(withImg);
    expect(mocks.logWarn).toHaveBeenCalledWith(expect.stringContaining("no supported images"));
  });

  it("handles cancel cleanly", async () => {
    mocks.text.mockResolvedValueOnce(Symbol.for("clack:cancel"));
    await expect(promptInputDirectory()).resolves.toBe(CANCEL);
    expect(mocks.cancel).toHaveBeenCalled();
  });
});

describe("promptConfig", () => {
  it("produces a full config from the whole prompt sequence", async () => {
    mocks.confirm.mockResolvedValueOnce(true);
    mocks.select.mockResolvedValueOnce("width");
    mocks.text.mockResolvedValueOnce("2000");
    mocks.select.mockResolvedValueOnce("webp");
    mocks.confirm.mockResolvedValueOnce(true);
    mocks.text.mockResolvedValueOnce("500");
    mocks.select.mockResolvedValueOnce("kb");
    mocks.text.mockResolvedValueOnce("prod-");
    mocks.text.mockResolvedValueOnce("-web");

    await expect(promptConfig()).resolves.toEqual({
      resize: { axis: "width", maxDimension: 2000 },
      format: "webp",
      capBytes: 500 * 1024,
      prefix: "prod-",
      suffix: "-web",
    });
  });

  it("produces a minimal config when resize and cap are declined", async () => {
    mocks.confirm.mockResolvedValueOnce(false);
    mocks.select.mockResolvedValueOnce("jpeg");
    mocks.confirm.mockResolvedValueOnce(false);
    mocks.text.mockResolvedValueOnce("");
    mocks.text.mockResolvedValueOnce("");

    await expect(promptConfig()).resolves.toEqual({
      resize: null,
      format: "jpeg",
      capBytes: null,
      prefix: "",
      suffix: "",
    });
  });

  it("interprets MB caps as megabytes", async () => {
    mocks.confirm.mockResolvedValueOnce(false);
    mocks.select.mockResolvedValueOnce("png");
    mocks.confirm.mockResolvedValueOnce(true);
    mocks.text.mockResolvedValueOnce("2");
    mocks.select.mockResolvedValueOnce("mb");

    const config = await promptConfig();
    if (config === CANCEL) throw new Error("expected config");
    expect(config.capBytes).toBe(2 * 1024 * 1024);
  });

  it("returns CANCEL when the user cancels mid-sequence", async () => {
    mocks.confirm.mockResolvedValueOnce(Symbol.for("clack:cancel"));
    await expect(promptConfig()).resolves.toBe(CANCEL);
    expect(mocks.cancel).toHaveBeenCalled();
  });
});

describe("confirmSummary", () => {
  it("shows every answer in the summary", () => {
    const text = summaryText("/pics", {
      resize: { axis: "width", maxDimension: 2000 },
      format: "webp",
      capBytes: 512 * 1024,
      prefix: "prod-",
      suffix: "-web",
    });
    expect(text).toContain("/pics");
    expect(text).toContain("webp");
    expect(text).toContain("fit width to 2000px");
    expect(text).toContain("512 KB");
    expect(text).toContain("prod-");
    expect(text).toContain("-web");
  });

  it("shows resize/cap/prefix/suffix as disabled when not set", () => {
    const text = summaryText("/pics", {
      resize: null,
      format: "jpeg",
      capBytes: null,
      prefix: "",
      suffix: "",
    });
    expect(text).toContain("no resize");
    expect(text).toContain("no cap");
    expect(text).toContain("(none)");
  });

  it("formats MB caps as megabytes", () => {
    const text = summaryText("/pics", {
      resize: null,
      format: "png",
      capBytes: 2 * 1024 * 1024,
      prefix: "",
      suffix: "",
    });
    expect(text).toContain("2 MB");
  });

  it("displays the summary and resolves true when confirmed", async () => {
    mocks.confirm.mockResolvedValueOnce(true);
    await expect(
      confirmSummary("/pics", {
        resize: null,
        format: "jpeg",
        capBytes: null,
        prefix: "",
        suffix: "",
      }),
    ).resolves.toBe(true);
    expect(mocks.logInfo).toHaveBeenCalledWith(expect.stringContaining("jpeg"));
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ initialValue: false }));
  });

  it("resolves false when declined", async () => {
    mocks.confirm.mockResolvedValueOnce(false);
    await expect(
      confirmSummary("/pics", {
        resize: null,
        format: "jpeg",
        capBytes: null,
        prefix: "",
        suffix: "",
      }),
    ).resolves.toBe(false);
  });

  it("exits cleanly on cancel", async () => {
    mocks.confirm.mockResolvedValueOnce(Symbol.for("clack:cancel"));
    await expect(
      confirmSummary("/pics", {
        resize: null,
        format: "jpeg",
        capBytes: null,
        prefix: "",
        suffix: "",
      }),
    ).resolves.toBe(CANCEL);
    expect(mocks.cancel).toHaveBeenCalled();
  });
});
