import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  primaryKey,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  // No hardcoded default: a missing role resolves to the consumer's
  // configured fallbackRole at request time (see auth/config.ts).
  role: text("role"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  altText: text("alt_text"),
  album: text("album"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    content: text("content"),
    coverImageUrl: text("cover_image_url"),
    excerpt: text("excerpt"),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    ogImage: text("og_image"),
    status: text("status").notNull().default("draft"),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    authorId: integer("author_id").notNull().references(() => users.id),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("articles_status_idx").on(t.status),
    index("articles_author_id_idx").on(t.authorId),
    index("articles_category_id_idx").on(t.categoryId),
    index("articles_created_at_idx").on(t.createdAt),
  ]
);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  summary: text("summary"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("audit_logs_actor_id_idx").on(t.actorId),
  index("audit_logs_action_idx").on(t.action),
  index("audit_logs_entity_type_id_idx").on(t.entityType, t.entityId),
  index("audit_logs_created_at_idx").on(t.createdAt),
]);

export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  identifier: text("identifier").notNull(),
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
}, (t) => [
  index("login_attempts_identifier_attempted_at_idx").on(t.identifier, t.attemptedAt),
]);

export const articleTags = pgTable(
  "article_tags",
  {
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.tagId] })]
);
