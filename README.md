# squooshy

An interactive CLI that batch-processes a folder of images for a design → product workflow. Answer a few prompts instead of remembering flags, and get back a clean, web-ready set of files in a `processed/` subfolder. Originals are never touched.

## Features

- **Interactive prompts** — a type-ahead folder finder (arrow keys to navigate, Tab to complete), resize, output format, size cap, prefix/suffix, then a confirmation summary before anything is written.
- **Live progress** — a spinner updates once per file (`Processing 12/24 — hero.png (processed 9, skipped 1, errors 2)`) so you can monitor long batches; rendered to stderr so stdout carries only the final report.
- **Resize to fit** — constrain max width _or_ max height; aspect ratio is always preserved, and images already smaller than the target are left alone rather than upscaled.
- **Format conversion** — WebP, JPEG, PNG, or AVIF output.
- **Per-file size cap** — encodes at quality 80, then steps down by 10 to a floor of 20 until the file fits the cap; warns if the cap can't be met. Skipped for PNG (lossless output ignores quality).
- **Consistent naming** — `[prefix]<original-name>[suffix].<ext>`, with `-1`, `-2`, … appended on collision instead of overwriting.
- **Safe writes** — output goes to a fresh `<source-dir>/processed/` (or `processed_2/`, `processed_3/`, … if a previous run's output is still there) via temp file + rename, so a mid-run failure leaves no partial files and a rerun never mingles with earlier output.
- **Clear reporting** — per-file source → output, format, dimensions, size; plus totals for processed / skipped / errored and a list of failures with reasons.

## Requirements

- Node.js 24 LTS (native TypeScript type stripping — no `tsx`).
- pnpm.

## Install

```sh
pnpm install
```

## Usage

```sh
pnpm start
```

> `start` is an alias for `dev` (`node src/index.ts`); see Scripts.

### Example run

```
? Which folder holds your images? ~/design/exports
? Resize your images? yes
  ? Fit by what? Width
  ? Maximum pixels? 2000
? Output format? WebP
? Cap the output file size? yes
  ? Maximum size? 500
  ? In what unit? Kilobytes (KB)
? Prefix (optional) prod-
? Suffix (optional) -web

Folder:  ~/design/exports
Output:  ~/design/exports/processed
Format:  webp
Resize:  fit width to 2000px
Size cap: 500 KB
Prefix:  prod-
Suffix:  -web

? Start processing? y
╭─ Processing 12/24 — hero.png (processed 9, skipped 1, errors 2) ╮
╰─ spinner updates once per file while processing                 ╯

Processed 24, skipped 1, errors 1
Output: ~/design/exports/processed
  hero.png -> prod-hero-web.webp (webp, 2000x1500, 245 KB)
  ...
Total output: 2.4 MB
```

The folder prompt is clack's path finder: it starts in the current directory and suggests matching paths as you type — navigate with the arrow keys, hit Tab to accept a suggestion. A leading `~` is resolved to your home directory when you submit (the finder itself doesn't expand it while typing).

`image.png` becomes `~/design/exports/processed/prod-image-web.webp`. Each run writes to a fresh output folder — if `processed/` already holds files from an earlier run, squooshy picks the next free name (`processed_2/`, `processed_3/`, …; an existing empty folder is reused), and that choice is shown in the summary before you confirm. The progress display goes to stderr; the final report is the only stdout output, so it stays scriptable.

## Supported formats

**Read:** JPEG, PNG, WebP, TIFF, AVIF (subject to the local libvips build).
**Write:** WebP, JPEG, PNG, AVIF.

GIFs are detected and skipped with the reason `unsupported format: gif`. Corrupt or unreadable files are skipped with a logged reason rather than aborting the run.

## Out of scope

No GUI, watch mode, cloud/CMS upload, pure-rename mode, ICC/color-profile handling, watermarking, multi-size output sets in one run, or recursion into subfolders (top-level files only).

## Scripts

| Script              | Does                                                       |
| ------------------- | ---------------------------------------------------------- |
| `pnpm dev`          | Run the interactive CLI directly (`node src/index.ts`)     |
| `pnpm start`        | Alias for `dev`                                            |
| `pnpm check`        | Typecheck (`tsc -p tsconfig.json`)                         |
| `pnpm build`        | Emit to `dist/` (`tsc -p tsconfig.build.json`)             |
| `pnpm test`         | Run the test suite with coverage (Vitest)                  |
| `pnpm lint`         | Lint (ESLint, type-aware, `--max-warnings 0`)              |
| `pnpm format`       | Format with Prettier                                       |
| `pnpm format:check` | Verify formatting                                          |
| `pnpm verify`       | Aggregate gate: check + lint + format:check + test + build |

## Project layout

```
src/index.ts       prompt flow + orchestration + progress spinner (shell)
src/process.ts     resize, convert, quality-cap loop, temp-file writes (shell)
src/naming.ts      output filename + collision resolution (pure)
src/resize.ts      resize decision + dimension math (pure)
src/quality.ts     quality-cap loop (pure)
src/progress.ts    progress message formatter (pure)
src/*.test.ts      unit tests (colocated)
src/pipeline.test.ts  end-to-end smoke test
tests/fixtures/    sample images for the end-to-end test
dist/              build output (gitignored)
```

Pure core modules (`naming.ts`, `resize.ts`, `quality.ts`, `progress.ts`) are the coverage-measured surface; `process.ts` and `index.ts` are thin shells over them.

Built on [sharp](https://sharp.pixelplumbing.com/) (libvips) for processing and [@clack/prompts](https://github.com/bombshell-dev/clack) for the prompt flow and progress spinner.

This project follows the portfolio's Node + TypeScript house standard (`.agents/AGENTS-NODE.md`): Node 24, pnpm, ESM with on-disk `.ts` import extensions, functional core / imperative shell, and a `pnpm verify` quality gate.

**Deliberate divergences from `.agents/AGENTS-NODE.md` (project wins; do not "fix" back):** `tsconfig.json` omits `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` / `noImplicitOverride` / `isolatedModules` (type-aware ESLint covers the unused-vars gap); `tsconfig.build.json` omits `rootDir` / `declarationMap` (output lands flat in `dist/` because `include` is `src`); `.prettierrc` uses `printWidth: 100` instead of 88; the `build` script prepends a `rm -rf dist` clean step so stale output is never shipped; the PRD's fixed `processed/` output folder is replaced by a numbered fresh-per-run folder (`processed/`, `processed_2/`, …) so a rerun never overwrites or mingles with earlier output.
