-- دسته‌ی موضوعی و برچسب‌های نوشته‌های وبلاگ.
ALTER TABLE "BlogPost"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "BlogPost_category_published_publishedAt_idx" ON "BlogPost"("category", "published", "publishedAt");
