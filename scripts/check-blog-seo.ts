// چک‌لیست سئوی مقاله‌های seed را چاپ می‌کند (بدون نیاز به دیتابیس). اجرا: npx tsx scripts/check-blog-seo.ts
import { BLOG_SEEDS } from "../data/blogSeed";
import { seoChecks, seoScore } from "../lib/seoCheck";

let bad = 0;
for (const a of BLOG_SEEDS) {
  const checks = seoChecks({ ...a, contentHtml: a.contentHtml });
  const sc = seoScore(checks);
  console.log(`\n${a.slug}  [${a.focusKeyword}]  ${sc.passed}/${sc.total}`);
  for (const c of checks.filter((x) => !x.ok)) console.log(`  ✗ ${c.label} — ${c.hint ?? ""}`);
  bad += sc.total - sc.passed;
}
process.exitCode = bad ? 1 : 0;
