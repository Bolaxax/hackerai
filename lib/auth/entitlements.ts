import type { SubscriptionTier } from "@/types";

type PaidSubscriptionTier = Exclude<SubscriptionTier, "free">;

/** All known paid entitlement slugs, grouped by tier (highest first). */
const TIER_ENTITLEMENTS: ReadonlyArray<{
  tier: PaidSubscriptionTier;
  slugs: readonly string[];
}> = [
  {
    tier: "ultra",
    slugs: ["ultra-plan", "ultra-monthly-plan", "ultra-yearly-plan"],
  },
  { tier: "team", slugs: ["team-plan"] },
  {
    tier: "pro-plus",
    slugs: ["pro-plus-plan", "pro-plus-monthly-plan", "pro-plus-yearly-plan"],
  },
  {
    tier: "pro",
    slugs: ["pro-plan", "pro-monthly-plan", "pro-yearly-plan"],
  },
];

/**
 * Safely coerce a raw entitlements value (from a JWT or session) into a
 * typed string array.
 */
export function parseEntitlements(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((e: unknown): e is string => typeof e === "string")
    : [];
}

/**
 * Self-host override: when NEXT_PUBLIC_FORCE_SUBSCRIPTION_TIER names a paid
 * tier, every authenticated user resolves to it regardless of WorkOS/Stripe
 * entitlements. Unset or unknown values keep entitlement-based tiers.
 *
 * The NEXT_PUBLIC_ prefix makes `next build` inline one value into both the
 * server and browser bundles, so set it at build time; Convex reads the same
 * name from its deployment env. Keep the literal `process.env.NEXT_PUBLIC_*`
 * access, because Next.js does not inline dynamic or destructured lookups.
 */
export function getForcedSubscriptionTier(): PaidSubscriptionTier | null {
  const forced = process.env.NEXT_PUBLIC_FORCE_SUBSCRIPTION_TIER?.trim();
  return TIER_ENTITLEMENTS.find(({ tier }) => tier === forced)?.tier ?? null;
}

/**
 * Resolve the highest subscription tier present in an entitlements list.
 * Returns `"free"` when no paid entitlement matches and no tier is forced.
 */
export function resolveSubscriptionTier(
  entitlements: readonly string[],
): SubscriptionTier {
  const forcedTier = getForcedSubscriptionTier();
  if (forcedTier) return forcedTier;

  for (const { tier, slugs } of TIER_ENTITLEMENTS) {
    if (slugs.some((s) => entitlements.includes(s))) {
      return tier;
    }
  }
  return "free";
}

export function hasPaidEntitlement(entitlements: readonly string[]): boolean {
  return resolveSubscriptionTier(entitlements) !== "free";
}
