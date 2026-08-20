import { describe, expect, it } from "vitest";

import { buildOutputName, resolveCollision } from "./naming.ts";

describe("buildOutputName", () => {
  it("applies only the prefix", () => {
    expect(buildOutputName("image.png", { prefix: "prod-" })).toBe("prod-image.png");
  });

  it("applies only the suffix", () => {
    expect(buildOutputName("image.png", { suffix: "-web" })).toBe("image-web.png");
  });

  it("applies both prefix and suffix", () => {
    expect(buildOutputName("image.png", { prefix: "prod-", suffix: "-web" })).toBe(
      "prod-image-web.png",
    );
  });

  it("leaves the name unchanged when nothing is applied", () => {
    expect(buildOutputName("image.png", {})).toBe("image.png");
  });

  it("swaps the extension when one is provided", () => {
    expect(buildOutputName("image.png", { prefix: "prod-", suffix: "-web", ext: ".webp" })).toBe(
      "prod-image-web.webp",
    );
  });
});

describe("resolveCollision", () => {
  it("returns the name unchanged when there is no collision", () => {
    expect(resolveCollision("hero.png", ["about.png", "logo.png"])).toBe("hero.png");
  });

  it("appends -1 on the first collision", () => {
    expect(resolveCollision("hero.png", ["hero.png"])).toBe("hero-1.png");
  });

  it("appends -2, -3 for multiple collisions", () => {
    expect(resolveCollision("hero.png", ["hero.png", "hero-1.png", "hero-2.png"])).toBe(
      "hero-3.png",
    );
  });

  it("skips a free slot and continues", () => {
    expect(resolveCollision("hero.png", ["hero.png", "hero-2.png"])).toBe("hero-1.png");
  });
});

describe("buildOutputName edge cases", () => {
  it("handles a name without an extension", () => {
    expect(buildOutputName("image", { prefix: "prod-" })).toBe("prod-image");
  });

  it("applies an extension to a name without one", () => {
    expect(buildOutputName("image", { ext: ".webp" })).toBe("image.webp");
  });
});

describe("resolveCollision edge cases", () => {
  it("handles a name without an extension", () => {
    expect(resolveCollision("image", ["image"])).toBe("image-1");
  });
});
