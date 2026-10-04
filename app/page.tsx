import { getAllContent } from "@/lib/content";
import HomeClient from "@/components/HomeClient";
import { getProgramInfo } from "@/lib/affiliateSummary";

// صفحه‌ی اصلی سرور-ساید محتوا را می‌خواند تا اگر ادمین متنی را عوض کرد، بدون نیاز
// به کلاینت در HTML اولیه (سئو/رندر سمت سرور) دیده شود؛ رفتار تعاملی در HomeClient است.
// revalidate=0 → هر بار از DB می‌خونه، تغییرات ادمین فوری اعمال می‌شوند.
export const revalidate = 0;

export default async function Home() {
  const [content, affiliate] = await Promise.all([getAllContent(), getProgramInfo()]);
  return <HomeClient content={content} affiliate={affiliate} />;
}
