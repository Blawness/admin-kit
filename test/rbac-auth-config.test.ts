import { describe, it, expect } from "vitest";
import { buildAuthConfig } from "../src/auth/config.ts";

describe("buildAuthConfig", () => {
  it("jwt callback defaults role to fallbackRole when user has none", () => {
    const cfg = buildAuthConfig("viewer");
    const jwt = cfg.callbacks!.jwt as (a: any) => any;
    const token = jwt({ token: {}, user: { id: "1" } });
    expect(token.role).toBe("viewer");
  });
  it("jwt callback keeps an explicit user role", () => {
    const cfg = buildAuthConfig("viewer");
    const jwt = cfg.callbacks!.jwt as (a: any) => any;
    const token = jwt({ token: {}, user: { id: "1", role: "admin" } });
    expect(token.role).toBe("admin");
  });
  it("session callback copies role from token", () => {
    const cfg = buildAuthConfig("editor");
    const session = cfg.callbacks!.session as (a: any) => any;
    const out = session({ session: { user: {} }, token: { id: "7", role: "author" } });
    expect(out.user.role).toBe("author");
    expect(out.user.id).toBe("7");
  });
});
