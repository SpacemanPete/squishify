import { describe, expect, it } from "vitest";

import { placeholder } from "./placeholder.ts";

describe("placeholder", () => {
  it("returns the placeholder string", () => {
    expect(placeholder()).toBe("placeholder");
  });
});
