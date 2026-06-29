# UploadThing Storage Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add UploadThing as an opt-in alternative storage backend behind a provider abstraction, with Cloudflare R2 remaining the default and the public upload/delete API unchanged.

**Architecture:** Introduce `src/lib/storage/` with a `StorageProvider` interface. Shared `sharp` image processing moves into `process.ts`. `uploadFile`/`uploadImage`/`deleteObjectByUrl` keep identical signatures and delegate to the provider chosen by `ADMIN_KIT_STORAGE_PROVIDER`. R2 and UploadThing each implement the interface; the UploadThing SDK is lazily imported.

**Tech Stack:** TypeScript (ESM), `sharp`, `@aws-sdk/client-s3` (R2), `uploadthing` (optional peer, server-side `UTApi`), Vitest.

## Global Constraints

- Package is ESM (`type: module`); relative imports use explicit paths, no extensions in source (tsc resolves).
- Public API `uploadFile`, `uploadImage`, `deleteObjectByUrl` MUST keep identical signatures and stay re-exported from the package root (`src/index.ts`).
- Env access is lazy + cached; importing any storage module MUST NOT throw when env is absent (consumer `next build` safety).
- Default provider is R2; unset `ADMIN_KIT_STORAGE_PROVIDER` behaves exactly as today.
- `uploadthing` is an **optional peerDependency**, imported only via `await import("uploadthing/server")` inside the UploadThing provider.
- Tests live in `/test/**/*.test.ts`. Run with `pnpm test`. Prefer real `sharp` over mocking it.
- Comments in this codebase are written in Indonesian; match that style in touched files.

---

### Task 1: Storage types + shared image processing

**Files:**
- Create: `src/lib/storage/types.ts`
- Create: `src/lib/storage/process.ts`
- Test: `test/storage-process.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `type ProcessedUpload = { body: Buffer; ext: string; contentType: string }` (from `types.ts`)
  - `interface StorageProvider { name: "r2" | "uploadthing"; put(p: ProcessedUpload, keyBase: string): Promise<{ url: string; key: string; size: number }>; deleteByUrl(url: string): Promise<boolean> }` (from `types.ts`)
  - `async function processImage(input: Buffer): Promise<ProcessedUpload>` (from `process.ts`)
  - `function asRawUpload(input: Buffer, contentType: string): ProcessedUpload` (from `process.ts`) — skip-processing path; `ext` is `""`.

- [ ] **Step 1: Write the failing test**

```ts
// test/storage-process.test.ts
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processImage, asRawUpload } from "../src/lib/storage/process";

// Bangun gambar uji kecil agar tidak butuh fixture di disk.
async function makePng(opts: { alpha?: boolean } = {}): Promise<Buffer> {
  return sharp({
    create: {
      width: 10,
      height: 10,
      channels: opts.alpha ? 4 : 3,
      background: opts.alpha ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 10, g: 20, b: 30 },
    },
  })
    .png()
    .toBuffer();
}

async function makeJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 1, g: 2, b: 3 } } })
    .jpeg()
    .toBuffer();
}

describe("processImage", () => {
  it("exports PNG with alpha as webp", async () => {
    const out = await processImage(await makePng({ alpha: true }));
    expect(out.ext).toBe("webp");
    expect(out.contentType).toBe("image/webp");
    expect(out.body.length).toBeGreaterThan(0);
  });

  it("exports opaque jpeg as jpg", async () => {
    const out = await processImage(await makeJpeg());
    expect(out.ext).toBe("jpg");
    expect(out.contentType).toBe("image/jpeg");
  });
});

