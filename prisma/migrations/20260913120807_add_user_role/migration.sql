-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'operator');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'user';
