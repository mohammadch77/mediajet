/** داده‌ی ساختاریافته‌ی schema.org برای موتورهای جست‌وجو. `<` را escape می‌کنیم تا محتوا هرگز تگ را نبندد. */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
