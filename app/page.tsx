import { getAllContent } from "@/lib/content";
import HomeClient from "@/components/HomeClient";
import { getProgramInfo } from "@/lib/affiliateSummary";

// صفحه‌ی اصلی سرور-ساید محتوا را می‌خواند تا اگر ادمین متنی را عوض کرد، بدون نیاز
// به کلاینت در HTML اولیه (سئو/رندر سمت سرور) دیده شود؛ رفتار تعاملی در HomeClient است.
export default async function Home() {
  const [content, affiliate] = await Promise.all([getAllContent(), getProgramInfo()]);
  return <HomeClient content={content} affiliate={affiliate} />;
}
