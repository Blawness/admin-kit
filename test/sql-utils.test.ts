import { describe, it, expect } from "vitest";
import { escapeLike } from "../src/lib/sql-utils.ts";

describe("escapeLike", () => {
  it("escapes LIKE wildcards so they match literally", () => {
    expect(escapeLike("50%")).toBe("50\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes the backslash escape char itself", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeLike("hello world")).toBe("hello world");
    expect(escapeLike("judul-artikel")).toBe("judul-artikel");
  });

  it("handles empty input", () => {
    expect(escapeLike("")).toBe("");
  });
});
