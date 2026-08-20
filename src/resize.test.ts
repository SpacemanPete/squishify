import { describe, expect, it } from "vitest";

import { shouldResize } from "./resize.ts";

describe("shouldResize", () => {
  it("fit by width preserves aspect ratio", () => {
    expect(shouldResize(4000, 3000, 2000, "width")).toEqual({
      resize: true,
      width: 2000,
      height: 1500,
    });
  });

  it("fit by height preserves aspect ratio", () => {
    expect(shouldResize(4000, 3000, 1500, "height")).toEqual({
      resize: true,
      width: 2000,
      height: 1500,
    });
  });

  it("reports already fits when smaller than the target (no upscaling)", () => {
    expect(shouldResize(800, 600, 2000, "width")).toEqual({ resize: false });
  });

  it("reports already fits when exactly at the target", () => {
    expect(shouldResize(2000, 1500, 2000, "width")).toEqual({ resize: false });
  });

  it("computes correct dimensions when fitting by width", () => {
    expect(shouldResize(1200, 800, 600, "width")).toEqual({
      resize: true,
      width: 600,
      height: 400,
    });
  });

  it("computes correct dimensions when fitting by height", () => {
    expect(shouldResize(1200, 800, 400, "height")).toEqual({
      resize: true,
      width: 600,
      height: 400,
    });
  });
});
