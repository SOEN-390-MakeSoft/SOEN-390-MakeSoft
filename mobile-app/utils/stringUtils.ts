/**
 * Normalizes a label by removing accents and special characters for comparison
 * @param value String to normalize
 * @returns Normalized lowercase string with no accents or special characters
 */
export function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Extracts building code from building name
 * Matches patterns like "H -", "(H)", or trailing "H"
 * @param name Building name
 * @returns Building code or null if not found
 */
export function extractCodeFromName(name: string): string | null {
  const dashMatch = name.match(/^([A-Z]{1,3})\s*-/);
  if (dashMatch) return dashMatch[1];

  const parenMatch = name.match(/\(([A-Z]{1,3})\)\s*$/);
  if (parenMatch) return parenMatch[1];

  const trailingMatch = name.match(/(?:^|\s)([A-Z]{1,3})\s*$/);
  return trailingMatch ? trailingMatch[1] : null;
}
