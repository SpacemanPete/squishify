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
8. Show live progress while processing so the user can monitor a long batch run.

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

### Design lead — batch monitoring

As a user running a large batch, I want to see what the tool is doing right now — which file it's on, how far through the batch it is, and how many files have succeeded, been skipped, or failed — so that I can spot a stuck or failing run without waiting for the final report.

- While processing, a live spinner shows the current file and a running `i/total` counter with processed/skipped/error counts.
- The progress display never hides or interferes with the final per-file report.
- If I cancel mid-run, the progress display disappears cleanly and no partial files remain.

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

### Progress display

20. During processing, the CLI MUST show live progress via an `@clack/prompts` spinner updating once per file, in the form `Processing 12/24 — hero.png (processed 9, skipped 1, errors 2)`.
21. Progress output MUST go to **stderr** (it is diagnostics, not data). `@clack/prompts` renders to stderr natively, so stdout carries only the final report and stays pipeable (e.g. future `--json`).
22. The spinner MUST stop cleanly before the final report is printed. On Ctrl-C / cancel during processing, the spinner MUST disappear and the CLI MUST exit with a clean message and no partial writes (consistent with requirement 4).

### Errors

23. Unsupported or corrupt files MUST be skipped with a logged reason (not crash the whole run).
24. Permission errors, missing source folder, or an empty folder MUST produce a friendly error and return to the input prompt rather than exiting abruptly.

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
- Parallel/multicore scheduling tuning beyond what the image library does automatically — processing is sequential or a small bounded pool, not `Promise.all` over the whole folder.
- Image deduplication or similarity detection.

---

## Design Considerations

### CLI experience

