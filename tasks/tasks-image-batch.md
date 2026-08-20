# Task List — Interactive Batch Image Processor CLI

## Relevant Files

- `package.json` — Project metadata (`"type": "module"`, `engines.node` `">=24"`, `packageManager` pnpm), dependencies (`sharp`, `@clack/prompts`), scripts (`dev`, `start`, `check`, `build`, `test`, `lint`, `format`, `format:check`, `verify`).
- `.nvmrc` — Pins Node 24.
- `tsconfig.json` — Typecheck config: `src/` + tests + `*.config.ts`, es2023, `nodenext`, `rewriteRelativeImportExtensions`, `strict` + `noUncheckedIndexedAccess`, `noEmit`.
- `tsconfig.build.json` — Emit config: `src/` → `dist/`, declarations + sourcemaps, `*.test.ts` excluded.
- `vitest.config.ts` — Test runner config. `include: ["src/**/*.test.ts"]`; coverage allowlist (`src/naming.ts`, `src/resize.ts`, `src/quality.ts`, `src/progress.ts`) with thresholds lines/functions 90, branches 85. **Add every new pure core module here.**
- `eslint.config.js` — Flat, type-aware (`recommendedTypeChecked`, `no-floating-promises`, `consistent-type-imports`), `allowDefaultProject` lists only `eslint.config.js`.
- `.prettierrc` / `.prettierignore` — Formatting config (`dist/`, `coverage/`, `node_modules/`, `pnpm-lock.yaml` ignored).
- `src/naming.ts` — Output filename builder and collision resolution (pure core).
- `src/naming.test.ts` — Unit tests for `naming.ts` (written first, per TDD).
- `src/resize.ts` — Resize decision + dimension math (pure core).
- `src/resize.test.ts` — Unit tests for `resize.ts` (written first, per TDD).
- `src/quality.ts` — Quality-cap loop incl. PNG cap-skip rule (pure core).
- `src/quality.test.ts` — Unit tests for `quality.ts` (written first, per TDD).
- `src/progress.ts` — Progress message formatter (pure core).
- `src/progress.test.ts` — Unit tests for `progress.ts` (written first, per TDD).
- `src/process.ts` — Shell: per-image processing (resize, convert, cap loop, skip logic, temp-file writes) via sharp + `node:fs`.
- `src/process.test.ts` — Tests for `process.ts` using real fixtures (fixtures over mocks; written first, per TDD).
- `src/index.ts` — Interactive prompt flow + orchestration of the full run, including driving the progress spinner (shell).
- `src/index.test.ts` — Tests for prompt flow (mocked prompts) and orchestration (written first, per TDD).
- `src/pipeline.test.ts` — End-to-end smoke test over `tests/fixtures/`.
- `tests/fixtures/` — Sample source images (JPEG, PNG, WebP, TIFF, plus one GIF) for end-to-end tests.
- `README.md` — Usage instructions and an example run.

### Notes

- **TDD pattern:** For every feature, write the failing test(s) first, confirm they fail for the right reason, then implement the minimal code to make them pass. Tests must exist alongside the code they verify.
- Unit tests should be placed alongside the code files they are testing (e.g., `naming.ts` and `naming.test.ts` in the same directory).
- Use `pnpm test` (or `pnpm vitest run`) to run tests. Running without a path executes all tests found by the Vitest configuration.
- **Coverage allowlist:** every new pure core module must be added to `coverage.include` in `vitest.config.ts` — an unlisted module is silently at 0% and the suite still passes.
- **Core and shell do not share a module.** Pure functions live in `naming.ts` / `resize.ts` / `quality.ts` / `progress.ts` only; `process.ts` and `index.ts` are shells.
- **Progress rendering is shell code.** The spinner lives in `index.ts`; `progress.ts` only formats the message string. Progress goes to stderr (clack renders there natively) — stdout carries only the final report.
- Run `pnpm verify` before reporting a task done.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:

- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Parallel Work Tracks