describe("asRawUpload", () => {
  it("passes the buffer through with no extension", () => {
    const buf = Buffer.from("hello");
    const out = asRawUpload(buf, "application/pdf");
    expect(out.ext).toBe("");
    expect(out.contentType).toBe("application/pdf");
    expect(out.body).toBe(buf);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test storage-process`
Expected: FAIL — cannot resolve `../src/lib/storage/process`.

- [ ] **Step 3: Create the types module**

```ts
// src/lib/storage/types.ts
// Hasil pemrosesan gambar yang sudah siap di-unggah, lepas dari backend mana pun.
export type ProcessedUpload = { body: Buffer; ext: string; contentType: string };

// Kontrak satu backend penyimpanan. `put` menerima buffer yang sudah diproses
// dan keyBase (tanpa ekstensi); provider menentukan key/URL final.
export interface StorageProvider {
  name: "r2" | "uploadthing";
  put(p: ProcessedUpload, keyBase: string): Promise<{ url: string; key: string; size: number }>;
  deleteByUrl(url: string): Promise<boolean>;
}
```

- [ ] **Step 4: Create the process module (moved from r2.ts)**

```ts
// src/lib/storage/process.ts
import sharp from "sharp";
import type { ProcessedUpload } from "./types";

/**
 * Bungkus buffer non-gambar (PDF, dokumen) tanpa pemrosesan sharp.
 * `ext` dikosongkan agar pemanggil tidak menambah ekstensi.
 */
export function asRawUpload(input: Buffer, contentType: string): ProcessedUpload {
  return { body: input, ext: "", contentType: contentType || "application/octet-stream" };
}

/**
 * Resize + kompres gambar. Gambar ber-alpha atau PNG/WebP -> WebP (q80) agar
 * transparansi utuh; GIF beranimasi -> WebP beranimasi; gambar opak lain ->
 * JPEG q80 maks lebar 1600px.
 */
export async function processImage(input: Buffer): Promise<ProcessedUpload> {
  const meta = await sharp(input).metadata();
  const isAnimated = (meta.pages ?? 1) > 1;
  const hasAlpha = meta.hasAlpha === true;
  const isPngOrWebp = meta.format === "png" || meta.format === "webp";

  if (isAnimated) {
    const body = await sharp(input, { animated: true }).webp().toBuffer();
    return { body, ext: "webp", contentType: "image/webp" };
  }
  if (hasAlpha || isPngOrWebp) {
    const body = await sharp(input)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { body, ext: "webp", contentType: "image/webp" };
  }
  const body = await sharp(input)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  return { body, ext: "jpg", contentType: "image/jpeg" };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test storage-process`
Expected: PASS (4 assertions across 3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/types.ts src/lib/storage/process.ts test/storage-process.test.ts
git commit -m "feat(storage): add StorageProvider types and shared image processing"
```

---

### Task 2: R2 provider implementing the interface

**Files:**
- Create: `src/lib/storage/r2.ts`
- Test: `test/storage-r2.test.ts`

**Interfaces:**
- Consumes: `ProcessedUpload`, `StorageProvider` from `./types`.
- Produces:
  - `function R2_BUCKET(): string`, `function R2_PUBLIC_URL(): string`, `function r2(): S3Client` (re-exported for back-compat)
  - `const r2Provider: StorageProvider` — `name: "r2"`. `put` writes to S3 and returns `{ url: \`${R2_PUBLIC_URL()}/${key}\`, key, size }` where `key = keyBase.ext` (or `keyBase` when `ext` is `""`). `deleteByUrl` strips `R2_PUBLIC_URL()` prefix to a key and issues `DeleteObjectCommand`; returns `false` for foreign/empty URLs.

- [ ] **Step 1: Write the failing test**

```ts
// test/storage-r2.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send })),
  PutObjectCommand: vi.fn((input) => ({ __type: "Put", input })),
  DeleteObjectCommand: vi.fn((input) => ({ __type: "Delete", input })),
}));

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({});
  process.env.R2_ENDPOINT = "https://acc.r2.cloudflarestorage.com";
  process.env.R2_ACCESS_KEY_ID = "ak";
  process.env.R2_SECRET_ACCESS_KEY = "sk";
  process.env.R2_BUCKET = "bucket";
  process.env.R2_PUBLIC_URL = "https://cdn.example.com";
});

describe("r2Provider.put", () => {
  it("builds key with extension and returns public url", async () => {
    const { r2Provider } = await import("../src/lib/storage/r2");
    const res = await r2Provider.put(
      { body: Buffer.from("x"), ext: "webp", contentType: "image/webp" },
      "uploads/abc",
    );
    expect(res.key).toBe("uploads/abc.webp");
    expect(res.url).toBe("https://cdn.example.com/uploads/abc.webp");
    expect(send).toHaveBeenCalledOnce();
  });

  it("omits extension when ext is empty", async () => {
    const { r2Provider } = await import("../src/lib/storage/r2");
    const res = await r2Provider.put(
      { body: Buffer.from("x"), ext: "", contentType: "application/pdf" },
      "uploads/doc",
    );
    expect(res.key).toBe("uploads/doc");
  });
});

describe("r2Provider.deleteByUrl", () => {
  it("deletes objects under the public url", async () => {
    const { r2Provider } = await import("../src/lib/storage/r2");
    const ok = await r2Provider.deleteByUrl("https://cdn.example.com/uploads/abc.webp");
    expect(ok).toBe(true);
    expect(send).toHaveBeenCalledOnce();
  });

  it("ignores foreign urls", async () => {
    const { r2Provider } = await import("../src/lib/storage/r2");
    const ok = await r2Provider.deleteByUrl("https://other.com/x.png");
    expect(ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test storage-r2`
Expected: FAIL — cannot resolve `../src/lib/storage/r2`.

- [ ] **Step 3: Create the R2 provider (port logic from old src/lib/r2.ts)**

```ts
// src/lib/storage/r2.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { ProcessedUpload, StorageProvider } from "./types";

let _r2: S3Client | null = null;

function getR2(): S3Client {
  if (_r2) return _r2;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint) throw new Error("admin-kit: R2_ENDPOINT env var is required");
  if (!accessKeyId || !secretAccessKey)
    throw new Error("admin-kit: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY env vars are required");
  _r2 = new S3Client({ region: "auto", endpoint, credentials: { accessKeyId, secretAccessKey } });
  return _r2;
}

export function R2_BUCKET(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("admin-kit: R2_BUCKET env var is required");
  return bucket;
}

export function R2_PUBLIC_URL(): string {
  return (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
}

export function r2(): S3Client {
  return getR2();
}

export const r2Provider: StorageProvider = {
  name: "r2",
  async put(p: ProcessedUpload, keyBase: string) {
    const base = keyBase.replace(/^\/+/, "");
    const key = p.ext ? `${base}.${p.ext}` : base;
    await getR2().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET(),
        Key: key,
        Body: p.body,
        ContentType: p.contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const publicUrl = R2_PUBLIC_URL();
    if (!publicUrl) throw new Error("R2_PUBLIC_URL belum di-set — tidak bisa menyusun URL publik.");
    return { url: `${publicUrl}/${key}`, key, size: p.body.length };
  },
  async deleteByUrl(url: string) {
    const publicUrl = R2_PUBLIC_URL();
    if (!publicUrl || !url.startsWith(`${publicUrl}/`)) return false;
    const key = url.slice(publicUrl.length + 1);
    if (!key) return false;
    await getR2().send(new DeleteObjectCommand({ Bucket: R2_BUCKET(), Key: key }));
    return true;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test storage-r2`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/r2.ts test/storage-r2.test.ts
git commit -m "feat(storage): add R2 provider implementing StorageProvider"
```

---

### Task 3: Provider selection + public API + back-compat shim

**Files:**
- Create: `src/lib/storage/index.ts`
- Rewrite: `src/lib/r2.ts` (becomes a re-export shim)
- Modify: `src/index.ts:5` (root export now points at storage)
- Modify: `src/screens/media/lib.ts:3` (import path)
- Test: `test/storage-select.test.ts`

**Interfaces:**
- Consumes: `processImage`, `asRawUpload` (Task 1); `r2Provider`, `R2_BUCKET`, `R2_PUBLIC_URL`, `r2` (Task 2); `StorageProvider` type (Task 1).
- Produces:
  - `function resolveProviderName(raw: string | undefined): "r2" | "uploadthing"` — pure; unset/`"r2"`→`"r2"`, `"uploadthing"`→`"uploadthing"`, else throws.
  - `function getActiveProvider(): Promise<StorageProvider>` — cached; loads the provider for the resolved name.
  - `async function uploadFile(input: Buffer, keyBase: string, opts?: { contentType?: string; skipProcessing?: boolean }): Promise<{ url: string; key: string; size: number }>`
  - `async function uploadImage(input: Buffer, keyBase: string): Promise<{ url: string; key: string; size: number }>`
  - `async function deleteObjectByUrl(url: string): Promise<boolean>`
  - Re-exports `R2_BUCKET`, `R2_PUBLIC_URL`, `r2` for back-compat.

- [ ] **Step 1: Write the failing test**

```ts
// test/storage-select.test.ts
import { describe, it, expect } from "vitest";
import { resolveProviderName } from "../src/lib/storage/index";

describe("resolveProviderName", () => {
  it("defaults to r2 when unset", () => {
    expect(resolveProviderName(undefined)).toBe("r2");
    expect(resolveProviderName("")).toBe("r2");
  });
  it("accepts r2 and uploadthing (case/space-insensitive)", () => {
    expect(resolveProviderName("r2")).toBe("r2");
    expect(resolveProviderName(" UploadThing ")).toBe("uploadthing");
  });
  it("throws on unknown provider", () => {
    expect(() => resolveProviderName("s3")).toThrow(/ADMIN_KIT_STORAGE_PROVIDER/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test storage-select`
Expected: FAIL — cannot resolve `../src/lib/storage/index`.

- [ ] **Step 3: Create the storage entrypoint**

```ts
// src/lib/storage/index.ts
import type { StorageProvider } from "./types";
import { processImage, asRawUpload } from "./process";
import { r2Provider, R2_BUCKET, R2_PUBLIC_URL, r2 } from "./r2";

export type { ProcessedUpload, StorageProvider } from "./types";
export { R2_BUCKET, R2_PUBLIC_URL, r2 };

/** Normalisasi nilai env menjadi nama provider yang valid. */
export function resolveProviderName(raw: string | undefined): "r2" | "uploadthing" {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "" || v === "r2") return "r2";
  if (v === "uploadthing") return "uploadthing";
  throw new Error(
    `admin-kit: ADMIN_KIT_STORAGE_PROVIDER tidak dikenal: "${raw}". Gunakan "r2" atau "uploadthing".`,
  );
}

let _provider: StorageProvider | null = null;

/** Resolusi + cache provider aktif berdasarkan env (lazy). */
export async function getActiveProvider(): Promise<StorageProvider> {
  if (_provider) return _provider;
  const name = resolveProviderName(process.env.ADMIN_KIT_STORAGE_PROVIDER);
  if (name === "uploadthing") {
    const { uploadThingProvider } = await import("./uploadthing");
    _provider = uploadThingProvider;
  } else {
    _provider = r2Provider;
  }
  return _provider;
}

/**
 * Unggah buffer sembarang. Gambar diproses sharp; non-gambar (skipProcessing)
 * dilewatkan apa adanya. Mengembalikan URL publik dari provider aktif.
 */
export async function uploadFile(
  input: Buffer,
  keyBase: string,
  opts?: { contentType?: string; skipProcessing?: boolean },
): Promise<{ url: string; key: string; size: number }> {
  const processed = opts?.skipProcessing
    ? asRawUpload(input, opts.contentType ?? "application/octet-stream")
    : await processImage(input);
  const provider = await getActiveProvider();
  return provider.put(processed, keyBase);
}

/** Resize + kompres gambar lalu unggah ke provider aktif. */
export async function uploadImage(
  input: Buffer,
  keyBase: string,
): Promise<{ url: string; key: string; size: number }> {
  return uploadFile(input, keyBase);
}

/** Hapus objek lewat URL publiknya pada provider aktif. */
export async function deleteObjectByUrl(url: string): Promise<boolean> {
  const provider = await getActiveProvider();
  return provider.deleteByUrl(url);
}
```

- [ ] **Step 4: Replace src/lib/r2.ts with a back-compat shim**

Overwrite the whole file:

```ts
// src/lib/r2.ts
// Shim kompatibilitas: API lama kini disuplai lewat lapisan storage.
export {
  uploadFile,
  uploadImage,
  deleteObjectByUrl,
  R2_BUCKET,
  R2_PUBLIC_URL,
  r2,
} from "./storage/index";
```

- [ ] **Step 5: Point the root export at the storage layer**

In `src/index.ts`, change line 5 from `export * from "./lib/r2";` to:

```ts
export * from "./lib/storage/index";
```

- [ ] **Step 6: Update the media delete import**

In `src/screens/media/lib.ts`, change line 3 from `import { deleteObjectByUrl } from "../../lib/r2";` to:

```ts
import { deleteObjectByUrl } from "../../lib/storage/index";
```

- [ ] **Step 7: Run tests + typecheck**

Run: `pnpm test storage-select && pnpm typecheck`
Expected: storage-select PASS (3 tests); typecheck exits 0. (`uploadthing.ts` is referenced only via dynamic `import()`, so typecheck of `getActiveProvider` does not require it yet — but Task 4 creates it; if typecheck complains about the missing module here, proceed to Task 4 then re-run. To keep this task green standalone, the dynamic import is inside an async branch and tsc tolerates a missing module specifier only if present — so create an empty stub now: see Step 8.)

- [ ] **Step 8: Add a minimal stub so typecheck passes standalone**

Create `src/lib/storage/uploadthing.ts` with a placeholder that Task 4 replaces:

```ts
// src/lib/storage/uploadthing.ts
import type { StorageProvider } from "./types";
// Implementasi penuh diisi di Task 4.
export const uploadThingProvider: StorageProvider = {
  name: "uploadthing",
  async put() {
    throw new Error("admin-kit: UploadThing provider belum diimplementasikan");
  },
  async deleteByUrl() {
    return false;
  },
};
```

Re-run: `pnpm typecheck` → exits 0.

- [ ] **Step 9: Commit**

```bash
git add src/lib/storage/index.ts src/lib/storage/uploadthing.ts src/lib/r2.ts src/index.ts src/screens/media/lib.ts test/storage-select.test.ts
git commit -m "feat(storage): env-based provider selection + delegating public API"
```

---

### Task 4: UploadThing provider (UTApi, lazy import)

**Files:**
- Rewrite: `src/lib/storage/uploadthing.ts` (replaces the Task 3 stub)
- Test: `test/storage-uploadthing.test.ts`

**Interfaces:**
- Consumes: `ProcessedUpload`, `StorageProvider` from `./types`.
- Produces: `const uploadThingProvider: StorageProvider` — `name: "uploadthing"`. `put` lazy-imports `uploadthing/server`, wraps the processed buffer in a `File`, calls `utapi.uploadFiles(file)`, returns `{ url: data.ufsUrl, key: data.key, size: p.body.length }`. `deleteByUrl` extracts the file key from a UploadThing URL (`.../f/<key>` on `ufs.sh`/`utfs.io`) and calls `utapi.deleteFiles([key])`; returns `false` for non-UploadThing URLs.

> **Implementer check:** confirm `UTApi.uploadFiles` / `deleteFiles` names and that the upload result exposes `ufsUrl` + `key` in the `uploadthing` version that resolves. If the field is `data.url` instead of `data.ufsUrl` in that version, adjust the mapping and the test together.

- [ ] **Step 1: Write the failing test**

```ts
// test/storage-uploadthing.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const uploadFiles = vi.fn();
const deleteFiles = vi.fn();
vi.mock("uploadthing/server", () => ({
  UTApi: vi.fn(() => ({ uploadFiles, deleteFiles })),
}));

beforeEach(() => {
  uploadFiles.mockReset();
  deleteFiles.mockReset();
});

describe("uploadThingProvider.put", () => {
  it("uploads the buffer and maps ufsUrl + key", async () => {
    uploadFiles.mockResolvedValue({ data: { key: "abc123", ufsUrl: "https://app.ufs.sh/f/abc123" }, error: null });
    const { uploadThingProvider } = await import("../src/lib/storage/uploadthing");
    const res = await uploadThingProvider.put(
      { body: Buffer.from("imgbytes"), ext: "webp", contentType: "image/webp" },
      "uploads/xyz",
    );
    expect(res).toEqual({ url: "https://app.ufs.sh/f/abc123", key: "abc123", size: 8 });
    expect(uploadFiles).toHaveBeenCalledOnce();
  });

  it("throws when UTApi returns an error", async () => {
    uploadFiles.mockResolvedValue({ data: null, error: { message: "nope" } });
    const { uploadThingProvider } = await import("../src/lib/storage/uploadthing");
    await expect(
      uploadThingProvider.put({ body: Buffer.from("x"), ext: "jpg", contentType: "image/jpeg" }, "uploads/a"),
    ).rejects.toThrow(/admin-kit/);
  });
});

describe("uploadThingProvider.deleteByUrl", () => {
  it("extracts the key and deletes", async () => {
    deleteFiles.mockResolvedValue({ success: true });
    const { uploadThingProvider } = await import("../src/lib/storage/uploadthing");
    const ok = await uploadThingProvider.deleteByUrl("https://app.ufs.sh/f/abc123");
    expect(ok).toBe(true);
    expect(deleteFiles).toHaveBeenCalledWith(["abc123"]);
  });

  it("ignores non-uploadthing urls", async () => {
    const { uploadThingProvider } = await import("../src/lib/storage/uploadthing");
    const ok = await uploadThingProvider.deleteByUrl("https://cdn.example.com/uploads/abc.webp");
    expect(ok).toBe(false);
    expect(deleteFiles).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test storage-uploadthing`
Expected: FAIL — stub `put` throws "belum diimplementasikan" / mapping assertions fail.

- [ ] **Step 3: Implement the provider**

Overwrite `src/lib/storage/uploadthing.ts`:

```ts
// src/lib/storage/uploadthing.ts
import type { ProcessedUpload, StorageProvider } from "./types";

// Import dinamis: konsumen R2-only tidak perlu memasang paket `uploadthing`.
async function getUTApi() {
  let mod: typeof import("uploadthing/server");
  try {
    mod = await import("uploadthing/server");
  } catch {
    throw new Error("admin-kit: pasang paket `uploadthing` untuk memakai storage provider UploadThing");
  }
  // UTApi membaca UPLOADTHING_TOKEN dari env secara otomatis.
  return new mod.UTApi();
}

// Ambil file key dari URL UploadThing (.../f/<key>) pada host ufs.sh / utfs.io.
function keyFromUrl(url: string): string | null {
  let host: string;
  let path: string;
  try {
    const u = new URL(url);
    host = u.hostname;
    path = u.pathname;
  } catch {
    return null;
  }
  if (!host.endsWith("ufs.sh") && host !== "utfs.io") return null;
  const m = path.match(/^\/f\/([^/?#]+)/);
  return m ? m[1] : null;
}

export const uploadThingProvider: StorageProvider = {
  name: "uploadthing",
  async put(p: ProcessedUpload, keyBase: string) {
    const utapi = await getUTApi();
    const base = keyBase.split("/").pop() || "upload";
    const fileName = p.ext ? `${base}.${p.ext}` : base;
    const file = new File([new Uint8Array(p.body)], fileName, { type: p.contentType });
    const res = await utapi.uploadFiles(file);
    if (!res?.data || res.error) {
      throw new Error(`admin-kit: unggah ke UploadThing gagal${res?.error ? `: ${res.error.message}` : ""}`);
    }
    return { url: res.data.ufsUrl, key: res.data.key, size: p.body.length };
  },
  async deleteByUrl(url: string) {
    const key = keyFromUrl(url);
    if (!key) return false;
    const utapi = await getUTApi();
    await utapi.deleteFiles([key]);
    return true;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test storage-uploadthing`
Expected: PASS (4 tests).

- [ ] **Step 5: Run full suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all tests PASS; typecheck exits 0.

> If typecheck fails on `import("uploadthing/server")` because the optional peer isn't installed in this repo's dev env, install it as a devDependency for types only: `pnpm add -D uploadthing` (it stays an optional *peer* for consumers — see Task 5). Re-run.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/uploadthing.ts test/storage-uploadthing.test.ts package.json pnpm-lock.yaml
git commit -m "feat(storage): add UploadThing provider via UTApi"
```

---

### Task 5: Wire dependency, docs, and changelog

**Files:**
- Modify: `package.json` (peerDependencies + peerDependenciesMeta)
- Modify: `CHANGELOG.md`
- Modify: `README.md` (storage/env section — locate the existing R2 env docs)

**Interfaces:**
- Consumes: the full feature (Tasks 1–4).
- Produces: published metadata + docs. No code symbols.

- [ ] **Step 1: Add uploadthing as an optional peer dependency**

In `package.json`, add a `peerDependencies` entry and a `peerDependenciesMeta` block marking it optional (keep existing peers intact):

```json
"peerDependencies": {
  "next": "^16.2.0",
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "tailwindcss": "^4",
  "uploadthing": "^7.0.0"
},
"peerDependenciesMeta": {
  "uploadthing": { "optional": true }
}
```

> Confirm the major version: set the range to whatever major resolved during Task 4 (`pnpm why uploadthing` or check `node_modules/uploadthing/package.json`). Adjust `^7.0.0` to match.

- [ ] **Step 2: Document the env vars**

In `README.md`, in the environment-variables section near the R2 vars, add:

```markdown
### Storage provider (optional)

`@blawness/admin-kit` defaults to Cloudflare R2. To use UploadThing instead:

| Var | Purpose |
|---|---|
| `ADMIN_KIT_STORAGE_PROVIDER` | `r2` (default) or `uploadthing`. |
| `UPLOADTHING_TOKEN` | UploadThing app token; required when the provider is `uploadthing`. |

When using UploadThing, install the SDK (`pnpm add uploadthing`) and add the
UploadThing host to `next.config` images:

\`\`\`js
images: { remotePatterns: [{ protocol: "https", hostname: "*.ufs.sh" }] }
\`\`\`

The public helpers (`uploadFile`, `uploadImage`, `deleteObjectByUrl`) and all
built-in screens work unchanged against either backend.
```

- [ ] **Step 3: Update the changelog**

In `CHANGELOG.md`, add an Unreleased entry:

```markdown
## [Unreleased]

### Added
- Pluggable storage providers. Cloudflare R2 remains the default; set
  `ADMIN_KIT_STORAGE_PROVIDER=uploadthing` (with `UPLOADTHING_TOKEN` and the
  optional `uploadthing` peer installed) to upload via UploadThing instead.
  The `uploadFile` / `uploadImage` / `deleteObjectByUrl` API is unchanged.
```

- [ ] **Step 4: Final verification**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add package.json CHANGELOG.md README.md
git commit -m "docs(storage): document UploadThing provider + mark uploadthing optional peer"
```

---

## Self-Review Notes

- **Spec coverage:** abstraction (T1 types), shared sharp (T1 process), R2 provider (T2), env selection + delegating public API + back-compat exports (T3), UploadThing UTApi provider with lazy import + key extraction + error mapping (T4), optional peer dep + docs + changelog + `remotePatterns` note (T5). All spec sections mapped.
- **Error handling coverage:** unknown env value (T3 test), missing `uploadthing` package (T4 catch), UTApi `{ error }` → throw (T4 test), foreign-URL delete → false (T2 + T4 tests).
- **Type consistency:** `StorageProvider.put(p, keyBase)` and `ProcessedUpload { body, ext, contentType }` used identically across T2/T3/T4. Return shape `{ url, key, size }` consistent. `resolveProviderName` / `getActiveProvider` names match between T3 definition and T3 usage.
- **Back-compat:** `src/lib/r2.ts` shim + root `export *` keep `uploadFile`/`uploadImage`/`deleteObjectByUrl`/`r2`/`R2_BUCKET`/`R2_PUBLIC_URL` exported; consumers and the media delete path updated to the new module without signature changes.
