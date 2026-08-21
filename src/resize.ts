export type ResizeAxis = "width" | "height";

export type ResizeDecision = { resize: false } | { resize: true; width: number; height: number };

export function shouldResize(
  width: number,
  height: number,
  maxDimension: number,
  axis: ResizeAxis,
): ResizeDecision {
  const current = axis === "width" ? width : height;
  if (current <= maxDimension) {
    return { resize: false };
  }
  const scale = maxDimension / current;
  return axis === "width"
    ? { resize: true, width: maxDimension, height: Math.round(height * scale) }
    : { resize: true, width: Math.round(width * scale), height: maxDimension };
}
