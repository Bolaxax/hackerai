/**
 * Self-host override: NEXT_PUBLIC_DISABLE_CLOUD_SANDBOX=true runs Agent only
 * on the user's connected computers, for every tier. Nothing offers, selects,
 * or falls back to an E2B/MIOSA cloud sandbox, and "e2b" only means that no
 * computer is selected yet, as it already does for free users.
 *
 * `next build` inlines the literal `process.env.NEXT_PUBLIC_*` access into
 * both the browser and server bundles, so set it at build time. The Trigger.dev
 * bundle does not inline it and reads the worker's environment at runtime.
 */
export function isCloudSandboxDisabled(): boolean {
  return process.env.NEXT_PUBLIC_DISABLE_CLOUD_SANDBOX?.trim() === "true";
}
