# PRD — Interactive Batch Image Processor CLI

## Introduction / Overview

A standalone interactive command-line application that walks the user through a short series of prompts and then batch-processes a folder of images for a design→product workflow. Instead of remembering command-line flags or writing ad-hoc scripts each time, the user answers questions, the tool applies consistent processing rules, and outputs a clean, web-ready set of files in a subfolder.

**Problem:** Preparing a set of design exports for use in a product (web build, print, CMS upload, or client delivery) is repetitive: images must be resized to fit, converted to a target format, kept under a size budget, and given consistent names. Doing this by hand is slow and error-prone, and shell one-liners don't prompt or apply rules consistently.

**Goal:** A single `node` command that interactively captures processing preferences and produces a uniform batch of processed images with predictable file names.

---

## Goals

1. Provide an interactive prompt flow covering: input directory, resize preference, output format, optional per-file size cap, and filename prefix/suffix.
2. Preserve source images — never overwrite originals; write processed results to a `processed/` subfolder inside the selected source directory.
3. Resize (when requested) to fit a maximum width **or** maximum height while preserving aspect ratio.
4. When a size cap is requested, enforce it via a quality-reduction loop (lower encode quality until the file is under the cap) with a sensible floor so quality does not degrade indefinitely.
5. Support runtime selection of output format from a menu: WebP, JPEG, PNG, AVIF.
6. Output predictable filenames via a user-supplied prefix, suffix, or both (e.g. `prod-` / `-web`).
7. Print a clear summary at the end: files processed, skipped, errors, and resulting sizes.

---

## User Stories

### Designer — daily export prep

As a designer preparing deliverables, I want to point the tool at my exports folder, answer a few questions, and get back a folder of sized, converted, size-capped files so that I can drop them straight into the product or client package without manual tweaking.

- I run `npm start`.
- I type or select a folder path; the tool validates it exists and contains images.
- I answer whether to resize and, if so, the max width or max height.
- I pick an output format from a menu (WebP / JPEG / PNG / AVIF).
- I optionally set a target size in KB/MB.
- I optionally enter a prefix and/or suffix.
- The tool processes the images, reports each result, and never touches my originals.

### Design lead — consistent naming

As a design lead enforcing file conventions, I want every processed file to carry a consistent prefix/suffix so that naming across a delivery set is uniform.

- I enter a prefix like `prod-` or a suffix like `-web`.
- Every output file is named `[prefix]<original-name>[suffix].[ext]` in the `processed/` folder.
- Collisions are handled by appending a counter rather than overwriting.

### Web developer — size budgets

As a developer with a page-weight budget, I want every image under a specific size limit so that my pages load fast.

- I set a cap such as 500 KB.
- The tool encodes at high quality first, then re-encodes at progressively lower quality until the file fits under the cap, stopping at a quality floor (e.g. 20) and reporting if the cap cannot be met.

---

## Functional Requirements

### Prompt flow (interactive CLI)

1. The CLI MUST run as an interactive Node.js program using prompts (e.g. `@clack/prompts` or `inquirer`).
2. The CLI MUST prompt for, in order:
   - **Input directory** — path to a folder of source images. Validate the path exists, is a directory, and contains at least one supported image file. Offer default suggestions and a "re-enter" loop on invalid input.
   - **Resize?** — yes/no. If yes, ask whether to fit by **max width** or **max height** and the pixel value (positive integer).
   - **Output format** — menu selection: WebP, JPEG, PNG, AVIF.
   - **Per-file size cap?** — yes/no. If yes, ask for the cap value with unit (KB or MB).
   - **Prefix** — optional string prepended to each output filename.
   - **Suffix** — optional string appended to each output filename (before the extension).
3. The CLI MUST show a final confirmation summary of all answers and a Y/n confirmation before processing begins.
4. The CLI MUST support cancelling at any prompt (Ctrl-C / cancel key) with a clean exit message and no partial writes.

### Image processing

5. Supported source formats: JPEG, PNG, WebP, TIFF, AVIF (read support where the underlying libvips build allows).
6. GIF files MUST be skipped with a logged reason ("unsupported format: gif") rather than processed or crashed on.
7. The tool MUST preserve aspect ratio whenever resizing; only one dimension (width or height) is constrained, and the other scales proportionally.
8. When a max dimension is requested and the source is already smaller on both axes, the tool SHOULD skip resizing that file (report as "already fits") rather than upscaling.
9. The tool MUST never write to or modify source files.

### Size capping

10. When a size cap is set, the tool MUST encode at a starting quality (e.g. 80) and, if the result exceeds the cap, re-encode at decreasing quality steps (e.g. -10) down to a floor (e.g. 20).
11. If the file still exceeds the cap at the floor, the tool MUST keep the smallest result and report a warning that the cap could not be met.
12. Size caps SHOULD NOT apply to PNG output unless the user explicitly confirms, since lossless formats do not respond to quality reduction; if set, the tool should warn and skip the cap logic for PNG.

### Output & naming

13. Output files MUST be written to a `processed/` subfolder inside the source directory (`<source-dir>/processed/`), created if missing.
14. Output filenames MUST follow `[prefix]<original-basename>[suffix].<new-ext>` (e.g. `image.png` + prefix `prod-` + suffix `-web` + WebP → `prod-image-web.webp`).
15. On filename collision within `processed/`, the tool MUST append `-1`, `-2`, etc. instead of overwriting.
16. The tool MUST not leave partially-written files behind if processing fails mid-way; write to a temp file then rename into place.

