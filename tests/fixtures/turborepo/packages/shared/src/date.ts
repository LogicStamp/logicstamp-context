export function formatBuildDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
