import { redirect } from "next/navigation";
import { requireUser } from "../../lib/auth-helpers";
import { getActiveRbac } from "../../rbac/registry";
import { getArticleById } from "../../lib/admin/articles";
import { listCategories, listTags } from "../../lib/admin/categories";
import { ArticleForm } from "./article-form";
import {
  createArticleAction,
  updateArticleAction,
  publishArticleAction,
  rejectArticleAction,
} from "./actions";

export default async function ArticleFormScreen({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; error?: string }>;
}) {
  const session = await requireUser();
  const { id: idParam, error } = await searchParams;
  const isAdmin = getActiveRbac().can(session.user.role, "articles.publish");

  const [categories, availableTags] = await Promise.all([
    listCategories(),
    listTags(),
  ]);

  if (idParam) {
    const article = await getArticleById(Number(idParam));
    if (!article) redirect("/admin/articles");
    if (!isAdmin && article.authorId !== Number(session.user.id)) {
      redirect("/admin/articles?error=Tidak+diizinkan");
    }

    return (
      <ArticleForm
        mode="edit"
        canPublish={isAdmin}
        categories={categories}
        availableTags={availableTags}
        error={error}
        initial={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          content: article.content,
          coverImageUrl: article.coverImageUrl,
          excerpt: article.excerpt,
          metaTitle: article.metaTitle,
          metaDescription: article.metaDescription,
          ogImage: article.ogImage,
          categoryId: article.categoryId,
          tagIds: article.tags.map((t) => t.id),
          status: article.status,
        }}
        createAction={createArticleAction}
        updateAction={updateArticleAction}
        publishAction={publishArticleAction}
        rejectAction={rejectArticleAction}
      />
    );
  }

  return (
    <ArticleForm
      mode="create"
      canPublish={isAdmin}
      categories={categories}
      availableTags={availableTags}
      error={error}
      createAction={createArticleAction}
      updateAction={updateArticleAction}
      publishAction={publishArticleAction}
      rejectAction={rejectArticleAction}
    />
  );
}
