import { describe, it, expect } from "vitest";
import { slugify } from "../src/lib/slug.ts";

describe("slugify", () => {
  it("lowercases", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("converts spaces to hyphens", () => {
    expect(slugify("foo bar baz")).toBe("foo-bar-baz");
  });

  it("removes diacritics", () => {
    expect(slugify("Crème Brûlée")).toBe("creme-brulee");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  -Hello-  ")).toBe("hello");
    expect(slugify("!!!Hello!!!")).toBe("hello");
  });

  it("collapses special chars into a single hyphen", () => {
    expect(slugify("foo @#$ bar")).toBe("foo-bar");
    expect(slugify("a___b")).toBe("a-b");
  });

  it("caps length at 80 chars", () => {
    const long = "a".repeat(200);
    const result = slugify(long);
    expect(result.length).toBe(80);
  });

  it("returns empty string for input with no alphanumerics", () => {
    expect(slugify("!!!")).toBe("");
  });
});
