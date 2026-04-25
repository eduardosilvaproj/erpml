// App version — auto-generated at build time via Vite's define
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

export const BUILD_DATE: string =
  typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : new Date().toISOString();

// Minimum required version — update when breaking changes occur
export const MIN_REQUIRED_VERSION = "1.3.1";

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
  if (APP_VERSION === "dev") return false;
  return compareSemver(APP_VERSION, MIN_REQUIRED_VERSION) < 0;
}
