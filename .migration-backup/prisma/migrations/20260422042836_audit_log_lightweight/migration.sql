/*
  Warnings:

  - The primary key for the `AuditLog` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `action_type` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `ip_address` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `new_value` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `old_value` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `record_id` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `AuditLog` table. All the data in the column will be lost.
  - Added the required column `action` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `module` on the `AuditLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_company_id_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_user_id_fkey";

-- AlterTable
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_pkey",
DROP COLUMN "action_type",
DROP COLUMN "ip_address",
DROP COLUMN "new_value",
DROP COLUMN "old_value",
DROP COLUMN "record_id",
DROP COLUMN "timestamp",
ADD COLUMN     "action" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "entity_id" TEXT,
ADD COLUMN     "entity_type" TEXT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "company_id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" DROP NOT NULL,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
DROP COLUMN "module",
ADD COLUMN     "module" TEXT NOT NULL,
ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id");
