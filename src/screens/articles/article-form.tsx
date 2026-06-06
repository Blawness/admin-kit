"use client";

import { useState, useEffect } from "react";
import { Editor } from "../../components/admin/editor";
import { ImageUpload } from "../../components/admin/image-upload";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { uploadImageAction } from "../media/actions";
import { slugify } from "../../lib/slug";
import { AlertCircle } from "lucide-react";
import type {
  createArticleAction,
  updateArticleAction,
  publishArticleAction,
  rejectArticleAction,
} from "./actions";

type Category = { id: number; name: string; slug: string };
type Tag = { id: number; name: string; slug: string };

export type ArticleFormProps = {
  mode: "create" | "edit";
  role: string;
  categories: Category[];
  availableTags: Tag[];
  error?: string;
  initial?: {
    id: number;
    title: string;
    slug: string;
    content: string | null;
    coverImageUrl: string | null;
    categoryId: number | null;
    tagIds: number[];
    status: string;
  };
  createAction: typeof createArticleAction;
  updateAction: typeof updateArticleAction;
  publishAction: typeof publishArticleAction;
  rejectAction: typeof rejectArticleAction;
};

export function ArticleForm({
  mode,
  role,
  categories,
  availableTags,
  error,
  initial,
  createAction,
  updateAction,
  publishAction,
  rejectAction,
}: ArticleFormProps) {
  const isAdmin = role === "admin";
  const isPendingReview = initial?.status === "pending_review";

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [content, setContent] = useState(initial?.content ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.coverImageUrl ?? "");
  const [selectedTags, setSelectedTags] = useState<number[]>(initial?.tagIds ?? []);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  function toggleTag(id: number) {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  const action = mode === "create" ? createAction : updateAction;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-heading text-2xl font-bold text-navy-900">
        {mode === "create" ? "Tulis Artikel" : "Edit Artikel"}
      </h1>

      {error && (
        <p
          className="flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <form action={action} className="space-y-5">
        {/* Hidden fields managed by client state */}
        <input type="hidden" name="content" value={content} />
        <input type="hidden" name="coverImageUrl" value={coverImageUrl} />
        <input type="hidden" name="slug" value={slug} />
        {selectedTags.map((id) => (
          <input key={id} type="hidden" name="tagIds" value={id} />
        ))}
        {mode === "edit" && (
          <input type="hidden" name="id" value={initial?.id} />
        )}

        <div className="rounded-xl border border-navy-100 bg-white p-6 shadow-sm space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-navy-700">Judul</label>
            <Input
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul artikel"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-navy-700">Slug</label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="slug-artikel"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-navy-700">Kategori</label>
              <select
                name="categoryId"
                defaultValue={initial?.categoryId ?? ""}
                className="h-9 w-full rounded-md border border-navy-200 bg-white px-2.5 text-sm text-navy-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">Tanpa kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-navy-700">Tag</label>
              <div className="flex min-h-[36px] flex-wrap gap-1.5 rounded-md border border-navy-200 bg-white p-2">
                {availableTags.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Belum ada tag</span>
                ) : (
                  availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 transition-colors ${
                        selectedTags.includes(tag.id)
                          ? "bg-brand-600 text-white ring-brand-600"
                          : "bg-white text-navy-600 ring-navy-200 hover:bg-navy-50"
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-navy-700">Cover</label>
            <ImageUpload
              value={coverImageUrl}
              onChange={setCoverImageUrl}
              uploadAction={uploadImageAction}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-navy-700">Konten</label>
            <Editor value={content} onChange={setContent} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="intent" value="draft" variant="outline">
            Simpan Draft
          </Button>
          <Button type="submit" name="intent" value="review">
            Ajukan Review
          </Button>
        </div>
      </form>

      {/* Admin-only publish/reject — only shown on pending_review articles */}
      {isAdmin && isPendingReview && (
        <div className="flex flex-wrap gap-2 border-t border-navy-100 pt-4">
          <form action={publishAction}>
            <input type="hidden" name="id" value={initial?.id} />
            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700 focus-visible:ring-green-500"
            >
              Publish
            </Button>
          </form>
          <form action={rejectAction}>
            <input type="hidden" name="id" value={initial?.id} />
            <Button
              type="submit"
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              Tolak
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
