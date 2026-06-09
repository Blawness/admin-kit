import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role").default("editor"),
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
