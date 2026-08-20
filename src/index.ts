import { readdir, stat } from "node:fs/promises";

import { cancel, confirm, isCancel, log, select, text } from "@clack/prompts";

import type { ProcessOptions } from "./process.ts";

import type { OutputFormat } from "./quality.ts";
import type { ResizeAxis } from "./resize.ts";

export const CANCEL = Symbol.for("clack:cancel");

export const SUPPORTED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif", "tif", "tiff"]);

export async function promptInputDirectory(): Promise<string | typeof CANCEL> {
  for (;;) {
    const value = await text({
      message: "Which folder holds your images?",
      placeholder: "./images",
    });
    if (isCancel(value)) {
      cancel("Cancelled.");
      return CANCEL;
    }
    const dir = String(value).trim();
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
  const value = await text({ message, placeholder });
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

export function summaryText(dir: string, config: PromptConfig): string {
  const resize = config.resize
    ? `fit ${config.resize.axis} to ${config.resize.maxDimension}px`
    : "no resize";
  const cap = config.capBytes === null ? "no cap" : formatCap(config.capBytes);
  return [
    `Folder:  ${dir}`,
    `Format:  ${config.format}`,
    `Resize:  ${resize}`,
    `Size cap: ${cap}`,
    `Prefix:  ${config.prefix || "(none)"}`,
    `Suffix:  ${config.suffix || "(none)"}`,
  ].join("\n");
}

export function formatCap(capBytes: number): string {
  if (capBytes % (1024 * 1024) === 0) {
    return `${capBytes / (1024 * 1024)} MB`;
  }
  return `${capBytes / 1024} KB`;
}

export async function confirmSummary(
  dir: string,
  config: PromptConfig,
): Promise<boolean | typeof CANCEL> {
  log.info(summaryText(dir, config));
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
