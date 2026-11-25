import { KIMI_K3_1_PRO_SLUG, KIMI_K3_SLUG } from "@/lib/ai/providers";
import type { ChatMode, SubscriptionTier } from "@/types";
import { PAID_INDIVIDUAL_SUBSCRIPTION_TIERS } from "@/types";

export const KIMI_MAX_REASONING_EFFORT = "max" as const;

// Each Kimi registry key reaches max reasoning only on its own snapshot.
const KIMI_MAX_MODEL_SLUGS: ReadonlyMap<string, string> = new Map([
  ["model-kimi-k3", KIMI_K3_SLUG],
  ["model-kimi-k3.1-pro", KIMI_K3_1_PRO_SLUG],
]);

export function shouldUseMaxKimiReasoning({
  subscription,
  mode,
  selectedModel,
  configuredModelId,
}: {
  subscription: SubscriptionTier;
  mode: ChatMode;
  selectedModel: string;
  configuredModelId: string;
}): boolean {
  return (
    (
      PAID_INDIVIDUAL_SUBSCRIPTION_TIERS as readonly SubscriptionTier[]
    ).includes(subscription) &&
    mode === "agent" &&
    KIMI_MAX_MODEL_SLUGS.get(selectedModel) === configuredModelId
  );
}
