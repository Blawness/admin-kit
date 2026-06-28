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

const mediaManager: Permission[] = ["media.read", "media.upload", "media.delete", "profile.edit"];

const viewer: Permission[] = [
  "articles.read", "categories.read", "media.read", "users.read",
];

/** Ready-made role maps and permission bundles consumers can spread into defineRbac. */
export const presets = {
  /** Replicates the legacy 2-role behavior. */
  adminEditor: {
    admin: ["*"] as Permission[],
    editor: contentEditor,
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
