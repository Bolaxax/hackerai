import { resolveCurrentAgentEntitlementContext } from "@/lib/auth/agent-auto-review-entitlements";
import {
  getForcedSubscriptionTier,
  hasPaidEntitlement,
  resolveSubscriptionTier,
} from "@/lib/auth/entitlements";

const FORCED_TIER_ENV = "NEXT_PUBLIC_FORCE_SUBSCRIPTION_TIER";

const createClients = () => ({
  workos: {
    userManagement: {
      listOrganizationMemberships: jest.fn(async () => ({ data: [] })),
    },
    organizations: {
      getOrganization: jest.fn(async () => ({ stripeCustomerId: null })),
    },
  },
  stripe: {
    subscriptions: {
      list: jest.fn(async () => ({ has_more: false, data: [] })),
    },
  },
});

describe("forced self-host subscription tier", () => {
  const originalValue = process.env[FORCED_TIER_ENV];

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[FORCED_TIER_ENV];
    } else {
      process.env[FORCED_TIER_ENV] = originalValue;
    }
  });

  it("keeps entitlement-based tiers when unset, free, or unknown", () => {
    delete process.env[FORCED_TIER_ENV];
    expect(resolveSubscriptionTier([])).toBe("free");
    expect(resolveSubscriptionTier(["pro-plan"])).toBe("pro");

    for (const value of ["", "free", "platinum"]) {
      process.env[FORCED_TIER_ENV] = value;
      expect(getForcedSubscriptionTier()).toBeNull();
      expect(resolveSubscriptionTier([])).toBe("free");
    }
  });

  it("resolves every user to the forced tier", () => {
    process.env[FORCED_TIER_ENV] = " ultra ";

    expect(resolveSubscriptionTier([])).toBe("ultra");
    expect(resolveSubscriptionTier(["pro-plan"])).toBe("ultra");
    expect(hasPaidEntitlement([])).toBe(true);
  });

  it("revalidates Agent approvals without WorkOS or Stripe", async () => {
    process.env[FORCED_TIER_ENV] = "ultra";
    const clients = createClients();

    await expect(
      resolveCurrentAgentEntitlementContext({ userId: "user_1" }, clients),
    ).resolves.toEqual({ subscription: "ultra" });
    await expect(
      resolveCurrentAgentEntitlementContext(
        { userId: "user_1", organizationId: "org_1" },
        clients,
      ),
    ).resolves.toEqual({ subscription: "ultra", organizationId: "org_1" });
    expect(
      clients.workos.userManagement.listOrganizationMemberships,
    ).not.toHaveBeenCalled();
    expect(clients.stripe.subscriptions.list).not.toHaveBeenCalled();
  });
});
