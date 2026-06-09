import { describe, it, expect } from "vitest";
import { escapeXml } from "../src/lib/xml.ts";

describe("escapeXml", () => {
  it("escapes the five XML entities", () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;",
    );
  });

  it("escapes ampersand exactly once (no double-encoding)", () => {
    expect(escapeXml("a & b & c")).toBe("a &amp; b &amp; c");
  });

  it("leaves plain text untouched", () => {
    expect(escapeXml("Berita terbaru hari ini")).toBe("Berita terbaru hari ini");
  });
});
