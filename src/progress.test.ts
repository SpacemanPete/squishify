import { describe, expect, it } from "vitest";

import { formatProgress } from "./progress.ts";

describe("formatProgress", () => {
  it("renders the first file with running counts", () => {
    expect(formatProgress(1, 24, "hero.png", { processed: 1, skipped: 0, errors: 0 })).toBe(
      "Processing 1/24 — hero.png (processed 1, skipped 0, errors 0)",
    );
  });

  it("renders a mid-run position with running counts", () => {
    expect(formatProgress(12, 24, "hero.png", { processed: 9, skipped: 1, errors: 2 })).toBe(
      "Processing 12/24 — hero.png (processed 9, skipped 1, errors 2)",
    );
  });

  it("uses singular wording for exactly one error", () => {
    expect(formatProgress(1, 1, "logo.png", { processed: 0, skipped: 0, errors: 1 })).toBe(
      "Processing 1/1 — logo.png (processed 0, skipped 0, error 1)",
    );
  });
});
