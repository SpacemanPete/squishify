import { mkdir, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  outro,
  select,
  path as clackPath,
  spinner,
  text,
} from "@clack/prompts";

import { buildOutputName, resolveCollision } from "./naming.ts";
import { formatProgress, type ProgressCounts } from "./progress.ts";
import type { OutputFormat } from "./quality.ts";
import { processImage, type ProcessOptions } from "./process.ts";

import type { ResizeAxis } from "./resize.ts";

export const CANCEL = Symbol.for("clack:cancel");

export const SUPPORTED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "avif",
  "tif",
  "tiff",
  "gif",
]);

export function expandHome(input: string, homeDir: string = homedir()): string {
  if (input === "~") return homeDir;
  if (input.startsWith("~/")) return homeDir + input.slice(1);
  return input;
}

export async function promptInputDirectory(): Promise<string | typeof CANCEL> {
  for (;;) {
    const value = await clackPath({
      message: "Which folder holds your images?",
      directory: true,
      root: process.cwd(),
    });
    if (isCancel(value)) {
      cancel("Cancelled.");
      return CANCEL;
    }
    const dir = expandHome(String(value).trim());
    const problem = await findDirProblem(dir);
    if (problem === null) {
      return dir;
    }
    log.warn(problem);
  }
}

async function findDirProblem(dir: string): Promise<string | null> {
  let info;
  try {
    info = await stat(dir);
  } catch {
    return "That path doesn't exist — try again.";
  }
  if (!info.isDirectory()) {
    return "That's not a folder — try again.";
  }
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return "That folder can't be read — try again.";
  }
  const hasImages = entries.some((name) => SUPPORTED_EXTENSIONS.has(extOf(name)));
  if (!hasImages) {
    return "That folder has no supported images — try again.";
  }
  return null;
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export interface PromptConfig {
  resize: { axis: ResizeAxis; maxDimension: number } | null;
  format: OutputFormat;
  capBytes: number | null;
  prefix: string;
  suffix: string;
}

export async function promptConfig(): Promise<PromptConfig | typeof CANCEL> {
  const resize = await promptResize();
  if (resize === CANCEL) return CANCEL;
  const format = await promptFormat();
  if (format === CANCEL) return CANCEL;
  const capBytes = await promptCap();
  if (capBytes === CANCEL) return CANCEL;
  const prefix = await promptText("Prefix (optional)", "prod-");
  if (prefix === CANCEL) return CANCEL;
  const suffix = await promptText("Suffix (optional)", "-web");
  if (suffix === CANCEL) return CANCEL;
  return { resize, format, capBytes, prefix, suffix };
}

async function promptResize(): Promise<PromptConfig["resize"] | typeof CANCEL> {
  const enabled = await confirm({ message: "Resize your images?" });
  if (isCancel(enabled)) return cancelRun();
  if (!enabled) return null;
  const axis = await select({
    message: "Fit by what?",
    options: [
      { value: "width", label: "Width" },
      { value: "height", label: "Height" },
    ] as const,
  });
  if (isCancel(axis)) return cancelRun();
  const pixels = await text({
    message: "Maximum pixels?",
    placeholder: "2000",
    validate: positiveNumber,
  });
  if (isCancel(pixels)) return cancelRun();
  return { axis, maxDimension: Number(pixels) };
}

async function promptFormat(): Promise<OutputFormat | typeof CANCEL> {
  const format = await select({
    message: "Output format?",
    options: [
      { value: "jpeg", label: "JPEG" },
      { value: "webp", label: "WebP" },
      { value: "avif", label: "AVIF" },
      { value: "png", label: "PNG" },
    ] as const,
  });
  if (isCancel(format)) return cancelRun();
  return format;
}

async function promptCap(): Promise<number | null | typeof CANCEL> {
  const enabled = await confirm({ message: "Cap the output file size?" });
  if (isCancel(enabled)) return cancelRun();
  if (!enabled) return null;
  const value = await text({
    message: "Maximum size?",
    placeholder: "500",
    validate: positiveNumber,
  });
  if (isCancel(value)) return cancelRun();
  const unit = await select({
    message: "In what unit?",
    options: [
      { value: "kb", label: "Kilobytes (KB)" },
      { value: "mb", label: "Megabytes (MB)" },
    ],
  });
  if (isCancel(unit)) return cancelRun();
  const factor = unit === "mb" ? 1024 * 1024 : 1024;
  return Number(value) * factor;
}

