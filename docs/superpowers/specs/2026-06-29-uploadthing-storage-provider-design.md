# Pluggable storage providers with UploadThing support

**Date:** 2026-06-29
**Status:** Approved — ready for implementation plan
**Package:** `@blawness/admin-kit`

## Summary

Add UploadThing as an opt-in alternative storage backend alongside the existing
Cloudflare R2 (S3) backend. Today R2 is the only storage option and the
upload/delete helpers (`uploadFile`, `uploadImage`, `deleteObjectByUrl`) are
hard-wired to it. We introduce a thin storage-provider abstraction so consumers
can switch backends via an environment variable, with **R2 remaining the default**
and **zero code changes required** for existing consumers.

### Decisions locked during brainstorming

- **Scope:** add UploadThing as an *alternative provider* behind an abstraction
  (not a replacement, not both-always-on).
- **Integration model:** *server-side via UTApi*. The file continues to flow
  through the existing server action and `sharp` processing; only the storage
  backend swaps. Native client-direct UploadThing uploads are out of scope.
- **Selection:** *environment variable* `ADMIN_KIT_STORAGE_PROVIDER`, default R2.
- **Dependency:** `uploadthing` is an *optional peerDependency*, lazily imported
  only when the UploadThing provider is selected.

## Architecture

New layer under `src/lib/storage/`:

```
src/lib/storage/
  index.ts        # public API: uploadFile, uploadImage, deleteObjectByUrl; resolves active provider
  types.ts        # StorageProvider interface + ProcessedUpload type
  process.ts      # shared sharp logic (moved out of r2.ts)
  r2.ts           # R2Provider (existing S3 code, refactored to the interface)
  uploadthing.ts  # UploadThingProvider (UTApi, lazy-imported)
```

`src/lib/r2.ts` becomes a thin back-compat shim re-exporting from
`storage/r2.ts` so the existing root export `export * from "./lib/r2"` keeps
`r2()`, `R2_BUCKET`, `R2_PUBLIC_URL` alive. (Alternatively, repoint
`src/index.ts` at `./lib/storage` and re-export the R2 helpers there — the
implementer picks whichever keeps the public surface identical.)

### Interface

```ts
// Shared sharp output, computed once, provider-agnostic
type ProcessedUpload = { body: Buffer; ext: string; contentType: string };

interface StorageProvider {
  name: "r2" | "uploadthing";
  put(p: ProcessedUpload, keyBase: string, fileName: string): Promise<{ url: string; key: string; size: number }>;
  deleteByUrl(url: string): Promise<boolean>;
}
```

`process.ts` holds the `sharp` resize/webp/jpeg branch logic currently embedded
in `uploadFile`. The public `uploadFile`/`uploadImage` in `storage/index.ts`:

1. run `processImage()` — or skip for non-images via `skipProcessing` (the
   passthrough branch currently in `uploadFile`),
2. generate the `keyBase`,
3. delegate to `getActiveProvider().put(...)`.

`deleteObjectByUrl(url)` delegates to `getActiveProvider().deleteByUrl(url)`.

**Public API is preserved exactly:** `uploadFile`, `uploadImage`,
`deleteObjectByUrl` keep identical signatures and stay re-exported from the
package root. The R2-specific exports (`r2()`, `R2_BUCKET`, `R2_PUBLIC_URL`)
remain exported for back-compat.

### Provider selection

`getActiveProvider()` reads `ADMIN_KIT_STORAGE_PROVIDER` once, lazily, and caches
the resolved provider — mirroring the existing `getR2()` lazy-init pattern so
importing the module never throws when env is absent (important for consumer
`next build`).

- unset or `"r2"` → `R2Provider`
- `"uploadthing"` → `UploadThingProvider`
- any other value → throw a clear error

### UploadThingProvider

- Lazy `await import("uploadthing/server")` so R2-only consumers never need the
  package installed (optional peerDependency).