After Task 1.0 (scaffolding) is complete, **Track A (Task 2.0, naming)**, **Track B (Tasks 4.0–5.0, resize + quality)**, and **Track C (Task 3.0, progress formatting)** are fully independent and can be developed in parallel — they touch no shared files. Task 6.0 (processing shell) depends on Track B, and Task 8.0 (orchestration, incl. spinner wiring) depends on all tracks. Task 9.0's fixture files can be created in parallel with Tracks A–C, but its end-to-end assertions require Tasks 2.0–8.0 to be complete.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Create and checkout a new branch for this feature (`git checkout -b feature/image-batch`)
- [x] 1.0 Scaffold project (package.json, deps, folder layout, config, README)
  - [x] 1.1 Initialize the project with pnpm: `package.json` with `"type": "module"`, `"engines": { "node": ">=24" }`, `packageManager` (pnpm), and scripts: `dev` (`node src/index.ts`), `start` (`node src/index.ts`), `check` (`tsc -p tsconfig.json`), `build` (`tsc -p tsconfig.build.json`), `test` (`vitest run --coverage`), `lint` (`eslint . --max-warnings 0`), `format` (`prettier --write .`), `format:check` (`prettier --check .`), `verify` (`pnpm check && pnpm lint && pnpm format:check && pnpm test && pnpm build`). Create `.nvmrc` with `24`.
  - [x] 1.2 Install runtime dependencies `sharp` and `@clack/prompts`, plus dev dependencies `typescript@^5.9`, `@types/node`, `vitest`, `@vitest/coverage-v8`, `eslint`, `typescript-eslint`, `@eslint/js`, and `prettier`. No `tsx` — Node 24 strips types natively. Commit `pnpm-lock.yaml`.
  - [x] 1.3 Create `tsconfig.json` (es2023, `nodenext`, `rewriteRelativeImportExtensions`, `verbatimModuleSyntax`, strict + `noUncheckedIndexedAccess`, `noEmit`; include `src` + `*.config.ts`) and `tsconfig.build.json` (extends it, emits to `dist/` with declarations + sourcemaps, excludes `src/**/*.test.ts`). Create the folder layout: `src/` for source modules and `tests/` for end-to-end fixtures.
  - [x] 1.4 Create `vitest.config.ts` (include `src/**/*.test.ts`; coverage allowlist `src/naming.ts`, `src/resize.ts`, `src/quality.ts`, `src/progress.ts`; thresholds lines/functions 90, branches 85) and `eslint.config.js` (flat, type-aware, `allowDefaultProject` lists only `eslint.config.js`) so `pnpm test` and `pnpm lint` run from the project root. Add `.prettierrc` and `.prettierignore` (`dist/`, `coverage/`, `node_modules/`, `pnpm-lock.yaml`).
  - [x] 1.5 Write `README.md` with setup, usage, and a short example run.
  - [x] 1.6 Create a trivial placeholder module + placeholder test and verify `pnpm verify` passes, confirming the harness works.
- [x] 2.0 Implement `src/naming.ts` — filename builder + collision resolution (Track A)
  - [x] 2.1 Write failing tests in `src/naming.test.ts` for `buildOutputName`: prefix-only, suffix-only, both, neither, and extension swap (e.g., `image.png` + `prod-` + `-web` + `.webp` → `prod-image-web.webp`). Run tests to confirm they fail.
  - [x] 2.2 Implement `buildOutputName(originalName, { prefix, suffix, ext })` and run the tests until they pass.
  - [x] 2.3 Write failing tests in `src/naming.test.ts` for `resolveCollision`: no collision returns name unchanged, one collision appends `-1`, multiple collisions append `-2`, `-3`, … Run tests to confirm they fail.
  - [x] 2.4 Implement `resolveCollision(name, existingNames)` — takes the existing names as an argument rather than reading the directory — and run the tests until they pass.
- [x] 3.0 Implement `src/progress.ts` — progress message formatter (Track C)
  - [x] 3.1 Write failing tests in `src/progress.test.ts` for `formatProgress(index, total, currentName, { processed, skipped, errors })`: first file renders `Processing 1/24 — hero.png (processed 1, skipped 0, errors 0)`, mid-run position and running counts render correctly, and singular/plural wording is handled (e.g. `1 error` vs `2 errors`). Run tests to confirm they fail.
  - [x] 3.2 Implement `formatProgress` and run the tests until they pass.
- [x] 4.0 Implement `src/resize.ts` — resize decision + dimension math (Track B)
  - [x] 4.1 Write failing tests in `src/resize.test.ts` for `shouldResize`: fit-by-width and fit-by-height both preserve aspect ratio, an already-smaller image reports "already fits" (no upscaling), and dimension math is correct for both axes. Run tests to confirm they fail.
  - [x] 4.2 Implement `shouldResize(width, height, maxDimension, axis)` and run the tests until they pass.
- [x] 5.0 Implement `src/quality.ts` — quality-cap loop (Track B)
  - [x] 5.1 Write failing tests in `src/quality.test.ts` for `findQualityUnderCap`: result encodes under the cap, quality decreases across attempts, and a floor-reached-but-still-over-cap case is flagged. Run tests to confirm they fail.
  - [x] 5.2 Implement `findQualityUnderCap(buffer, format, capBytes, { start = 80, step = 10, floor = 20 })` and run the tests until they pass.
  - [x] 5.3 Write failing tests for the PNG + cap rule: with a cap set and PNG output, the function warns and skips the quality loop, returning full-quality output. Run tests to confirm they fail.
  - [x] 5.4 Implement the PNG cap-skip behavior and run the tests until they pass.