async function promptText(message: string, placeholder: string): Promise<string | typeof CANCEL> {
  const value = await text({
    message,
    placeholder,
    validate: (input) =>
      /[/\\]|\.\./.test(input ?? "") ? "Must not contain path separators (/, \\, ..)." : undefined,
  });
  if (isCancel(value)) return cancelRun();
  return String(value).trim();
}

function positiveNumber(value: string | undefined): string | undefined {
  const n = Number(value ?? "");
  return n > 0 && Number.isFinite(n) ? undefined : "Enter a positive number.";
}

function cancelRun(): typeof CANCEL {
  cancel("Cancelled.");
  return CANCEL;
}

export function summaryText(dir: string, config: PromptConfig, outDir: string): string {
  const resize = config.resize
    ? `fit ${config.resize.axis} to ${config.resize.maxDimension}px`
    : "no resize";
  const cap = config.capBytes === null ? "no cap" : formatCap(config.capBytes);
  return [
    `Folder:  ${dir}`,
    `Output:  ${outDir}`,
    `Format:  ${config.format}`,
    `Resize:  ${resize}`,
    `Size cap: ${cap}`,
    `Prefix:  ${config.prefix || "(none)"}`,
    `Suffix:  ${config.suffix || "(none)"}`,
  ].join("\n");
}

export function formatCap(capBytes: number): string {
  if (capBytes === 0) return "0 KB";
  if (capBytes % (1024 * 1024) === 0) {
    return `${capBytes / (1024 * 1024)} MB`;
  }
  const kb = capBytes / 1024;
  return `${Math.round(kb * 10) / 10} KB`;
}

export async function confirmSummary(
  dir: string,
  config: PromptConfig,
  outDir: string,
): Promise<boolean | typeof CANCEL> {
  log.info(summaryText(dir, config, outDir));
  const ok = await confirm({ message: "Start processing?", initialValue: false });
  if (isCancel(ok)) return cancelRun();
  return ok;
}

export function toProcessOptions(config: PromptConfig): ProcessOptions {
  return {
    format: config.format,
    ...(config.resize ? { resize: config.resize } : {}),
    ...(config.capBytes !== null ? { capBytes: config.capBytes } : {}),
  };
}

export async function listImages(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const files: string[] = [];
  for (const entry of entries) {
    if (!SUPPORTED_EXTENSIONS.has(extOf(entry))) continue;
    let info;
    try {
      info = await stat(path.join(dir, entry));
    } catch {
      continue;
    }
    if (info.isFile()) {
      files.push(entry);
    }
  }
  return files.sort();
}

export async function pickOutputDir(dir: string): Promise<string> {
  for (let n = 1; ; n++) {
    const candidate = path.join(dir, n === 1 ? "processed" : `processed_${n}`);
    let info;
    try {
      info = await stat(candidate);
    } catch {
      return candidate;
    }
    if (info.isDirectory()) {
      const entries = await readdir(candidate);
      if (entries.length === 0) return candidate;
    }
  }
}

export interface ProcessedEntry {
  source: string;
  output: string;
  format: OutputFormat;
  width: number;
  height: number;
  size: number;
  capMet?: boolean;
  warning?: string;
}

export interface SkippedEntry {
  source: string;
  reason: string;
}

export interface ErrorEntry {
  source: string;
  reason: string;
}

export interface ProgressInfo {
  index: number;
  total: number;
  name: string;
  counts: ProgressCounts;
}

export interface BatchHooks {
  onProgress?(info: ProgressInfo): void;
  isCancelled?(): boolean;
}

export interface BatchResult {
  status: "completed" | "cancelled";
  processed: ProcessedEntry[];
  skipped: SkippedEntry[];
  errors: ErrorEntry[];
  totalOutputBytes: number;
  outputDir: string;
}

