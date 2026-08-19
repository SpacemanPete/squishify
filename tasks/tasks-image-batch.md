# Task List — Interactive Batch Image Processor CLI

## Relevant Files

- `package.json` — Project metadata, dependencies (`sharp`, `@clack/prompts`), and scripts (`start`, `build`, `test`, `lint`).
- `tsconfig.json` — TypeScript compiler configuration.
- `vitest.config.ts` — Test runner configuration.
- `eslint.config.js` — Linter configuration.
- `src/naming.ts` — Output filename builder and collision resolution.
- `src/naming.test.ts` — Unit tests for `naming.ts` (written first, per TDD).
- `src/process.ts` — Per-image processing: resize, convert, quality-cap loop, skip logic.
- `src/process.test.ts` — Unit tests for `process.ts` (written first, per TDD).
- `src/index.ts` — Interactive prompt flow + orchestration of the full run.
- `src/index.test.ts` — Tests for prompt flow (mocked prompts) and orchestration (written first, per TDD).
- `tests/fixtures/` — Sample source images (JPEG, PNG, WebP, TIFF, plus one GIF) for end-to-end tests.
- `README.md` — Usage instructions and an example run.

### Notes

- **TDD pattern:** For every feature, write the failing test(s) first, confirm they fail for the right reason, then implement the minimal code to make them pass. Tests must exist alongside the code they verify.
- Unit tests should be placed alongside the code files they are testing (e.g., `naming.ts` and `naming.test.ts` in the same directory).
- Use `npx vitest` to run tests. Running without a path executes all tests found by the Vitest configuration.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:

- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Parallel Work Tracks

After Task 1.0 (scaffolding) is complete, **Track A (Task 2.0, naming)** and **Track B (Tasks 3.0–4.0, processing)** are fully independent and can be developed in parallel — they touch no shared files. Task 5.0 (orchestration) depends on both Track A and Track B and should start only after they land. Task 6.0's fixture files can be created in parallel with Tracks A/B, but its end-to-end assertions require Tasks 2.0–5.0 to be complete.

## Tasks

- [ ] 0.0 Create feature branch
  - [ ] 0.1 Create and checkout a new branch for this feature (`git checkout -b feature/image-batch`)
- [ ] 1.0 Scaffold project (package.json, deps, folder layout, config, README)
  - [ ] 1.1 Initialize the npm project and create `package.json` with name, version, and scripts: `start` (`tsx src/index.ts`), `build` (`tsc`), `test` (`vitest run`), `lint` (`eslint`).
  - [ ] 1.2 Install runtime dependencies `sharp` and `@clack/prompts`, plus dev dependencies `typescript`, `tsx`, `vitest`, and `eslint` + TypeScript ESLint plugins.
  - [ ] 1.3 Create `tsconfig.json` (target ES2022, strict mode) and the folder layout: `src/` for source modules and `tests/` for end-to-end fixtures.
  - [ ] 1.4 Create `vitest.config.ts` and `eslint.config.js` so `npm test` and `npm run lint` run from the project root.
  - [ ] 1.5 Write `README.md` with setup, usage, and a short example run.
  - [ ] 1.6 Create a trivial placeholder module + placeholder test and verify `npm test` and `npm run lint` both pass, confirming the harness works.
- [ ] 2.0 Implement `src/naming.ts` — filename builder + collision resolution (Track A)
  - [ ] 2.1 Write failing tests in `src/naming.test.ts` for `buildOutputName`: prefix-only, suffix-only, both, neither, and extension swap (e.g., `image.png` + `prod-` + `-web` + `.webp` → `prod-image-web.webp`). Run tests to confirm they fail.
  - [ ] 2.2 Implement `buildOutputName(originalName, { prefix, suffix, ext })` and run the tests until they pass.
  - [ ] 2.3 Write failing tests in `src/naming.test.ts` for `resolveCollision`: no collision returns name unchanged, one collision appends `-1`, multiple collisions append `-2`, `-3`, … Run tests to confirm they fail.
  - [ ] 2.4 Implement `resolveCollision(name, existingNames)` and run the tests until they pass.
