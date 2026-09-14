"use client";
// ویرایشگر متن غنی برای صفحات متن‌آزاد. Tiptap: کتابخانه‌ای سبک، بدون قفل به یک UI خاص،
// و مبتنی بر ProseMirror (پایدار و پراستفاده) — امکانات پایه (عنوان، پاراگراف، بولد/ایتالیک،
// لیست، لینک) را دقیقاً همان‌طور که لازم داریم فراهم می‌کند بدون overhead ویرایشگرهای سنگین‌تر.
//
// نکته‌ی امنیتی: خروجی این ویرایشگر (editor.getHTML()) یک HTML خام است و پیش از رندر در
// سایت عمومی، هم موقع ذخیره در سرور (lib/pages.ts) و هم موقع رندر (app/p/[slug]) با
// lib/sanitize.ts پاک‌سازی می‌شود؛ خود ویرایشگر sanitize انجام نمی‌دهد.

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

function ToolbarButton({
  onClick,
  active,
  children,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        "px-2.5 py-1.5 rounded-lg text-[.8rem] font-bold transition " +
        (active
          ? "bg-gradient-to-br from-primary to-primary2 text-white"
          : "bg-[rgba(0,0,0,.25)] text-dim hover:text-text")
      }
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose-page min-h-[240px] px-4 py-3 focus:outline-none",
        dir: "rtl",
      },
    },
  });

  if (!editor) {
    return <div className="text-dim text-[.85rem] px-4 py-3">در حال بارگذاری ویرایشگر…</div>;
  }

  function setLink() {
    const prev = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("آدرس لینک را وارد کنید:", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor!.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="border border-[rgba(138,124,255,.2)] rounded-xl overflow-hidden bg-[rgba(0,0,0,.25)]">
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-[rgba(138,124,255,.14)]">
        <ToolbarButton label="تیتر ۱" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          H1
        </ToolbarButton>
        <ToolbarButton label="تیتر ۲" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </ToolbarButton>
        <ToolbarButton label="پاراگراف" active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()}>
          پاراگراف
        </ToolbarButton>
        <ToolbarButton label="بولد" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </ToolbarButton>
        <ToolbarButton label="ایتالیک" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </ToolbarButton>
        <ToolbarButton label="لیست نشانه‌دار" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •‎ لیست
        </ToolbarButton>
        <ToolbarButton label="لیست شماره‌دار" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          ۱. لیست
        </ToolbarButton>
        <ToolbarButton label="لینک" active={editor.isActive("link")} onClick={setLink}>
          لینک
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
