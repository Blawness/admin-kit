import type { NavItem } from "../shell/sidebar";

/**
 * Drop nav items whose `requires` permission is not allowed; recurse into
 * children and drop groups that become empty. Pure + edge-safe (type-only
 * NavItem import is erased at compile). Shared by the defineRbac bundle and
 * the server-side AdminLayout so the logic lives in exactly one place.
 */
export function filterNavItems(items: NavItem[], allow: (perm: string) => boolean): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    const req = item.requires;
    if (req && !allow(req)) continue;
    if (item.children) {
      const children = filterNavItems(item.children, allow);
      if (children.length === 0) continue;
      out.push({ ...item, children });
    } else {
      out.push(item);
    }
  }
  return out;
}
