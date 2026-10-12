// فهرست مقاله‌های اولیه‌ی وبلاگ (ترتیب = ترتیب پیشنهادی انتشار). منبع واحد برای scripts/seed-blog.ts.
import type { BlogSeed } from "./blog/types";
import { article as a1 } from "./blog/buy-single-stock-file";
import { article as a2 } from "./blog/how-to-choose-stock-site";
import { article as a3 } from "./blog/vector-psd-png-formats-guide";
import { article as a4 } from "./blog/stock-license-basics-commercial-use";
import { article as a5 } from "./blog/stock-video-music-for-youtubers";
import { article as a6 } from "./blog/mockup-psd-templates-speed-up-design";

export const BLOG_SEEDS: BlogSeed[] = [a1, a2, a3, a4, a5, a6];
