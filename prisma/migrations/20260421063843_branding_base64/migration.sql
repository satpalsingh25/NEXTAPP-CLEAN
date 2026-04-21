/*
  Warnings:

  - You are about to drop the column `logo_url` on the `Branding` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Branding" DROP COLUMN "logo_url",
ADD COLUMN     "logo_base64" TEXT;
