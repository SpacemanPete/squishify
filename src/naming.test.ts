import { describe, expect, it } from "vitest";

import { buildOutputName } from "./naming.ts";

describe("buildOutputName", () => {
  it("applies only the prefix", () => {
    expect(buildOutputName("image.png", { prefix: "prod-" })).toBe("prod-image.png");
  });

  it("applies only the suffix", () => {
    expect(buildOutputName("image.png", { suffix: "-web" })).toBe("image-web.png");
  });

  it("applies both prefix and suffix", () => {
    expect(buildOutputName("image.png", { prefix: "prod-", suffix: "-web" })).toBe("prod-image-web.png");
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
