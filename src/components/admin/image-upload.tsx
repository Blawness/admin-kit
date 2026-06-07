"use client";

import { useRef, useState, useTransition } from "react";
import { UploadCloud, Loader2, AlertCircle } from "lucide-react";
import { OK_IMAGE_TYPES, MAX_IMAGE_BYTES } from "../../lib/upload-constants";

/**
 * Clear drag-and-drop / click-to-upload zone backed by the R2 upload action.
 * Used for both a post's featured image (with `value`) and the gallery (no
 * value, parent refreshes on change).
 */
export function ImageUpload({
  value,
  onChange,
  label = "gambar",
  uploadAction,
}: {
  value?: string | null;
  onChange: (url: string) => void;
  label?: string;
  uploadAction: (formData: FormData) => Promise<{ url?: string; error?: string }>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(file: File | undefined) {
    if (!file) return;
    if (!OK_IMAGE_TYPES.includes(file.type)) {
      setError("Format tidak didukung — gunakan JPG, PNG, WebP, atau GIF.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Ukuran gambar maksimal 8MB.");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    setError(undefined);
    start(async () => {
      const res = await uploadAction(fd);
      if (res.error) setError(res.error);
      else if (res.url) onChange(res.url);
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files?.[0]);
        }}
        disabled={pending}
        className={`group relative flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragging
            ? "border-brand-500 bg-brand-50"
            : "border-navy-200 bg-navy-50/40 hover:border-brand-400 hover:bg-brand-50/60"
        } ${pending ? "pointer-events-none opacity-80" : "cursor-pointer"}`}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- preview from R2 */}
            <img
              src={value}
              alt=""
              className="h-28 w-28 rounded-lg object-cover object-top ring-1 ring-navy-200 shadow-sm"
            />
            <span className="text-sm font-medium text-navy-700">
              Klik untuk mengganti {label}
            </span>
            {pending && (
              <span className="absolute inset-0 grid place-items-center rounded-xl bg-white/70">
                <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
              </span>
            )}
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600 transition-transform group-hover:scale-105">
              {pending ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <UploadCloud className="h-6 w-6" />
              )}
            </span>
            <span>
              <span className="block text-sm font-semibold text-navy-900">
                {pending ? "Mengunggah…" : `Klik untuk unggah ${label}`}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                atau seret &amp; lepas di sini · JPG, PNG, WebP, GIF (maks 8MB)
              </span>
            </span>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
        disabled={pending}
      />

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
