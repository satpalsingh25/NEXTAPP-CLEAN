/*
  Warnings:

  - You are about to drop the column `permission` on the `FolderPermission` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FolderPermission" DROP COLUMN "permission",
ADD COLUMN     "can_delete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_read" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_upload" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_write" BOOLEAN NOT NULL DEFAULT false;
