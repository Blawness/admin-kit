// test/storage-select.test.ts
import { describe, it, expect } from "vitest";
import { resolveProviderName } from "../src/lib/storage/index";

describe("resolveProviderName", () => {
  it("defaults to r2 when unset", () => {
    expect(resolveProviderName(undefined)).toBe("r2");
    expect(resolveProviderName("")).toBe("r2");
  });
  it("accepts r2 and uploadthing (case/space-insensitive)", () => {
    expect(resolveProviderName("r2")).toBe("r2");
    expect(resolveProviderName(" UploadThing ")).toBe("uploadthing");
  });
  it("throws on unknown provider", () => {
    expect(() => resolveProviderName("s3")).toThrow(/ADMIN_KIT_STORAGE_PROVIDER/);
  });
});
