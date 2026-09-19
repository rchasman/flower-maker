import { describe, expect, test } from "bun:test";
import { gateway } from "ai";
import { DEFAULT_MODEL, MODELS } from "./models";

const hasGatewayKey = Boolean(process.env.AI_GATEWAY_API_KEY);

describe("gateway model list", () => {
  test("the default model is in the list", () => {
    expect(MODELS.map(m => m.fullName)).toContain(DEFAULT_MODEL);
  });

  test.skipIf(!hasGatewayKey)(
    "every configured model is served by the AI Gateway",
    async () => {
      const served = new Set(
        (await gateway.getAvailableModels()).models.map(m => m.id),
      );
      const missing = MODELS.map(m => m.fullName).filter(id => !served.has(id));
      expect(missing).toEqual([]);
    },
  );
});
