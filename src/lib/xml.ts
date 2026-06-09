const XML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * Escape a string for safe inclusion in XML text/attribute values — used by the
 * RSS feed and sitemap builders. `&` must be replaced first (handled here by a
 * single pass over all five entities).
 */
export function escapeXml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => XML_ENTITIES[c]);
}