- `put`: wraps the processed buffer in a `File`
  (`new File([body], \`${fileName}.${ext}\`, { type: contentType })`) and calls
  `utapi.uploadFiles(file)`; returns `{ url: data.ufsUrl, key: data.key, size: body.length }`.
  `UTApi` reads `UPLOADTHING_TOKEN` from env automatically.
- `deleteByUrl`: extracts the file key from the UploadThing URL (`.../f/<key>`)
  and calls `utapi.deleteFiles([key])`; returns `false` for non-UploadThing URLs
  (mirrors R2's "ignore foreign/seed URLs" behavior).
- **Verify against installed version:** the exact `UTApi.uploadFiles` /
  `deleteFiles` method names and return shapes (`data.ufsUrl` vs `data.url`)
  must be confirmed against the `uploadthing` version resolved at implementation
  time before finalizing.

## Data flow

The media library, screens, and server action are unchanged — they call the same
public helpers, which now route to the active provider:

```
Uploader (client) ──FormData──> uploadImageAction (server action, unchanged)
  └─ validates type/size (unchanged)
  └─ uploadImage(buf, keyBase) ──> processImage() ──> getActiveProvider().put()
                                                        ├─ R2Provider → S3 PutObject → R2_PUBLIC_URL/key
                                                        └─ UTProvider → UTApi.uploadFiles → ufsUrl
  └─ db.insert(media).values({ url, ... })  (unchanged)
```

`deleteMedia` (`src/screens/media/lib.ts`) calls `deleteObjectByUrl`, which now
delegates to the active provider — works against either backend with no change.

The `media.url` column stores whatever absolute URL the provider returns (R2
public URL or UploadThing `ufs.sh` URL).

**Consumer note (for docs/skill):** with UploadThing, image hostnames change, so
`next.config` `images.remotePatterns` must include the UploadThing host
(`*.ufs.sh` / `utfs.io`).

## Error handling

- Missing/invalid `ADMIN_KIT_STORAGE_PROVIDER` → throw at provider resolution
  with a clear message (consistent with R2's lazy env validation).
- `uploadthing` not installed but provider selected → the lazy `import()`
  rejects; catch and rethrow as
  `admin-kit: install \`uploadthing\` to use the UploadThing storage provider`.
- Missing `UPLOADTHING_TOKEN` → surface UTApi's error, wrapped with an
  `admin-kit:` prefix.
- UTApi returns `{ error }` (it does not throw by default) → throw so the
  existing `try/catch` in `uploadImageAction` converts it to the user-facing
  `"Berkas gagal diproses."`.
- `deleteByUrl` on a foreign URL → return `false`, never throw (preserves
  seed/external-image safety).

## Testing (Vitest, existing setup)

SDKs mocked; no live network calls.

- **`process.ts`** — sharp branch selection: animated→webp, alpha/png→webp,
  opaque→jpeg, and `skipProcessing` passthrough. Now independently testable.
- **`getActiveProvider()`** — env matrix: unset→r2, `"r2"`→r2,
  `"uploadthing"`→ut, garbage→throws; plus caching behavior.
- **UploadThingProvider** — mock `uploadthing/server`'s `UTApi`; assert `put`
  wraps the buffer into a `File` and maps `ufsUrl`/`key`; assert `deleteByUrl`
  extracts the key and ignores foreign URLs.
- **R2Provider** — keep/adapt existing behavior; assert `deleteByUrl` still
  strips `R2_PUBLIC_URL`.
- **Back-compat** — `uploadImage`/`uploadFile`/`deleteObjectByUrl` still
  exported from the package root with the same signatures.

## Out of scope (YAGNI)

- Native client-direct UploadThing uploads (route handler + `useUploadThing`).
- Per-call or per-screen provider override.
- Migrating existing R2 media to UploadThing.
- Running multiple providers simultaneously.

Single active provider, selected by env var.

## Env vars (additions)

| Var | Purpose |
|---|---|
| `ADMIN_KIT_STORAGE_PROVIDER` | `r2` (default) or `uploadthing`. |
| `UPLOADTHING_TOKEN` | UploadThing app token; required when provider is `uploadthing`. |