- Use `@clack/prompts` for a polished, spinner-supported interactive flow (the user's other Node projects are prompt-friendly; keep dependencies minimal).
- Use ANSI colors only where they aid readability; keep output greppable for scripting (e.g. `--json` flag is a future extension, not required now).
- Each prompt should show the default option clearly and allow Enter to accept it.
- *(CLI)* Data to stdout, diagnostics to stderr — this is what makes a tool pipeable.
- During processing, reuse `@clack/prompts`' `spinner()` for live progress — no new dependency, and it renders to stderr like the rest of the prompt UI. A per-file message (`Processing 12/24 — hero.png (processed 9, skipped 1, errors 2)`) keeps the user oriented on long batches without flooding the scrollback.

### Functional core, imperative shell

Split the project into pure decision-making and impure effects (per `.agents/AGENTS-NODE.md`):

- **Core (pure)** — same input, same output; no `fs`, no network, no clock, no `process.exit`, no logging:
  - `src/naming.ts` — `buildOutputName`, `resolveCollision`.
  - `src/resize.ts` — resize decision: whether a resize is needed, and the target dimensions (or "already fits").
  - `src/quality.ts` — `findQualityUnderCap`: the quality-reduction loop over an in-memory buffer.
  - `src/progress.ts` — `formatProgress`: formats the live progress message from position, total, current file name, and running counts.
- **Shell (impure)** — reads input, calls core functions to decide, then performs effects:
  - `src/process.ts` — `processImage`: reads/writes files, calls sharp, temp-file writes.
  - `src/index.ts` — prompt flow + orchestration (terminal I/O, including driving the spinner).

Rules this implies:

- **Core and shell do not share a module.** A pure function and an I/O function never live in the same file; the pure half gets its own module so it can sit in the coverage allowlist.
- **Push I/O out to the caller.** `resolveCollision(name, existingNames)` takes the existing names as an argument instead of calling `readdir`; the shell gathers the directory listing and passes it in. Same pattern for resize: the shell reads dimensions via sharp, the pure function decides. Same for progress: the shell owns the spinner; `formatProgress` just builds the string.
- `processImage` never calls `process.exit`; it returns results/errors and lets the shell decide the exit code.

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
╭─ Processing 12/24 — hero.png (processed 9, skipped 1, errors 2) ╮
╰─ … (spinner updates once per file, to stderr)                    ╯

Processed 24 images — 22 ok, 1 skipped, 1 error (2.4 MB total).
```

---

## Technical Considerations

| Area | Detail |
|------|--------|
| Runtime | Node 24 LTS (`.nvmrc` = `24`, `engines.node` = `">=24"`). Native type stripping runs `src/*.ts` directly — no `tsx`, no loader, no dev/prod mismatch |
| Package manager | pnpm. Set the `packageManager` field; `pnpm-lock.yaml` is committed and authoritative; CI uses `pnpm install --frozen-lockfile` |
| Image library | `sharp` (libvips) — pre-approved by house standard, fastest available for batch work, first-class WebP/AVIF encode support |
| CLI prompts | `@clack/prompts` (recommended) or `inquirer` — one dependency, keep it small; its `spinner()` doubles as the progress display, so no extra progress dependency |
| Language | TypeScript, ESM only (`"type": "module"`). Imports use the on-disk `.ts` extension (`./mod.ts`); `tsc` rewrites to `.js` on emit. `node:` prefix for builtins; relative imports only; no `paths` aliases; no barrel file |
| TypeScript config | Two configs: `tsconfig.json` typechecks `src/` + tests + `*.config.ts` (es2023, `nodenext`, `rewriteRelativeImportExtensions`, `verbatimModuleSyntax`, strict + `noUncheckedIndexedAccess`, `noEmit`); `tsconfig.build.json` emits `src/` to `dist/` (declarations + sourcemaps, `*.test.ts` excluded) |
| Project layout | `src/index.ts` (prompt flow + orchestration), `src/process.ts` (shell), `src/naming.ts` + `src/resize.ts` + `src/quality.ts` + `src/progress.ts` (pure core), colocated `src/*.test.ts`, `src/pipeline.test.ts` (e2e smoke), `tests/fixtures/` (sample inputs), `dist/` (gitignored) |
| Scripts | `dev` → `node src/index.ts`; `check` → `tsc -p tsconfig.json`; `build` → `tsc -p tsconfig.build.json`; `test` → `vitest run --coverage`; `lint` → `eslint . --max-warnings 0`; `format` → `prettier --write .`; `format:check` → `prettier --check .`; `verify` → `pnpm check && pnpm lint && pnpm format:check && pnpm test && pnpm build` |
| Lint/format | ESLint flat config, type-aware (`typescript-eslint` `recommendedTypeChecked`, `no-floating-promises`, `consistent-type-imports`, `--max-warnings 0`); Prettier (semi, double quotes, trailing commas, print width 88) with `.prettierignore` (`dist/`, `coverage/`, `node_modules/`, `pnpm-lock.yaml`) |
| Testing | Vitest, no globals, table-driven tests for core functions, fixtures over mocks at the I/O boundary. Coverage (v8) folded into `test`: allowlist `src/naming.ts`, `src/resize.ts`, `src/quality.ts`, `src/progress.ts`; thresholds lines/functions 90, branches 85. **Every new pure core module must be added to `coverage.include`** |
| Naming logic | Pure: `buildOutputName(original, {prefix, suffix, ext})` → `[prefix]<base>[suffix].ext`; collision resolution via `resolveCollision(name, existingNames)` |
| Resize decision | Pure: `shouldResize(width, height, maxDimension, axis)` → target dimensions or "already fits" (no upscaling) |
| Quality loop | Pure: `findQualityUnderCap(buffer, format, capBytes, {start=80, step=10, floor=20})` → quality level + final buffer |
| Progress display | `@clack/prompts` `spinner()` driven per file; message built by pure `formatProgress(index, total, currentName, {processed, skipped, errors})`; renders to stderr; stopped before the final report and on cancel |
| Concurrency | Process files sequentially or with a small bounded pool (e.g. 4). Never `Promise.all` over the whole folder — bounded concurrency is a house rule |
| Errors/async | `catch` binds `unknown` and narrows before use; preserve `cause` when rethrowing; `AbortSignal` for anything cancellable (Ctrl-C); no floating promises (lint-enforced) |
| Exit codes | Exit non-zero on failure, set in the shell only; a pure function never calls `process.exit` |

**Key files to create:**

- `package.json` — `"type": "module"`, `engines.node` `">=24"`, `packageManager` (pnpm), deps (`sharp`, `@clack/prompts`), scripts per the table above
- `.nvmrc` — `24`
- `tsconfig.json` / `tsconfig.build.json` — typecheck / emit pair
- `vitest.config.ts` — include `src/**/*.test.ts`; coverage allowlist + thresholds
- `eslint.config.js` — flat config, type-aware (`allowDefaultProject` lists only `eslint.config.js`)
- `.prettierrc` / `.prettierignore`
- `src/index.ts` — prompt flow + orchestration, drives the progress spinner (shell)
- `src/process.ts` — per-image processing: resize, convert, cap loop, temp-file writes (shell)
- `src/naming.ts` — output filename + collision logic (pure)
- `src/resize.ts` — resize decision + dimension math (pure)
- `src/quality.ts` — quality-cap loop (pure)
- `src/progress.ts` — progress message formatter (pure)
- `src/naming.test.ts` / `src/resize.test.ts` / `src/quality.test.ts` / `src/progress.test.ts` — unit tests (colocated, TDD)
- `src/pipeline.test.ts` — end-to-end smoke test over `tests/fixtures/`
- `tests/fixtures/` — sample source images (JPEG, PNG, WebP, TIFF, one GIF)
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
| Progress | A 24-image run shows a live per-file spinner counter (`i/total` + running processed/skipped/errors) that updates during processing; stdout contains only the final report |
| Quality | `pnpm verify` exits 0 from the project root; `node dist/index.js` runs the CLI from the built output |

---

## Definition of done (per task)

- [ ] `pnpm check` — clean, zero diagnostics
- [ ] `pnpm lint` — zero errors **and** zero warnings
- [ ] `pnpm format:check` — no diff
- [ ] `pnpm test` — all green, thresholds met (lines/functions 90, branches 85)
- [ ] every new pure core module added to `coverage.include` in `vitest.config.ts`
- [ ] `pnpm build` — emits, and `dist/` contains no `*.test.js`
- [ ] `node dist/index.js` runs

Do not report a task done on a subset of these; if one fails for a reason outside the task's scope, say which and why.

---

## Open Questions

*Resolved during kickoff (2026-08-19):*

1. **Language:** TypeScript (B) — type-safe prompt answers and processing config.
2. **GIF:** skipped entirely (C) — not supported, logged and skipped with a reason.
3. **PNG + size cap:** warn and skip the cap for PNG (A) — lossless output is kept at full quality regardless of cap.
4. **Subfolders:** top-level files only (A) — the `processed/` folder contains only files from the selected folder, no recursion.

*Resolved during standards alignment (2026-08-19, per `.agents/AGENTS-NODE.md`):*

5. **Runtime:** Node 24 LTS with native type stripping — no `tsx`, dev runs via `node src/index.ts` (A).
6. **Package manager:** pnpm with committed lockfile and `packageManager` field (A).
7. **Structure:** quality loop and resize decision are pure modules (`src/quality.ts`, `src/resize.ts`); `src/process.ts` is shell-only — core and shell do not share a module (A).
8. **Coverage gate:** allowlist of pure core modules, thresholds 90/90/85, folded into `pnpm test` (A).
9. **e2e smoke test:** lives in `src/pipeline.test.ts` so the Vitest `include` (`src/**/*.test.ts`) covers it; `tests/` holds fixtures only (A).

*Resolved during progress-display kickoff (2026-08-19):*

10. **Progress display:** `@clack/prompts` `spinner()` driven per file — no new dependency (A). Message form is pure `src/progress.ts` (`formatProgress`), rendering to stderr so stdout stays pipeable; spinner stops before the final report and on cancel (A).

*No remaining open questions.*

---

## Implementation Task Outline

1. Scaffold project (`package.json`, pnpm setup, `.nvmrc`, tsconfig pair, vitest/eslint/prettier configs, README).
2. Implement `src/naming.ts` (+ tests) — filename builder + collision resolution (pure).
3. Implement `src/resize.ts` (+ tests) — resize decision + dimension math (pure).
4. Implement `src/quality.ts` (+ tests) — quality-cap loop incl. PNG cap-skip rule (pure).
5. Implement `src/progress.ts` (+ tests) — progress message formatter (pure).
6. Implement `src/process.ts` — shell: resize, convert, cap loop, temp-file writes.
7. Implement `src/index.ts` prompt flow — ordered questions, validation, summary confirm, cancel/error handling.
8. Wire orchestration: walk folder → process each → drive progress spinner → write to `processed/` → report summary.
9. Add a sample fixture set + `src/pipeline.test.ts` end-to-end smoke test.
10. Run `pnpm verify` and manually smoke-run on a real image folder; confirm `node dist/index.js` runs the built CLI.
