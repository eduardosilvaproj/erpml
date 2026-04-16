// App version — increment on each deploy
export const APP_VERSION = "1.0.0";

// Minimum required version — update when breaking changes occur
export const MIN_REQUIRED_VERSION = "1.0.0";

/**
 * Compare two semver strings. Returns:
 *  -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
  }
  return 0;
}

export function isVersionOutdated(): boolean {
  return compareSemver(APP_VERSION, MIN_REQUIRED_VERSION) < 0;
}
