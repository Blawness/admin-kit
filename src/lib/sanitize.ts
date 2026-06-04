import sanitizeHtmlLib from "sanitize-html";

/**
 * Sanitize editor HTML before persisting (content is rendered via
 * dangerouslySetInnerHTML on the public site).
 *
 * Uses `sanitize-html` (pure JS, htmlparser2 — no jsdom) so it loads in the
 * Vercel serverless runtime; `isomorphic-dompurify`/jsdom failed to load there
 * ("Failed to load external module" → /admin/posts 500).
 *
 * Security posture (unchanged): strict tag allowlist, no `target` (avoids
 * tab-napping), only http(s)/mailto + root-relative URLs, and protocol-relative
 * `//host` URLs are rejected.
 */
export function sanitizeHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: [
      "p", "br", "strong", "em", "u", "s", "h2", "h3", "h4",
      "ul", "ol", "li", "blockquote", "a", "img", "figure", "figcaption",
    ],
    allowedAttributes: {
      a: ["href", "rel", "title"],
      img: ["src", "alt", "title"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
  });
}
