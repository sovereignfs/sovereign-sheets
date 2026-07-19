/** Unix seconds "now", matching the integer `created_at`/`updated_at` column convention. */
export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}
