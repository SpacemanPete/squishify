# squooshy

An interactive CLI that batch-processes a folder of images for a design → product workflow. Answer a few prompts instead of remembering flags, and get back a clean, web-ready set of files in a `processed/` subfolder. Originals are never touched.

> **Status:** specified, not yet implemented. See [tasks/prd-image-batch.md](tasks/prd-image-batch.md) and [tasks/tasks-image-batch.md](tasks/tasks-image-batch.md).

## Features

- **Interactive prompts** — input folder, resize, output format, size cap, prefix/suffix, then a confirmation summary before anything is written.
- **Resize to fit** — constrain max width *or* max height; aspect ratio is always preserved, and images already smaller than the target are left alone rather than upscaled.
- **Format conversion** — WebP, JPEG, PNG, or AVIF output.
- **Per-file size cap** — encodes at quality 80, then steps down by 10 to a floor of 20 until the file fits the cap; warns if the cap can't be met. Skipped for PNG (lossless output ignores quality).
- **Consistent naming** — `[prefix]<original-name>[suffix].<ext>`, with `-1`, `-2`, … appended on collision instead of overwriting.
- **Safe writes** — output goes to `<source-dir>/processed/` via temp file + rename, so a mid-run failure leaves no partial files.
- **Clear reporting** — per-file source → output, format, dimensions, size; plus totals for processed / skipped / errored and a list of failures with reasons.

## Requirements

Node.js ≥ 18 (current LTS preferred).

## Install

```sh
npm install
```

## Usage

```sh
npm start
```

### Example run

```
? Select a folder of images: ~/design/exports
? Resize images to fit? yes
  ? Fit by max width: 2000
? Output format: WebP
? Cap each file at a target size? yes
  ? Max file size: 500 KB
? Prefix (optional): prod-
? Suffix (optional): -web

Summary:
  Source: ~/design/exports
  Output: ~/design/exports/processed
  Resize: fit width ≤ 2000px
  Format: webp
  Cap: 500 KB
  Naming: prod-<name>-web.webp

Process 24 images? [y/N]
```

`image.png` becomes `~/design/exports/processed/prod-image-web.webp`.

## Supported formats

**Read:** JPEG, PNG, WebP, TIFF, AVIF (subject to the local libvips build).
**Write:** WebP, JPEG, PNG, AVIF.

GIFs are detected and skipped with the reason `unsupported format: gif`. Corrupt or unreadable files are skipped with a logged reason rather than aborting the run.

## Out of scope

No GUI, watch mode, cloud/CMS upload, pure-rename mode, ICC/color-profile handling, watermarking, multi-size output sets in one run, or recursion into subfolders (top-level files only).

## Scripts

| Script | Does |
|---|---|
| `npm start` | Run the interactive CLI (`tsx src/index.ts`) |
| `npm run build` | Compile TypeScript (`tsc`) |
| `npm test` | Run the test suite (Vitest) |
| `npm run lint` | Lint (ESLint) |

## Project layout

```
src/index.ts     prompt flow + orchestration
src/process.ts   resize, convert, quality-cap loop
src/naming.ts    output filename + collision resolution
src/*.test.ts    unit tests (colocated)
tests/fixtures/  sample images for the end-to-end test
```

Built on [sharp](https://sharp.pixelplumbing.com/) (libvips) for processing and [@clack/prompts](https://github.com/bombshell-dev/clack) for the prompt flow.
