import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublishedPageBySlug } from "@/lib/pages";
import { sanitizeHtml } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const page = await getPublishedPageBySlug(params.slug);
  if (!page) {
    return {};
  }
  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || undefined,
  };
}

export default async function PublicPage({ params }: { params: { slug: string } }) {
  const page = await getPublishedPageBySlug(params.slug);
  if (!page) {
    notFound();
  }

  // دفاع دو لایه: با اینکه محتوا موقع ذخیره sanitize شده، دوباره همین‌جا هم پاک‌سازی می‌شود.
  const safeHtml = sanitizeHtml(page.contentHtml);

  return (
    <div dir="rtl" className="min-h-screen bg-bg text-text font-body">
      <div className="max-w-[760px] mx-auto px-[5vw] py-14">
        <Link href="/" className="latin text-[.75rem] tracking-[.14em] uppercase text-cyan font-bold">
          ← گت‌استوک
        </Link>
        <h1 className="font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold mt-4 mb-8">{page.title}</h1>
        <div className="prose-page" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      </div>
    </div>
  );
}
