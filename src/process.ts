import { readFile, rename, rm, writeFile } from "node:fs/promises";

import sharp, { type Metadata } from "sharp";

import { findQualityUnderCap, type OutputFormat } from "./quality.ts";
import { shouldResize, type ResizeAxis } from "./resize.ts";

export interface ProcessOptions {
  format: OutputFormat;
  resize?: { axis: ResizeAxis; maxDimension: number };
  capBytes?: number;
}

export type ProcessResult =
  | {
      status: "ok";
      outputPath: string;
      format: OutputFormat;
      width: number;
      height: number;
      size: number;
      capMet?: boolean;
      warning?: string;
    }
  | { status: "skipped"; reason: string };

export async function processImage(
  inputPath: string,
  outputPath: string,
  { format, resize, capBytes }: ProcessOptions,
): Promise<ProcessResult> {
  const input = await readInput(inputPath);
  if (input.status === "skipped") {
    return input;
  }
  const { buffer, metadata } = input.value;

  let working = buffer;
  if (resize) {
    const decision = shouldResize(
      metadata.width ?? 0,
      metadata.height ?? 0,
      resize.maxDimension,
      resize.axis,
    );
    if (decision.resize) {
      working = await sharp(working)
        .resize({ width: decision.width, height: decision.height })
        .toBuffer();
    }
  }

  let encoded: Buffer;
  let capMet: boolean | undefined;
  let warning: string | undefined;
  if (capBytes !== undefined) {
    const result = await findQualityUnderCap(working, format, capBytes);
    encoded = result.buffer;
    capMet = result.met;
    if (result.warning !== undefined) warning = result.warning;
  } else {
    encoded = await sharp(working).toFormat(format, { quality: 80 }).toBuffer();
  }

  await writeTempAndRename(outputPath, encoded);

  const outputMetadata = await sharp(encoded).metadata();
  return {
    status: "ok",
    outputPath,
    format,
    width: outputMetadata.width ?? 0,
    height: outputMetadata.height ?? 0,
    size: encoded.byteLength,
    ...(capMet !== undefined ? { capMet } : {}),
    ...(warning !== undefined ? { warning } : {}),
  };
}

async function readInput(
  inputPath: string,
): Promise<
  | { status: "skipped"; reason: string }
  | { status: "ok"; value: { buffer: Buffer; metadata: Metadata } }
> {
  let buffer: Buffer;
  try {
    buffer = await readFile(inputPath);
  } catch (error) {
    return { status: "skipped", reason: `unreadable: ${errorMessage(error)}` };
  }
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.format === "gif") {
      return { status: "skipped", reason: "unsupported format: gif" };
    }
    return { status: "ok", value: { buffer, metadata } };
  } catch (error) {
    return { status: "skipped", reason: `unreadable: ${errorMessage(error)}` };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function writeTempAndRename(outputPath: string, buffer: Buffer): Promise<void> {
  const tempFile = `${outputPath}.tmp-${process.pid}`;
  try {
    await writeFile(tempFile, buffer);
    await rename(tempFile, outputPath);
  } finally {
    await rm(tempFile, { force: true });
  }
}
