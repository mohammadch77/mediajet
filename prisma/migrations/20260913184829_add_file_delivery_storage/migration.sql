-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSizeBytes" INTEGER,
ADD COLUMN     "isLarge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "fileUrl" DROP NOT NULL;
