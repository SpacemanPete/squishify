import { mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

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

  let pipeline = sharp(buffer);
  if (resize) {
    const decision = shouldResize(
      metadata.width ?? 0,
      metadata.height ?? 0,
      resize.maxDimension,
      resize.axis,
    );
    if (decision.resize) {
      pipeline = pipeline.resize({ width: decision.width, height: decision.height });
    }
  }

  let encoded: Buffer;
  let capMet: boolean | undefined;
  if (capBytes !== undefined) {
    const result = await findQualityUnderCap(buffer, format, capBytes);
    encoded = result.buffer;
    capMet = result.met;
  } else {
    encoded = await pipeline.toFormat(format, { quality: 80 }).toBuffer();
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
    return { status: "skipped", reason: `unreadable: ${(error as Error).message}` };
  }
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.format === "gif") {
      return { status: "skipped", reason: "unsupported format: gif" };
    }
    return { status: "ok", value: { buffer, metadata } };
  } catch (error) {
    return { status: "skipped", reason: `unreadable: ${(error as Error).message}` };
  }
}

async function writeTempAndRename(outputPath: string, buffer: Buffer): Promise<void> {
  const temp = await mkdtemp(path.join(tmpdir(), "squooshy-write-"));
  const tempFile = path.join(temp, "out");
  await writeFile(tempFile, buffer);
  await rename(tempFile, outputPath);
}
