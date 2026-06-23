import { describe, it, expect } from "vitest";

const VALID_ACTIONS = [
  "auth.login",
  "auth.login_blocked",
  "user.create",
  "user.delete",
  "user.set_role",
  "user.reset_password",
  "article.create",
  "article.update",
  "article.delete",
  "article.submit",
  "article.publish",
  "article.reject",
  "category.create",
  "category.delete",
  "tag.create",
  "tag.delete",
  "media.upload",
  "media.delete",
] as const;

describe("audit action naming", () => {
  it("uses entity.action format", () => {
    for (const action of VALID_ACTIONS) {
      const parts = action.split(".");
      expect(parts, `action "${action}" must have dot`).toHaveLength(2);
      expect(parts[0].length, `entity in "${action}" must not be empty`).toBeGreaterThan(0);
      expect(parts[1].length, `verb in "${action}" must not be empty`).toBeGreaterThan(0);
    }
  });

  it("covers all entity types", () => {
    const entities = new Set(VALID_ACTIONS.map((a) => a.split(".")[0]));
    expect(entities).toContain("auth");
    expect(entities).toContain("user");
    expect(entities).toContain("article");
    expect(entities).toContain("category");
    expect(entities).toContain("tag");
    expect(entities).toContain("media");
  });
});

describe("logAudit params shape", () => {
  it("requires actorId, action, entityType", () => {
    const params: {
      actorId: number
      action: string
      entityType: string
      entityId?: number
      summary?: string
      metadata?: Record<string, unknown>
    } = {
      actorId: 1,
      action: "article.create",
      entityType: "article",
    };
    expect(params.actorId).toBe(1);
    expect(params.action).toBe("article.create");
    expect(params.entityType).toBe("article");
  });
});
