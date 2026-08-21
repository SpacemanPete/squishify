# AGENTS-NODE — Node + TypeScript house standard

The toolchain, layout, and quality gate for any Node + TypeScript project in this
portfolio. Copy this file into a project (`rules/`, `docs/rules/`, or alongside its
`AGENTS.md`) rather than linking to it — nothing here auto-loads. If a project's own
rules contradict this doc, **the project wins**; note the divergence in the project's
README so the next agent doesn't "fix" it back.

Every config block below was executed together on Node v24.19.0 before being written
down. Copy them verbatim. Do **not** substitute newer major versions without re-running
the gate in `## Definition of done` — one of these pins is a hard compatibility
constraint, not caution. → A.7

## Scope

Applies to CLIs, libraries, and services. Rules that differ by project type are marked
*(CLI)*, *(library)*, or *(service)*. Everything unmarked applies to all three.

This doc governs the **stack**. It deliberately says nothing about branches, commits,
PRs, or the task loop — see `## What this doc does not cover`.

## Runtime and package manager

| Concern | Rule |
|---|---|
| Node | 24 LTS. Pin in `.nvmrc` (`24`) and `engines.node` (`">=24"`) |
| Package manager | pnpm |
| Version pinning | Set the `packageManager` field and let corepack honour it. **Do not** hardcode a pnpm version in this doc's own examples |
| Lockfile | `pnpm-lock.yaml` is committed and authoritative |
| CI install | `pnpm install --frozen-lockfile` |

Node 24 matters beyond currency: it strips TypeScript types natively, so `node src/index.ts`
runs with no loader, no `tsx`, and no build step. The layout below depends on that. → A.1

## TypeScript configuration

Two configs, because checking and building want different file sets: tests **must** be
typechecked but **must not** be emitted into `dist/`. These settings are **not** a copy
of the fleet's existing `tsconfig.base.json`, and cannot be — → A.2.

