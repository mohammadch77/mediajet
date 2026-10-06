"use client";
// ویرایشگر کد (CodeMirror 6) با رنگ‌بندی بر اساس پسوند. جدا شده تا فقط روی صفحه‌ی IDE بارگذاری شود.

import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { markdown } from "@codemirror/lang-markdown";
import { sql } from "@codemirror/lang-sql";
import type { Extension } from "@codemirror/state";

function languageFor(path: string): Extension[] {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
      return [javascript({ typescript: true, jsx: ext === "tsx" })];
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return [javascript({ jsx: true })];
    case "json":
      return [json()];
    case "css":
      return [css()];
    case "html":
      return [html()];
    case "md":
    case "mdx":
      return [markdown()];
    case "sql":
      return [sql()];
    default:
      return [];
  }
}

export default function IdeCodeEditor({
  path,
  value,
  onChange,
  onSave,
}: {
  path: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  // Ctrl/Cmd+S ذخیره می‌کند و جلوی «ذخیره‌ی صفحه‌ی» مرورگر را می‌گیرد.
  const saveKeymap = Prec.highest(
    keymap.of([
      {
        key: "Mod-s",
        preventDefault: true,
        run: () => {
          onSave();
          return true;
        },
      },
    ]),
  );

  return (
    <CodeMirror
      value={value}
      theme={oneDark}
      height="100%"
      style={{ height: "100%", fontSize: 13 }}
      extensions={[...languageFor(path), EditorView.lineWrapping, saveKeymap]}
      onChange={onChange}
      basicSetup={{ foldGutter: true, highlightActiveLine: true, autocompletion: false }}
    />
  );
}
