"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Button } from "../ui/button";

type PromptKind = "link" | "image" | null;

// Validasi URL minimal: harus http(s), atau (untuk tautan) mailto,
// atau path relatif dari root ("/...").
function isValidUrl(url: string, kind: "link" | "image"): boolean {
  if (/^https?:\/\//i.test(url)) return true;
  if (url.startsWith("/")) return true;
  if (kind === "link" && /^mailto:/i.test(url)) return true;
  return false;
}

export function Editor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const [prompt, setPrompt] = useState<PromptKind>(null);
  const [urlValue, setUrlValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  const editor = useEditor({
    extensions: [
      // StarterKit v3 bundles Link; disable it here so the explicit
      // Link.configure below doesn't register a duplicate "link" extension.
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
      Link.configure({ openOnClick: false }),
      Image,
    ],
    content: value,
    immediatelyRender: false,
    editorProps: { attributes: { class: "prose prose-blue max-w-none min-h-[300px] focus:outline-none" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  function openPrompt(kind: "link" | "image") {
    setInvalid(false);
    setUrlValue("");
    setPrompt(kind);
  }

  function closePrompt() {
    setPrompt(null);
    setInvalid(false);
    setUrlValue("");
  }

  function confirmPrompt() {
    if (!editor || !prompt) return;
    const url = urlValue.trim();
    const kind: "link" | "image" = prompt === "image" ? "image" : "link";
    if (!isValidUrl(url, kind)) {
      setInvalid(true);
      return;
    }
    if (kind === "image") editor.chain().focus().setImage({ src: url }).run();
    else editor.chain().focus().setLink({ href: url }).run();
    closePrompt();
  }

  return (
    <div className="rounded-md border border-navy-200">
      <div className="flex flex-wrap gap-1 border-b border-navy-100 p-2">
        <ToolbarButton label="Bold" on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>B</ToolbarButton>
        <ToolbarButton label="Italic" on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>I</ToolbarButton>
        <ToolbarButton label="Heading 2" on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>H2</ToolbarButton>
        <ToolbarButton label="Heading 3" on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>H3</ToolbarButton>
        <ToolbarButton label="Bullet list" on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>• List</ToolbarButton>
        <ToolbarButton label="Numbered list" on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>1. List</ToolbarButton>
        <ToolbarButton label="Link" on={() => openPrompt("link")} active={editor.isActive("link")}>Link</ToolbarButton>
        <ToolbarButton label="Image" on={() => openPrompt("image")} active={false}>Gambar</ToolbarButton>
      </div>

      {prompt && (
        <div className="flex flex-wrap items-center gap-2 border-b border-navy-100 bg-navy-50/40 p-2">
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- focus revealed input for quick entry
            autoFocus
            type="text"
            value={urlValue}
            placeholder={prompt === "image" ? "URL gambar (https://…)" : "URL tautan (https://…)"}
            aria-label={prompt === "image" ? "URL gambar" : "URL tautan"}
            aria-invalid={invalid}
            onChange={(e) => {
              setUrlValue(e.target.value);
              if (invalid) setInvalid(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmPrompt();
              } else if (e.key === "Escape") {
                e.preventDefault();
                closePrompt();
              }
            }}
            onBlur={closePrompt}
            className={`flex-1 min-w-[12rem] rounded-md border bg-white px-2 py-1 text-sm text-navy-900 outline-none focus:ring-2 ${
              invalid ? "border-red-400 focus:ring-red-200" : "border-navy-200 focus:ring-brand-200"
            }`}
          />
          <Button
            type="button"
            size="sm"
            variant="default"
            // onMouseDown so the click registers before the input's onBlur fires.
            onMouseDown={(e) => {
              e.preventDefault();
              confirmPrompt();
            }}
          >
            {prompt === "image" ? "Sisipkan" : "Terapkan"}
          </Button>
          {invalid && (
            <span className="text-xs text-red-600">URL tidak valid.</span>
          )}
        </div>
      )}

      <EditorContent editor={editor} className="p-3" />
    </div>
  );
}

function ToolbarButton({ on, active, children, label }: { on: () => void; active: boolean; children: React.ReactNode; label?: string }) {
  return (
    <Button type="button" variant={active ? "default" : "outline"} size="sm" onClick={on} aria-label={label}>
      {children}
    </Button>
  );
}
