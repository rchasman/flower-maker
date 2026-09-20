import { describe, expect, test } from "bun:test";
import { signedInLoadStage } from "./loadStage.ts";

const base = {
  authLoading: false,
  isAuthenticated: true,
  state: "connected" as const,
  claimPending: false,
};

describe("signedInLoadStage", () => {
  test("waits on the session while auth restores, before it knows who you are", () => {
    expect(
      signedInLoadStage({
        ...base,
        authLoading: true,
        isAuthenticated: false,
        state: "disconnected",
      }),
    ).toBe("session");
  });

  test("leaves an anonymous visitor on the ordinary landing", () => {
    expect(
      signedInLoadStage({
        ...base,
        isAuthenticated: false,
        state: "connecting",
      }),
    ).toBeNull();
  });

  test("holds through the reconnect that swaps the anonymous token for OIDC", () => {
    expect(signedInLoadStage({ ...base, state: "disconnected" })).toBe(
      "connecting",
    );
    expect(signedInLoadStage({ ...base, state: "connecting" })).toBe(
      "connecting",
    );
  });

  test("holds while the anonymous identity is claimed", () => {
    expect(signedInLoadStage({ ...base, claimPending: true })).toBe("claiming");
  });

  test("reports an unreachable database instead of spinning", () => {
    expect(signedInLoadStage({ ...base, state: "error" })).toBe("error");
  });

  test("releases a signed-in visitor once connected and claimed", () => {
    expect(signedInLoadStage(base)).toBeNull();
  });
});
