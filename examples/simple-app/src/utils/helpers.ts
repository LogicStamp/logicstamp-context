export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
