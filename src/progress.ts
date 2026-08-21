export interface ProgressCounts {
  processed: number;
  skipped: number;
  errors: number;
}

export function formatProgress(
  index: number,
  total: number,
  currentName: string,
  { processed, skipped, errors }: ProgressCounts,
): string {
  const errorLabel = errors === 1 ? "error" : "errors";
  return `Processing ${index}/${total} — ${currentName} (processed ${processed}, skipped ${skipped}, ${errorLabel} ${errors})`;
}
