-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "isOnDisk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastAccessedAt" TIMESTAMP(3),
ADD COLUMN     "telegramFileId" TEXT;