`tsconfig.json` — typechecks `src/` plus tests plus any `*.config.ts`, emits nothing:

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["es2023"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "rewriteRelativeImportExtensions": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "*.config.ts"]
}
```

`tsconfig.build.json` — emits `src/` only:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

Notes on specific flags:

- `rewriteRelativeImportExtensions` is what lets you write `./mod.ts` and get
  `./mod.js` in the emitted output. **`allowImportingTsExtensions` is not needed**
  alongside it — verified on both TypeScript 5.9.3 and 7.0.2. → A.3
- `noUncheckedIndexedAccess` is the one strictness flag not inherited from the existing
  fleet baseline. It types `arr[0]` as `T | undefined`, which is correct and catches
  real bugs in batch-processing loops. Turn it off only with a reason.
- `@types/node` is a required dev dependency. Without it `console`, `process`, and
  every `node:*` import fail to typecheck.

## Modules and imports

- **ESM only.** `"type": "module"` in `package.json`. No CommonJS, no dual builds.
  *(library)*: if you publish for broad consumption, see the A.3 fallback.
- **Write the extension that is on disk** — `import { bump } from "./mod.ts"`. The
  specifier matches the real file, so `node src/index.ts` resolves it and `tsc`
  rewrites it to `.js` on emit. This is the single most load-bearing convention here;
  getting it wrong breaks either the dev run or the build. → A.3
- **Prefix every builtin with `node:`** — `node:fs/promises`, `node:path`, `node:util`.
- **Relative imports only. No `paths` aliases, no `@/*`.** The extension rewrite is
  syntactic and touches only relative specifiers, so an aliased import emits a
  specifier Node cannot resolve. This is a real incompatibility, not a style rule.
- **CommonJS dependencies use a default import.** `import sharp from "sharp"` works
  under `verbatimModuleSyntax` + nodenext — verified against sharp 0.35.3 / libvips
  8.18.3. Named imports from a CJS package **will** fail; destructure after importing.
- **No barrel `index.ts` in an application.** *(library)*: a single top-level barrel is
  fine and expected.

## Project layout

```
src/index.ts        entry point — the imperative shell
src/<domain>.ts     pure modules, one concern each
src/<domain>.test.ts  colocated unit tests
tests/fixtures/     sample inputs for end-to-end tests
dist/               build output — gitignored, never committed
```

Tests live next to the code they test. Reserve `tests/` for fixtures and
cross-module end-to-end tests that have no single owner.

## Functional core, imperative shell

Split every project into pure decision-making and impure effects:

- **Core** — pure functions. Same input, same output; no `fs`, no network, no clock, no
  randomness, no `process.exit`, no logging. One concern per module.
- **Shell** — `src/index.ts` and any module that touches the outside world. It reads
  input, calls core functions to decide what to do, then performs the effects.

This is not architectural taste; it is what makes the coverage gate meaningful. Pure
functions reach high coverage with fast table-driven tests and no mocks, so the number
in `## Testing` measures real logic rather than plumbing. → A.4

A worked example, from squishify's spec:

| Function | Kind | Why |
|---|---|---|
| `buildOutputName(originalName, opts)` | core | string in, string out |
| `resolveCollision(name, existingNames)` | core | takes the existing names as an argument instead of reading the directory |
| `findQualityUnderCap(buffer, format, capBytes, opts)` | core | operates on a buffer already in memory |
| `processImage(...)` | shell | reads and writes files, calls sharp |
| prompt flow in `index.ts` | shell | terminal I/O |

`resolveCollision` is the instructive one: passing in `existingNames` rather than
having it call `readdir` is the whole technique. Push I/O out to the caller and the
decision becomes trivially testable.

**Core and shell do not share a module.** If a spec puts a pure function and an I/O
function in the same file, split it — the pure half goes in its own module so it can be
listed in the coverage allowlist without dragging untestable code in behind it. A file
containing both cannot be measured honestly either way.

## Testing

- **Vitest.** Not Jest, not `node:test`.
- **Write the failing test first.** Confirm it fails for the expected reason, then write
  the minimal code that passes it. This matches the TDD ordering in
  `utilities/spec/generate-tasks.md`.
- **Colocate** as `src/<name>.test.ts`.
- **No globals.** Import `describe`, `it`, `expect` from `vitest` explicitly.
- **Table-driven tests for core functions** — `it.each` over input/expected pairs.
- **Fixtures over mocks at the I/O boundary.** A real 3 KB PNG in `tests/fixtures/`
  beats a mocked `sharp`. Mocking the thing you are integrating with tests nothing.

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Allowlist: pure core modules only. Add every new core module here.
      // Note what is absent: src/index.ts and any module that performs I/O.
      include: ["src/naming.ts", "src/quality.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: { lines: 90, functions: 90, branches: 85 },
    },
  },
});
```

Coverage is folded into `test` rather than a separate script, so the gate cannot be
skipped by running the shorter command.

**The `include` allowlist has one failure mode: a new core module is invisible until
someone adds it.** An unlisted module is silently at 0% and the suite still passes.
Adding new core modules to `include` is therefore a line in `## Definition of done`,
not an optional tidy-up. The allowlist is still the right trade — it is what makes 90%
an honest number instead of an average diluted by untestable plumbing. → A.5

## Lint and format

`eslint.config.js` — flat config, type-aware:

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.js"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
);
```

`recommendedTypeChecked` is the point — it needs real type information and catches what
syntax-only linting cannot: unawaited promises, `any` leaking through a call chain,
unsafe returns. Verified firing on exactly those cases.

**`allowDefaultProject` must list `eslint.config.js` and nothing else.** A file may be
in the TypeScript project *or* in `allowDefaultProject`, never both — typescript-eslint
errors out if you do both. Since `tsconfig.json` includes `*.config.ts`, `.ts` config
files are already covered; `eslint.config.js` is a `.js` file, so it cannot join the TS
project without `allowJs` and needs this escape hatch instead. Both halves of that
sentence are load-bearing; changing one without the other breaks `pnpm lint`.

`.prettierrc` — carried over unchanged from the existing fleet convention:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 88
}
```

`.prettierignore` — **required**, or `prettier --check .` fails on build output:

```
dist/
coverage/
node_modules/
pnpm-lock.yaml
```

Lint warnings are **blocking**. Run with `--max-warnings 0`; a warning nobody fixes is
just a slower error.

Biome is faster and used elsewhere in the portfolio, but cannot replace this setup for
Node. → A.6

## Dependencies

- **Reach for the standard library first.** `node:util` `parseArgs` instead of an
  argument parser, `node:fs/promises`, `node:path`, `node:crypto`, `node:test`
  assertions where Vitest is not involved. Most small utility packages are now a
  stdlib call.
- **Small, well-known dependencies need no permission.** Add them and move on.
- **Ask before installing anything native, compiled, or large.** Native modules
  (`sharp`, SQLite bindings) break in CI and cross-platform builds in ways pure JS does
  not, and a large tree is a permanent maintenance cost. `sharp` is **pre-approved**
  for image work.
- **Place dependencies correctly.** Anything imported from `src/` at runtime is a
  `dependency`; everything else is a `devDependency`. Getting this wrong ships a broken
  package *(library)* or a bloated image *(service)*.
- **The lockfile is authoritative.** Use caret ranges in `package.json`; do not pin
  exact versions without a reason.

## Errors and async

- **`catch` binds `unknown`.** Narrow before use; never annotate it as `any`.
- **Preserve the cause when rethrowing** — `throw new Error("...", { cause: err })`.
- **No floating promises.** Await, return, or explicitly `void` them. The linter
  enforces this; do not silence it.
- **Use `AbortSignal`** for anything cancellable, and thread it through rather than
  reaching for a global.
- **Batch work runs with bounded concurrency.** `Promise.all` over 5,000 files opens
  5,000 handles at once. Cap it — a small worker-pool helper over an array, or
  `Promise.all` over chunks.
- *(CLI)* **Data to stdout, diagnostics to stderr.** This is what makes a tool
  pipeable.
- *(CLI)* **Exit non-zero on failure**, and set the code in the shell only. A pure
  function **never** calls `process.exit`; it returns a result and lets the shell
  decide.

## Scripts

```json
{
  "type": "module",
  "scripts": {
    "dev": "node src/index.ts",
    "check": "tsc -p tsconfig.json",
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run --coverage",
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "verify": "pnpm check && pnpm lint && pnpm format:check && pnpm test && pnpm build"
  }
}
```

`verify` is the single aggregate gate, equivalent to the `predeploy` chain used
elsewhere in the portfolio but named for projects that have nothing to deploy.

Verified dev dependency set:

```
typescript@^5.9  @types/node  vitest  @vitest/coverage-v8
eslint  typescript-eslint  @eslint/js  prettier
```

## Definition of done

A task is complete when `pnpm verify` exits 0 and the coverage allowlist is current.
Walk it explicitly:

- [ ] `pnpm check` — clean, zero diagnostics
- [ ] `pnpm lint` — zero errors **and** zero warnings
- [ ] `pnpm format:check` — no diff
- [ ] `pnpm test` — all green, thresholds met (lines/functions 90, branches 85)
- [ ] **every new pure core module added to `coverage.include`** in `vitest.config.ts`
- [ ] `pnpm build` — emits, and `dist/` contains no `*.test.js`
- [ ] `node dist/index.js` runs *(CLI)*

Do not report a task done on a subset of these. If one is failing for a reason outside
the task's scope, say which and why rather than leaving it unmentioned.

## What this doc does not cover

Git and process discipline live elsewhere on purpose — duplicating them here guarantees
the two copies drift:

- **Branching, commits, PRs** — see the project's own rules. `makeout-arcade`'s
  `.cursor/rules/general.md` is the reference version: never work on `main`, branch
  `feature/[name]` from `origin/main`, open a PR, do not self-merge.
- **The task loop** — `utilities/spec/process-task-list.md`: one sub-task at a time,
  tick the box, pause for go-ahead.
- **PRDs and task lists** — `utilities/spec/create-prd.md` and
  `utilities/spec/generate-tasks.md`.

---

## Appendix A — Rationale

### A.1 Node 24 and pnpm

Node 24 is the current LTS and most of the portfolio already pins it. The specific
reason to require it rather than 22 is native type stripping: `node src/index.ts` runs
directly, which removes `tsx` from the dependency tree and deletes the whole category
of "works in dev, breaks in build" loader bugs. Dev and production then differ by one
axis only — whether types were erased ahead of time or on load.

pnpm's content-addressed store matters across many small sibling projects, and its
strict `node_modules` surfaces undeclared dependencies that npm's flat layout hides.

The pnpm **version** is deliberately unpinned here. Pinning it in a document means the
document is wrong within weeks. Projects set `packageManager` and corepack enforces it
per project; the fleet already spans 10.x and 11.x with no ill effect.

### A.2 Why `nodenext` and not `bundler`

Every existing TypeScript project in the portfolio uses `moduleResolution: bundler`
with `noEmit`, and that is correct **for those projects** — Vite or Wrangler does the
resolving, and `tsc` only typechecks.

It cannot be reused here. `bundler` resolution permits extensionless relative imports
(`./mod`), which no bundler-free Node process can resolve. Under `noEmit` that never
surfaces. The moment you emit and run the output with plain `node`, every relative
import fails.

**So the existing `tsconfig.base.json` is not a starting point for a Node build, and
aligning this config back to it "for consistency" will break the build.** That is the
most likely wrong-but-well-intentioned edit to this standard.

### A.3 The import-extension trade-off

Three ways to write relative imports in ESM TypeScript:

| Approach | Specifier | `node src/x.ts` | `tsc` → `dist/` |
|---|---|---|---|
| `rewriteRelativeImportExtensions` | `./mod.ts` | works | works |
| Explicit `.js` | `./mod.js` | **fails** | works |
| `bundler` + extensionless | `./mod` | fails | no emit |

The decisive constraint is that Node's type stripping does **no path remapping** — it
resolves the specifier exactly as written. `./mod.js` does not resolve when only
`mod.ts` exists on disk, and Node refuses to guess. So the long-standing "write `.js`
even though it's `.ts`" convention is incompatible with running source directly.

Writing `./mod.ts` inverts that: the specifier tells the truth, direct execution works,
and `tsc` rewrites to `./mod.js` on emit. Confirmed on TypeScript 5.9.3 and 7.0.2, and
Vitest resolves the same specifiers without extra configuration.

Cost: the rewrite is purely syntactic and only touches relative paths. It does not
rewrite `paths` aliases, `require()`, or dynamic imports built from template strings —
hence the no-aliases rule.

*(library)* **Fallback:** if you publish a package for broad consumption, use explicit
`.js` specifiers instead and accept the loss of direct execution. Some third-party
tooling still parses source and rejects `.ts` specifiers, and a library's blast radius
is other people's builds. Applications and CLIs have no such exposure.

### A.4 Functional core, imperative shell

The pattern earns its place here for a narrow, practical reason: it is what makes a
coverage threshold worth having.

Test a function that reads a directory, encodes an image, and writes a file, and you
are testing the filesystem and libvips. It needs fixtures and temp directories, it is
slow, it fails for environmental reasons, and it drives people to mock the very
dependency under test. Coverage of such code measures how much plumbing was exercised.

Split the decisions out and they become pure string and number functions — 90% arrives
from table-driven tests in milliseconds with no mocks, and the number tracks logic.
The shell stays thin enough to cover with a couple of end-to-end tests over fixtures.

squishify's PRD arrived at this shape before this doc existed: `buildOutputName`,
`resolveCollision`, and `findQualityUnderCap` are all pure, with `processImage` as the
shell. The standard is codifying a pattern already in use, not importing one.

### A.5 Why 90/85 on an allowlist, not 70/60 on everything

The one project in the portfolio already running coverage gates at 70% lines / 60%
branches applies them to an `include` list spanning schemas, server modules, and route
handlers — a scope containing substantial I/O. 70% against that is a real bar.

Narrowing the allowlist to pure core modules raises what the same effort scores, so
90/85 there is comparable strictness rather than a step change; TDD on pure functions
tends to land above it without trying. The two numbers are not on the same scale, and
raising the threshold while narrowing the scope keeps difficulty roughly constant.

Branches sit 5 points below lines because a fully-covered function can still have an
unreached defensive branch, and chasing the last few is where coverage work stops
paying. It is set as a floor, not a target.

The allowlist's cost is real and stated in `## Testing`: unlisted modules are invisible.
A denylist would fail safer — new files are measured by default — but it makes the
number dishonest, because the average silently absorbs whatever plumbing nobody
remembered to exclude. Explicit inclusion plus a checklist line is the better trade.

### A.6 Type-aware ESLint over Biome

Biome is substantially faster and three projects in the portfolio use it happily. It is
the better choice for a frontend where most lint value is stylistic.

For Node, the valuable rules need type information. `no-floating-promises`,
`no-misused-promises`, and `no-unsafe-*` cannot be implemented without a type checker,
and they catch the failure mode that actually matters in async batch code: a promise
nobody awaited, so errors vanish and the process exits before work finishes. Biome
cannot express these. The seconds of lint time are worth the trade; Prettier still
handles formatting, where speed is felt interactively.

### A.7 Version pins that are not arbitrary

**TypeScript is capped below 6.1.** `typescript-eslint@8.67.0` declares
`peer typescript@">=4.8.4 <6.1.0"`. TypeScript 7 is published and installs fine on its
own, but `pnpm add typescript typescript-eslint` fails outright against it. So
`typescript@^5.9` is a real constraint, not conservatism — "upgrade to the latest
TypeScript" removes typed linting from the project. Re-check this before raising it;
the cap will move once typescript-eslint ships TS 7 support.

The gate was verified on eslint 10.8.1, typescript-eslint 8.67.0, vitest 4.1.11,
prettier 3.9.6, @types/node 26.2.0, sharp 0.35.3. Flat config and the coverage options
above are stable across the eslint 9→10 and vitest 3→4 boundaries.

---

## Version history

- **v1.0.0** (2026-08-19) — Initial canonical copy.

_Sync rule: this footer rides along when you copy this file into a project. Bump the
version and add a line above whenever you change the master here (`utilities/agent-docs/AGENTS-NODE.md`); do the
same when you bring a change back up from a project copy — that is how the two sides know
who is ahead._
