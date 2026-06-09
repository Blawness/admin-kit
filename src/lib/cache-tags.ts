/**
 * Cache tag shared between the public cached read helpers
 * (`@blawness/admin-kit/public`) and the admin server actions.
 *
 * The admin mutations call `revalidateTag(ARTICLES_TAG)` and the public reads
 * call `cacheTag(ARTICLES_TAG)`, so any create/update/publish/delete invalidates
 * the cached published-article queries.
 *
 * This module is plain (no `use cache` directive) on purpose: the admin action
 * graph imports only this constant, so importing admin code never drags the
 * `use cache` directive in — that would otherwise force every consumer to
 * enable `cacheComponents`, not just those using the `/public` reads.
 */
export const ARTICLES_TAG = "articles";
