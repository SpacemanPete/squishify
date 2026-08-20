import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  text: vi.fn<(options?: unknown) => Promise<unknown>>(),
  select: vi.fn<() => Promise<unknown>>(),
  confirm: vi.fn<() => Promise<unknown>>(),
  cancel: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    message: vi.fn(),
    isCancelled: false,
  })),
  isCancel: vi.fn((value: unknown) => value === Symbol.for("clack:cancel")),
}));

vi.mock("@clack/prompts", () => ({
  text: mocks.text,
  select: mocks.select,
  confirm: mocks.confirm,
  cancel: mocks.cancel,
  isCancel: mocks.isCancel,
  intro: mocks.intro,
  outro: mocks.outro,
  spinner: mocks.spinner,
  log: { warn: mocks.logWarn, info: mocks.logInfo },
}));

import {
  CANCEL,
  confirmSummary,
  formatCap,
  listImages,
  promptConfig,
  promptInputDirectory,
  runBatch,
  main,
  renderReport,
  runWithSpinner,
  summaryText,
  type BatchResult,
  type PromptConfig,
} from "./index.ts";

import { formatProgress } from "./progress.ts";

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

  it("rejects path separators in prefix and suffix via prompt validation", async () => {
    const seen: {
      validate?: (value: string | undefined) => string | undefined;
    }[] = [];
    mocks.text.mockImplementation((opts) => {
      seen.push(opts as { validate?: (value: string | undefined) => string | undefined });
      return Promise.resolve("ok");
    });
    mocks.confirm.mockResolvedValue(false);
    mocks.select.mockResolvedValue("jpeg");
    mocks.confirm.mockResolvedValue(false);

    const config = await promptConfig();
    if (config === CANCEL) throw new Error("expected config");

    const [prefix, suffix] = seen;
    expect(prefix?.validate?.("../evil")).toBeTruthy();
    expect(prefix?.validate?.("a/b")).toBeTruthy();
    expect(prefix?.validate?.("a\\b")).toBeTruthy();
    expect(prefix?.validate?.("prod-")).toBeUndefined();
    expect(suffix?.validate?.("..")).toBeTruthy();
    expect(suffix?.validate?.("-web")).toBeUndefined();
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

describe("listImages", () => {
  it("lists top-level files only, without recursing", async () => {
    const dir = await makeDir({ "photo.jpg": "photo.jpg" });
    await mkdir(path.join(dir, "sub"));
    await writeFile(path.join(dir, "sub", "nested.png"), "nested");
    await expect(listImages(dir)).resolves.toEqual(["photo.jpg"]);
  });

  it("excludes directories that masquerade as images", async () => {
    const dir = await makeDir({ "photo.jpg": "photo.jpg" });
    await mkdir(path.join(dir, "fake.jpg"));
    await expect(listImages(dir)).resolves.toEqual(["photo.jpg"]);
  });

  it("filters to supported formats, case-insensitively", async () => {
    const dir = await makeDir();
    for (const name of [
      "a.gif",
      "b.PNG",
      "c.txt",
      "d.webp",
      "e.avif",
      "f.tiff",
      "g.tif",
      "h.jpeg",
    ]) {
      await writeFile(path.join(dir, name), "x");
    }
    await expect(listImages(dir)).resolves.toEqual([
      "a.gif",
      "b.PNG",
      "d.webp",
      "e.avif",
      "f.tiff",
      "g.tif",
      "h.jpeg",
    ]);
  });

  it("sorts deterministically", async () => {
    const dir = await makeDir();
    for (const name of ["z.png", "a.png", "m.png"]) {
      await writeFile(path.join(dir, name), "x");
    }
    await expect(listImages(dir)).resolves.toEqual(["a.png", "m.png", "z.png"]);
  });
});

describe("runBatch", () => {
  const minimal: PromptConfig = {
    resize: null,
    format: "jpeg",
    capBytes: null,
    prefix: "",
    suffix: "",
  };

  it("creates processed/ and writes outputs, resolving name collisions", async () => {
    const dir = await makeDir({
      "photo.jpg": "photo.jpg",
      "photo.png": "photo.png",
      "banner.webp": "photo.webp",
    });
    const result = await runBatch(dir, minimal);
    expect(result.status).toBe("completed");
    expect(result.processed).toHaveLength(3);
    expect(result.skipped).toHaveLength(0);
    const outputs = (await readdir(path.join(dir, "processed"))).sort();
    expect(outputs).toEqual(["banner.jpeg", "photo-1.jpeg", "photo.jpeg"]);
    for (const out of outputs) {
      expect(magicFormat(await readFile(path.join(dir, "processed", out)))).toBe("jpeg");
    }
  });

  it("applies prefix, suffix, and the chosen extension to output names", async () => {
    const dir = await makeDir({ "photo.jpg": "photo.jpg" });
    const config: PromptConfig = {
      resize: null,
      format: "webp",
      capBytes: null,
      prefix: "prod-",
      suffix: "-web",
    };
    const result = await runBatch(dir, config);
    expect(result.processed[0]?.output).toBe("prod-photo-web.webp");
    expect(result.processed[0]?.format).toBe("webp");
  });

  it("reports GIF files as skipped with `unsupported format: gif`", async () => {
    const dir = await makeDir({ "photo.gif": "photo.gif", "photo.jpg": "photo.jpg" });
    const result = await runBatch(dir, minimal);
    expect(result.processed).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toEqual({
      source: "photo.gif",
      reason: "unsupported format: gif",
    });
  });

  it("reports skipped files with reasons and keeps going", async () => {
    const dir = await makeDir({ "photo.jpg": "photo.jpg", "corrupt.jpg": "corrupt.jpg" });
    const result = await runBatch(dir, minimal);
    expect(result.processed).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.source).toBe("corrupt.jpg");
    expect(result.skipped[0]?.reason).toMatch(/^unreadable:/);
  });

  it("appends a counter instead of overwriting files from a previous run", async () => {
    const dir = await makeDir({ "photo.jpg": "photo.jpg" });
    const processed = path.join(dir, "processed");
    await mkdir(processed);
    await writeFile(path.join(processed, "photo.jpeg"), "old output");

    const result = await runBatch(dir, minimal);

    expect(result.processed[0]?.output).toBe("photo-1.jpeg");
    const outputs = (await readdir(processed)).sort();
    expect(outputs).toEqual(["photo-1.jpeg", "photo.jpeg"]);
    expect(await readFile(path.join(processed, "photo.jpeg"), "utf8")).toBe("old output");
  });

  it("never modifies source files", async () => {
    const dir = await makeDir({ "photo.jpg": "photo.jpg" });
    const before = await readFile(path.join(dir, "photo.jpg"));
    await runBatch(dir, minimal);
    const after = await readFile(path.join(dir, "photo.jpg"));
    expect(after.equals(before)).toBe(true);
  });

  it("calls onProgress once per file, in order, with correct totals", async () => {
    const dir = await makeDir({
      "a.jpg": "photo.jpg",
      "b.png": "photo.png",
      "c.webp": "photo.webp",
    });
    const calls: {
      index: number;
      total: number;
      name: string;
      counts: { processed: number; skipped: number; errors: number };
    }[] = [];
    await runBatch(dir, minimal, {
      onProgress: (p) => calls.push(p),
    });
    expect(calls.map((c) => c.index)).toEqual([1, 2, 3]);
    expect(calls.map((c) => c.total)).toEqual([3, 3, 3]);
    expect(calls.map((c) => c.name)).toEqual(["a.jpg", "b.png", "c.webp"]);
    expect(calls[0]?.counts).toEqual({ processed: 0, skipped: 0, errors: 0 });
    expect(calls[2]?.counts).toEqual({ processed: 2, skipped: 0, errors: 0 });
  });
});

describe("runWithSpinner", () => {
  const minimal: PromptConfig = {
    resize: null,
    format: "jpeg",
    capBytes: null,
    prefix: "",
    suffix: "",
  };

  function mockSpinner(onMessage?: (n: number) => void) {
    let cancelled = false;
    let messages = 0;
    return {
      start: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
      message: vi.fn(() => {
        messages++;
        onMessage?.(messages);
      }),
      get isCancelled() {
        return cancelled;
      },
      set cancelledAt(n: number) {
        onMessage = (count) => {
          if (count === n) cancelled = true;
        };
      },
    };
  }

  it("updates the spinner message once per file via formatProgress", async () => {
    const dir = await makeDir({
      "a.jpg": "photo.jpg",
      "b.png": "photo.png",
      "c.webp": "photo.webp",
    });
    const spinner = mockSpinner();
    const result = await runWithSpinner(dir, minimal, spinner);
    expect(result.status).toBe("completed");
    expect(spinner.start).toHaveBeenCalledTimes(1);
    expect(spinner.start).toHaveBeenCalledWith("Processing...");
    expect(spinner.message).toHaveBeenCalledTimes(3);
    expect(spinner.message).toHaveBeenNthCalledWith(
      1,
      formatProgress(1, 3, "a.jpg", { processed: 0, skipped: 0, errors: 0 }),
    );
    expect(spinner.message).toHaveBeenNthCalledWith(
      2,
      formatProgress(2, 3, "b.png", { processed: 1, skipped: 0, errors: 0 }),
    );
    expect(spinner.message).toHaveBeenNthCalledWith(
      3,
      formatProgress(3, 3, "c.webp", { processed: 2, skipped: 0, errors: 0 }),
    );
    expect(spinner.stop).toHaveBeenCalledWith("Done.");
    expect(spinner.cancel).not.toHaveBeenCalled();
  });

  it("stops the spinner with no partial writes when cancelled mid-run", async () => {
    const dir = await makeDir({
      "a.jpg": "photo.jpg",
      "b.png": "photo.png",
      "c.webp": "photo.webp",
    });
    const spinner = mockSpinner();
    spinner.cancelledAt = 2;
    const result = await runWithSpinner(dir, minimal, spinner);
    expect(result.status).toBe("cancelled");
    expect(result.processed).toHaveLength(1);
    expect(spinner.cancel).toHaveBeenCalled();
    expect(spinner.stop).not.toHaveBeenCalled();
    const outputs = await readdir(path.join(dir, "processed"));
    expect(outputs).toEqual(["a.jpeg"]);
  });
});

describe("formatCap", () => {
  it("rounds fractional KB sizes to one decimal", () => {
    expect(formatCap(132632)).toBe("129.5 KB");
    expect(formatCap(245 * 1024)).toBe("245 KB");
  });
});

describe("renderReport", () => {
  it("renders per-file summaries, grand totals, and the failed-files list", () => {
    const result: BatchResult = {
      status: "completed",
      processed: [
        {
          source: "photo.jpg",
          output: "prod-photo-web.webp",
          format: "webp",
          width: 2000,
          height: 1500,
          size: 245 * 1024,
        },
        {
          source: "banner.tiff",
          output: "banner-1.webp",
          format: "webp",
          width: 800,
          height: 600,
          size: 2 * 1024 * 1024,
          capMet: false,
          warning: "PNG output is lossless; skipping quality cap",
        },
      ],
      skipped: [{ source: "logo.gif", reason: "unsupported format: gif" }],
      errors: [{ source: "broken.jpg", reason: "Input file is corrupt" }],
      totalOutputBytes: 245 * 1024 + 2 * 1024 * 1024,
    };
    const text = renderReport(result);
    expect(text).toContain("Processed 2, skipped 1, errors 1");
    expect(text).toContain("photo.jpg -> prod-photo-web.webp (webp, 2000x1500, 245 KB)");
    expect(text).toContain(
      "banner-1.webp (webp, 800x600, 2 MB) (cap not met) — PNG output is lossless; skipping quality cap",
    );
    expect(text).toContain("logo.gif -> skipped: unsupported format: gif");
    expect(text).toContain("broken.jpg -> error: Input file is corrupt");
    expect(text).toContain("Total output: 2293 KB");
    expect(text).toContain("Failed files:");
    expect(text).toContain("- logo.gif: unsupported format: gif");
    expect(text).toContain("- broken.jpg: Input file is corrupt");
  });

  it("handles an empty run with no failed-files section", () => {
    const result: BatchResult = {
      status: "completed",
      processed: [],
      skipped: [],
      errors: [],
      totalOutputBytes: 0,
    };
    const text = renderReport(result);
    expect(text).toContain("Processed 0, skipped 0, errors 0");
    expect(text).toContain("Total output: 0 KB");
    expect(text).not.toContain("Failed files");
  });

  it("omits cap and warning notes when not present", () => {
    const result: BatchResult = {
      status: "completed",
      processed: [
        { source: "a.jpg", output: "a.png", format: "png", width: 10, height: 20, size: 1024 },
      ],
      skipped: [],
      errors: [],
      totalOutputBytes: 1024,
    };
    const text = renderReport(result);
    expect(text).toContain("a.jpg -> a.png (png, 10x20, 1 KB)");
    expect(text).not.toContain("cap not met");
    expect(text).not.toContain("—");
  });
});

describe("main", () => {
  it("runs the full flow and prints only the final report to stdout", async () => {
    const dir = await makeDir({ "photo.jpg": "photo.jpg" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.text.mockResolvedValueOnce(dir);
    mocks.confirm.mockResolvedValueOnce(false);
    mocks.select.mockResolvedValueOnce("webp");
    mocks.confirm.mockResolvedValueOnce(false);
    mocks.text.mockResolvedValueOnce("");
    mocks.text.mockResolvedValueOnce("");
    mocks.confirm.mockResolvedValueOnce(true);

    await main();

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Processed 1, skipped 0, errors 0"),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("photo.webp"));
    expect(mocks.outro).toHaveBeenCalled();
    expect(mocks.spinner).toHaveBeenCalledTimes(1);
  });

  it("exits cleanly with no report when the confirmation is declined", async () => {
    const dir = await makeDir({ "photo.jpg": "photo.jpg" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.text.mockResolvedValueOnce(dir);
    mocks.confirm.mockResolvedValueOnce(false);
    mocks.select.mockResolvedValueOnce("jpeg");
    mocks.confirm.mockResolvedValueOnce(false);
    mocks.text.mockResolvedValueOnce("");
    mocks.text.mockResolvedValueOnce("");
    mocks.confirm.mockResolvedValueOnce(false);

    await main();

    expect(logSpy).not.toHaveBeenCalled();
    expect(mocks.spinner).not.toHaveBeenCalled();
  });

  it("exits cleanly with no report on cancel", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.text.mockResolvedValueOnce(Symbol.for("clack:cancel"));

    await main();

    expect(mocks.cancel).toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });
});
