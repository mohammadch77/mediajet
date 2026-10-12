ALTER TABLE "BlogPost" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "BlogPost_published_views_idx" ON "BlogPost"("published", "views");
