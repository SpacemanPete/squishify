export interface BuildOutputNameOptions {
  prefix?: string;
  suffix?: string;
  ext?: string;
}

export function buildOutputName(
  originalName: string,
  { prefix = "", suffix = "", ext }: BuildOutputNameOptions,
): string {
  const dot = originalName.lastIndexOf(".");
  const stem = dot > 0 ? originalName.slice(0, dot) : originalName;
  const currentExt = dot > 0 ? originalName.slice(dot) : "";
  return `${prefix}${stem}${suffix}${ext ?? currentExt}`;
}

export function resolveCollision(name: string, existingNames: string[]): string {
  const taken = new Set(existingNames);
  if (!taken.has(name)) {
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 1;
  while (taken.has(`${stem}-${n}${ext}`)) {
    n++;
  }
  return `${stem}-${n}${ext}`;
}
