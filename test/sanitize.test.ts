import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../src/lib/sanitize.ts";

describe("sanitizeHtml", () => {
  it("strips <script> tags", () => {
    const out = sanitizeHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("<p>hi</p>");
  });

  it("strips event handler attributes", () => {
    const out = sanitizeHtml('<p onclick="evil()">hi</p>');
    expect(out).not.toContain("onclick");
    expect(out).toContain("<p>hi</p>");
  });

  it("strips javascript: hrefs", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("rejects protocol-relative //host hrefs", () => {
    const out = sanitizeHtml('<a href="//evil.com">x</a>');
    expect(out).not.toContain("//evil.com");
  });

  it("keeps allowed tags", () => {
    const out = sanitizeHtml(
      '<p>a</p><strong>b</strong><h2>c</h2>'
    );
    expect(out).toContain("<p>a</p>");
    expect(out).toContain("<strong>b</strong>");
    expect(out).toContain("<h2>c</h2>");
  });

  it("keeps a with href", () => {
    const out = sanitizeHtml('<a href="https://example.com">link</a>');
    expect(out).toContain('href="https://example.com"');
  });

  it("keeps img with src", () => {
    const out = sanitizeHtml('<img src="https://example.com/x.png" alt="x" />');
    expect(out).toContain('src="https://example.com/x.png"');
  });

  it("drops target attr", () => {
    const out = sanitizeHtml('<a href="https://example.com" target="_blank">x</a>');
    expect(out).not.toContain("target");
  });
});
