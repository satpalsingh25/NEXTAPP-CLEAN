/*
  Warnings:

  - You are about to drop the column `default_reminder_days` on the `ComplianceTemplate` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[compliance_id,level]` on the table `ComplianceApprovalLevel` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Compliance" ADD COLUMN     "name" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ComplianceTemplate" DROP COLUMN "default_reminder_days";

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceApprovalLevel_compliance_id_level_key" ON "ComplianceApprovalLevel"("compliance_id", "level");
