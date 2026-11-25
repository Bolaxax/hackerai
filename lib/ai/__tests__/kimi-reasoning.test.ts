import { describe, expect, it } from "@jest/globals";
import {
  KIMI_MAX_REASONING_EFFORT,
  shouldUseMaxKimiReasoning,
} from "../kimi-reasoning";

const eligibleRequest = {
  subscription: "pro" as const,
  mode: "agent" as const,
  selectedModel: "model-kimi-k3",
  configuredModelId: "moonshotai/kimi-k3",
};

describe("Kimi reasoning policy", () => {
  it("uses max reasoning as the explicit production default", () => {
    expect(KIMI_MAX_REASONING_EFFORT).toBe("max");
    expect(shouldUseMaxKimiReasoning(eligibleRequest)).toBe(true);
  });

  it("limits max reasoning to paid individual Max Agent requests served by Kimi", () => {
    expect(
      shouldUseMaxKimiReasoning({
        ...eligibleRequest,
        subscription: "free",
      }),
    ).toBe(false);
    expect(
      shouldUseMaxKimiReasoning({
        ...eligibleRequest,
        subscription: "team",
      }),
    ).toBe(false);
    expect(
      shouldUseMaxKimiReasoning({
        ...eligibleRequest,
        mode: "ask",
      }),
    ).toBe(false);
    expect(
      shouldUseMaxKimiReasoning({
        ...eligibleRequest,
        selectedModel: "agent-model",
      }),
    ).toBe(false);
    expect(
      shouldUseMaxKimiReasoning({
        ...eligibleRequest,
        configuredModelId: "x-ai/grok-4.6",
      }),
    ).toBe(false);
  });

  it("uses max reasoning for the Kimi K3.1 Pro Max route on its own snapshot", () => {
    const k31Request = {
      ...eligibleRequest,
      selectedModel: "model-kimi-k3.1-pro",
      configuredModelId: "moonshotai/kimi-k3.1-pro",
    };
    expect(shouldUseMaxKimiReasoning(k31Request)).toBe(true);
    expect(
      shouldUseMaxKimiReasoning({
        ...k31Request,
        configuredModelId: "moonshotai/kimi-k3",
      }),
    ).toBe(false);
    expect(
      shouldUseMaxKimiReasoning({
        ...eligibleRequest,
        configuredModelId: "moonshotai/kimi-k3.1-pro",
      }),
    ).toBe(false);
  });
});