- [ ] 3.0 Implement `src/process.ts` — quality-cap loop (Track B)
  - [ ] 3.1 Write failing tests in `src/process.test.ts` for `findQualityUnderCap`: result encodes under the cap, quality decreases across attempts, and a floor-reached-but-still-over-cap case is flagged. Run tests to confirm they fail.
  - [ ] 3.2 Implement `findQualityUnderCap(buffer, format, capBytes, { start = 80, step = 10, floor = 20 })` and run the tests until they pass.
  - [ ] 3.3 Write failing tests for the PNG + cap rule: with a cap set and PNG output, the function warns and skips the quality loop, returning full-quality output. Run tests to confirm they fail.
  - [ ] 3.4 Implement the PNG cap-skip behavior and run the tests until they pass.
- [ ] 4.0 Implement `src/process.ts` — image resize, convert, and skip logic (Track B)
  - [ ] 4.1 Write failing tests in `src/process.test.ts` for resize behavior: fit-by-width and fit-by-height both preserve aspect ratio, and an already-smaller image is not upscaled. Run tests to confirm they fail.
  - [ ] 4.2 Implement `processImage` resize handling with `sharp` and run the tests until they pass.
  - [ ] 4.3 Write failing tests for format conversion (JPEG/WebP/AVIF/PNG) verifying the output mime/format and correct extension. Run tests to confirm they fail.
  - [ ] 4.4 Implement the conversion step in `processImage` and run the tests until they pass.
  - [ ] 4.5 Write failing tests for skip logic: GIF files are skipped with reason `unsupported format: gif`, and unsupported/corrupt files are skipped with a logged reason without throwing. Run tests to confirm they fail.
  - [ ] 4.6 Implement the skip logic and run the tests until they pass.
- [ ] 5.0 Implement `src/index.ts` — interactive prompt flow (TDD, mocked prompts)
  - [ ] 5.1 Write failing tests in `src/index.test.ts` for input-directory validation: accepts a valid folder, rejects a missing path / non-directory / image-less folder, and loops back with a friendly re-enter message. Run tests to confirm they fail.
  - [ ] 5.2 Implement the input-directory validation using `@clack/prompts` and run the tests until they pass.
  - [ ] 5.3 Write failing tests for the prompt sequence: resize (yes/no → fit width/height → pixel value), output-format menu, size-cap (yes/no → value + KB/MB), and optional prefix/suffix, all producing a correctly typed config object. Run tests to confirm they fail.
  - [ ] 5.4 Implement the prompt sequence and run the tests until they pass.
  - [ ] 5.5 Write failing tests for the final confirmation summary (all answers displayed, `y/N` to confirm) and Ctrl-C/cancel handling that exits cleanly with no partial writes. Run tests to confirm they fail.
  - [ ] 5.6 Implement the confirmation summary and cancel handling and run the tests until they pass.
- [ ] 6.0 Wire orchestration: walk folder → process each → write to `processed/` → report (TDD)
  - [ ] 6.1 Write failing tests for folder walking: lists top-level files only, filters to supported formats, and sorts deterministically. Run tests to confirm they fail.
  - [ ] 6.2 Implement the folder walk and run the tests until they pass.
  - [ ] 6.3 Write failing tests for the output pipeline: creates `<source-dir>/processed/` if missing, resolves collisions via the naming module, writes to a temp file then renames into place, and never modifies source files. Run tests to confirm they fail.
  - [ ] 6.4 Implement the output pipeline and run the tests until they pass.
  - [ ] 6.5 Write failing tests for reporting: per-file summary (source → output, format, dimensions, size), grand total (processed/skipped/errors/total size), and the failed-files list with reasons. Run tests to confirm they fail.
  - [ ] 6.6 Implement the reporting output and run the tests until they pass.
- [ ] 7.0 Add fixtures + end-to-end smoke test; run lint and test suite
  - [ ] 7.1 Create small fixture images in `tests/fixtures/` (JPEG, PNG, WebP, TIFF, plus one GIF to exercise the skip path).
  - [ ] 7.2 Write an end-to-end test that runs the full pipeline on the fixtures and asserts the expected number of outputs, correct filenames, and that `processed/` contains only expected files.
  - [ ] 7.3 Add an end-to-end assertion that source fixtures are byte-identical after a run (hash compare) and that a 500 KB cap is honored or explicitly reported as unmeetable.
  - [ ] 7.4 Run `npm run lint && npm test`, fix any failures, and do a manual smoke run on a real image folder to confirm the full prompt flow works end-to-end.
