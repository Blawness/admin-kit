import type { Permission } from "./permissions";

const articleAuthor: Permission[] = [
  "articles.read", "articles.create", "articles.update",
  "media.read", "media.upload",
];

const contentEditor: Permission[] = [
  "articles.read", "articles.create", "articles.update", "articles.delete", "articles.publish",
  "categories.read", "categories.create", "categories.update", "categories.delete",
  "media.read", "media.upload", "media.delete",
  "profile.edit",
];

/**
 * Exact scope the legacy `editor` role had before 0.8: read/create/update articles,
 * read/upload media, and edit own profile. Publish, delete, category mutations, and
 * user management remain admin-only — matching the pre-0.8 requireAdmin gates.
 */
const legacyEditor: Permission[] = [
  "articles.read", "articles.create", "articles.update",
  "media.read", "media.upload",
  "profile.edit",
];

const mediaManager: Permission[] = ["media.read", "media.upload", "media.delete", "profile.edit"];

const viewer: Permission[] = [
  "articles.read", "categories.read", "media.read", "users.read",
];

/** Ready-made role maps and permission bundles consumers can spread into defineRbac. */
export const presets = {
  /**
   * Replicates the legacy 2-role behavior: admin is all-powerful ("*") and editor
   * receives exactly the pre-0.8 editor scope (read/create/update articles,
   * read/upload media, profile.edit). Publish, delete, category mutations, and user
   * management remain admin-only, preserving the zero-change upgrade path.
   */
  adminEditor: {
    admin: ["*"] as Permission[],
    editor: legacyEditor,
  },
  /** Common four-tier hierarchy. */
  fourTier: {
    admin: ["*"] as Permission[],
    editor: contentEditor,
    author: articleAuthor,
    viewer,
  },
  /** Named permission bundles to compose custom roles. */
  permissions: { contentEditor, mediaManager, articleAuthor },
} as const;