- [ ] 6.0 Implement `src/process.ts` — shell: resize, convert, and skip logic (Track B)
  - [ ] 6.1 Write failing tests in `src/process.test.ts` using real fixture images (fixtures over mocks — do not mock sharp): resize applies `shouldResize` results correctly, conversion to each output format (JPEG/WebP/AVIF/PNG) yields the right output mime/format and extension, and the cap loop writes the `findQualityUnderCap` result. Run tests to confirm they fail.
  - [ ] 6.2 Implement `processImage` with `sharp` (resize via the pure decision, convert, quality cap) and run the tests until they pass.
  - [ ] 6.3 Write failing tests for skip logic: GIF files are skipped with reason `unsupported format: gif`, and unsupported/corrupt files are skipped with a logged reason without throwing. Run tests to confirm they fail.
  - [ ] 6.4 Implement the skip logic and run the tests until they pass.
- [ ] 7.0 Implement `src/index.ts` — interactive prompt flow (TDD, mocked prompts)
  - [ ] 7.1 Write failing tests in `src/index.test.ts` for input-directory validation: accepts a valid folder, rejects a missing path / non-directory / image-less folder, and loops back with a friendly re-enter message. Run tests to confirm they fail.
  - [ ] 7.2 Implement the input-directory validation using `@clack/prompts` and run the tests until they pass.
  - [ ] 7.3 Write failing tests for the prompt sequence: resize (yes/no → fit width/height → pixel value), output-format menu, size-cap (yes/no → value + KB/MB), and optional prefix/suffix, all producing a correctly typed config object. Run tests to confirm they fail.
  - [ ] 7.4 Implement the prompt sequence and run the tests until they pass.
  - [ ] 7.5 Write failing tests for the final confirmation summary (all answers displayed, `y/N` to confirm) and Ctrl-C/cancel handling that exits cleanly with no partial writes. Run tests to confirm they fail.
  - [ ] 7.6 Implement the confirmation summary and cancel handling and run the tests until they pass.
- [ ] 8.0 Wire orchestration: walk folder → process each → drive progress spinner → write to `processed/` → report (TDD)
  - [ ] 8.1 Write failing tests for folder walking: lists top-level files only, filters to supported formats, and sorts deterministically. Run tests to confirm they fail.
  - [ ] 8.2 Implement the folder walk and run the tests until they pass.
  - [ ] 8.3 Write failing tests for the output pipeline: creates `<source-dir>/processed/` if missing, resolves collisions via the naming module, writes to a temp file then renames into place, processes with bounded concurrency (sequential or a small pool — never `Promise.all` over the whole folder), and never modifies source files. Run tests to confirm they fail.
  - [ ] 8.4 Implement the output pipeline and run the tests until they pass.
  - [ ] 8.5 Write failing tests for the progress spinner wiring with a mocked spinner: the spinner message updates once per file using `formatProgress` with correct position and running counts, the spinner stops before the final report prints, and a cancelled run stops the spinner with no partial writes. Run tests to confirm they fail.
  - [ ] 8.6 Implement the spinner wiring and run the tests until they pass.
  - [ ] 8.7 Write failing tests for reporting: per-file summary (source → output, format, dimensions, size), grand total (processed/skipped/errors/total size), and the failed-files list with reasons. Run tests to confirm they fail.
  - [ ] 8.8 Implement the reporting output and run the tests until they pass.
- [ ] 9.0 Add fixtures + end-to-end smoke test; run the full gate
  - [ ] 9.1 Create small fixture images in `tests/fixtures/` (JPEG, PNG, WebP, TIFF, plus one GIF to exercise the skip path).
  - [ ] 9.2 Write `src/pipeline.test.ts`, an end-to-end test that runs the full pipeline on the fixtures and asserts the expected number of outputs, correct filenames, and that `processed/` contains only expected files.
  - [ ] 9.3 Add an end-to-end assertion that source fixtures are byte-identical after a run (hash compare) and that a 500 KB cap is honored or explicitly reported as unmeetable.
  - [ ] 9.4 Run `pnpm verify` (check, lint, format:check, test with coverage thresholds, build), confirm `dist/` contains no `*.test.js`, and do a manual smoke run on a real image folder plus `node dist/index.js` from the built output — including confirming the live progress spinner updates during processing and that stdout contains only the final report.
