"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Button } from "../ui/button";

export function Editor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Link.configure({ openOnClick: false }),
      Image,
    ],
    content: value,
    immediatelyRender: false,
    editorProps: { attributes: { class: "prose prose-blue max-w-none min-h-[300px] focus:outline-none" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className="rounded-md border border-navy-200">
      <div className="flex flex-wrap gap-1 border-b border-navy-100 p-2">
        <ToolbarButton on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>B</ToolbarButton>
        <ToolbarButton on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>I</ToolbarButton>
        <ToolbarButton on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>H2</ToolbarButton>
        <ToolbarButton on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>H3</ToolbarButton>
        <ToolbarButton on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>• List</ToolbarButton>
        <ToolbarButton on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>1. List</ToolbarButton>
        <ToolbarButton on={() => { const url = prompt("URL tautan:"); if (url) editor.chain().focus().setLink({ href: url }).run(); }} active={editor.isActive("link")}>Link</ToolbarButton>
        <ToolbarButton on={() => { const url = prompt("URL gambar:"); if (url) editor.chain().focus().setImage({ src: url }).run(); }} active={false}>Gambar</ToolbarButton>
      </div>
      <EditorContent editor={editor} className="p-3" />
    </div>
  );
}

function ToolbarButton({ on, active, children }: { on: () => void; active: boolean; children: React.ReactNode }) {
  return (
    <Button type="button" variant={active ? "default" : "outline"} size="sm" onClick={on}>
      {children}
    </Button>
  );
}
