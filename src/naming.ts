export interface BuildOutputNameOptions {
  prefix?: string;
  suffix?: string;
  ext?: string;
}

export function buildOutputName(originalName: string, { prefix = "", suffix = "", ext }: BuildOutputNameOptions): string {
  const dot = originalName.lastIndexOf(".");
  const stem = dot > 0 ? originalName.slice(0, dot) : originalName;
  const currentExt = dot > 0 ? originalName.slice(dot) : "";
  return `${prefix}${stem}${suffix}${ext ?? currentExt}`;
}