### Reporting

17. After processing, the CLI MUST print a per-file summary: source name → output name, output format, output dimensions, and output size (KB/MB).
18. The CLI MUST print a grand total: number processed, number skipped, number of errors, and total output size.
19. The CLI MUST print a list of any files that failed, with the reason, at the end.

### Errors

20. Unsupported or corrupt files MUST be skipped with a logged reason (not crash the whole run).
21. Permission errors, missing source folder, or an empty folder MUST produce a friendly error and return to the input prompt rather than exiting abruptly.

---

## Non-Goals (Out of Scope)

- GUI / web interface — CLI only.
- Watch mode / folder auto-processing on file drop.
- Cloud upload, CDN pushing, or CMS integration.
- Batch renaming without processing (pure rename mode).
- Color profile management / ICC conversion.
- Batch watermarking, metadata stripping options, or EXIF handling beyond what libvips does by default.
- GIF support (animated or first-frame) — GIFs are detected, logged, and skipped.
- Multi-size output sets (e.g. thumb + full) in a single run — resize is one target per run.
- Parallel/multicore scheduling tuning beyond what the image library does automatically.
- Image deduplication or similarity detection.

---

## Design Considerations

### CLI experience

- Use `@clack/prompts` for a polished, spinner-supported interactive flow (the user's other Node projects are prompt-friendly; keep dependencies minimal).
- Use ANSI colors only where they aid readability; keep output greppable for scripting (e.g. `--json` flag is a future extension, not required now).
- Each prompt should show the default option clearly and allow Enter to accept it.

### Proposed prompt sequence

```
? Select a folder of images: [path picker / typed path]
? Resize images to fit? [yes / no]
  ? Fit by max [width / height]: 2000
? Output format: [WebP / JPEG / PNG / AVIF]
? Cap each file at a target size? [yes / no]
  ? Max file size [KB/MB]: 500 KB
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

---

## Technical Considerations

| Area | Detail |
|------|--------|
| Runtime | Node.js (≥18, current LTS preferred) |
| Image library | `sharp` (libvips) — fastest available for batch work, high-quality output, first-class WebP/AVIF encode support |
| CLI prompts | `@clack/prompts` (recommended) or `inquirer` — one dependency, keep it small |
| Project layout | Flat: `src/index.ts` + `src/process.ts` + `src/naming.ts`, `package.json`, `README.md`, `tests/` |
| Scripts | `start` → run the CLI (`tsx src/index.ts`); `build` → `tsc`; `test` → run tests; `lint` → run linter |
| Language | TypeScript — compiled with `tsc` or run directly via `tsx`; types for prompt answers and processing config |
| Testing | Unit tests for pure logic (filename building, quality-loop, cap math) with Vitest; CLI flow tested via mocked prompt answers |
| Naming logic | Pure function: `buildOutputName(original, {prefix, suffix, ext})` → `[prefix]<base>[suffix].ext` with collision resolution |
| Quality loop | Pure function: `findQualityUnderCap(buffer, format, cap, {start=80, step=10, floor=20})` → quality level + final buffer |

**Key files to create:**

- `package.json` — deps (`sharp`, `@clack/prompts`), scripts
- `src/index.ts` — prompt flow + orchestration
- `src/process.ts` — per-image processing (resize, convert, cap loop)
- `src/naming.ts` — output filename + collision logic
- `src/process.test.ts` / `src/naming.test.ts` — unit tests
- `README.md` — usage + example run

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Correctness | Processing a test set of 24 mixed images (JPEG/PNG/WebP/TIFF) produces 24 outputs in `processed/` with expected names |
| Size cap | With a 500 KB cap and quality loop, every WebP/JPEG output is ≤ 500 KB, or explicitly reported as unmeetable |
| Aspect ratio | Resized images preserve aspect ratio exactly (dimension check on outputs) |
| Safety | Original files are byte-identical after a run (hash check on a sample) |
| Speed | A 50-image JPEG batch (≈4 MB each) completes in under ~10 seconds on a mid-range laptop |
| UX | Prompt flow completable end-to-end with defaults alone in ≤ 60 seconds |
| Quality | `npm run lint && npm test` pass from the project root |

---

## Open Questions

*Resolved during kickoff (2026-08-19):*

1. **Language:** TypeScript (B) — type-safe prompt answers and processing config.
2. **GIF:** skipped entirely (C) — not supported, logged and skipped with a reason.
3. **PNG + size cap:** warn and skip the cap for PNG (A) — lossless output is kept at full quality regardless of cap.
4. **Subfolders:** top-level files only (A) — the `processed/` folder contains only files from the selected folder, no recursion.

*No remaining open questions.*

---

## Implementation Task Outline

1. Scaffold project (`package.json`, deps, folder layout, README).
2. Implement `src/naming.ts` (+ tests) — filename builder + collision resolution.
3. Implement `src/process.ts` (+ tests) — resize, convert, quality-cap loop.
4. Implement `src/index.ts` prompt flow — ordered questions, validation, summary confirm, error handling.
5. Wire orchestration: walk folder → process each → write to `processed/` → report summary.
6. Add a sample fixture set + end-to-end smoke test.
7. Run `npm run lint && npm test` and verify on a real image folder.