export async function runBatch(
  dir: string,
  outDir: string,
  config: PromptConfig,
  hooks: BatchHooks = {},
): Promise<BatchResult> {
  await mkdir(outDir, { recursive: true });

  const result: BatchResult = {
    status: "completed",
    processed: [],
    skipped: [],
    errors: [],
    totalOutputBytes: 0,
    outputDir: outDir,
  };

  const names = await listImages(dir);
  const usedNames: string[] = [];
  const options = toProcessOptions(config);

  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    const counts: ProgressCounts = {
      processed: result.processed.length,
      skipped: result.skipped.length,
      errors: result.errors.length,
    };
    hooks.onProgress?.({ index: i + 1, total: names.length, name, counts });
    if (hooks.isCancelled?.()) {
      result.status = "cancelled";
      break;
    }

    const outName = resolveCollision(
      buildOutputName(name, {
        prefix: config.prefix,
        suffix: config.suffix,
        ext: "." + config.format,
      }),
      usedNames,
    );
    try {
      const res = await processImage(path.join(dir, name), path.join(outDir, outName), options);
      if (res.status === "ok") {
        result.processed.push({
          source: name,
          output: outName,
          format: res.format,
          width: res.width,
          height: res.height,
          size: res.size,
          ...(res.capMet !== undefined ? { capMet: res.capMet } : {}),
          ...(res.warning !== undefined ? { warning: res.warning } : {}),
        });
        usedNames.push(outName);
        result.totalOutputBytes += res.size;
      } else {
        result.skipped.push({ source: name, reason: res.reason });
      }
    } catch (error) {
      result.errors.push({
        source: name,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

export interface SpinnerLike {
  start(msg?: string): void;
  stop(msg?: string): void;
  cancel(msg?: string): void;
  message(msg?: string): void;
  readonly isCancelled: boolean;
}

export async function runWithSpinner(
  dir: string,
  outDir: string,
  config: PromptConfig,
  spinner: SpinnerLike,
): Promise<BatchResult> {
  spinner.start("Processing...");
  const result = await runBatch(dir, outDir, config, {
    onProgress: (info) => {
      spinner.message(formatProgress(info.index, info.total, info.name, info.counts));
    },
    isCancelled: () => spinner.isCancelled,
  });
  if (result.status === "cancelled") {
    spinner.cancel("Cancelled.");
  } else {
    spinner.stop("Done.");
  }
  return result;
}

export function renderReport(result: BatchResult): string {
  const lines: string[] = [
    `Processed ${result.processed.length}, skipped ${result.skipped.length}, errors ${result.errors.length}`,
    `Output: ${result.outputDir}`,
  ];
  for (const p of result.processed) {
    const capNote = p.capMet === false ? " (cap not met)" : "";
    const warnNote = p.warning !== undefined ? ` — ${p.warning}` : "";
    lines.push(
      `  ${p.source} -> ${p.output} (${p.format}, ${p.width}x${p.height}, ${formatCap(p.size)})${capNote}${warnNote}`,
    );
  }
  for (const s of result.skipped) {
    lines.push(`  ${s.source} -> skipped: ${s.reason}`);
  }
  for (const e of result.errors) {
    lines.push(`  ${e.source} -> error: ${e.reason}`);
  }
  lines.push(`Total output: ${formatCap(result.totalOutputBytes)}`);
  if (result.skipped.length + result.errors.length > 0) {
    lines.push("");
    lines.push("Failed files:");
    for (const s of result.skipped) {
      lines.push(`  - ${s.source}: ${s.reason}`);
    }
    for (const e of result.errors) {
      lines.push(`  - ${e.source}: ${e.reason}`);
    }
  }
  return lines.join("\n");
}

export async function main(): Promise<void> {
  intro("squooshy");

  const dir = await promptInputDirectory();
  if (dir === CANCEL) {
    outro();
    return;
  }
  const config = await promptConfig();
  if (config === CANCEL) {
    outro();
    return;
  }
  const outDir = await pickOutputDir(dir);
  const confirmed = await confirmSummary(dir, config, outDir);
  if (confirmed !== true) {
    outro();
    return;
  }

  const result = await runWithSpinner(dir, outDir, config, spinner());
  if (result.status === "cancelled") {
    outro();
    return;
  }
  console.log(renderReport(result));
  outro("Done.");
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
