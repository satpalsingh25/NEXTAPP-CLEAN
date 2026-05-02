/*
  Warnings:

  - Changed the type of `module` on the `ApprovalLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `module` on the `ApprovalMatrix` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `module` on the `AuditLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `module` on the `Document` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `module` on the `StatusMaster` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ModuleType" AS ENUM ('COMPLIANCE', 'AMC', 'TICKET');

-- AlterTable
ALTER TABLE "ApprovalLog" DROP COLUMN "module",
ADD COLUMN     "module" "ModuleType" NOT NULL;

-- AlterTable
ALTER TABLE "ApprovalMatrix" DROP COLUMN "module",
ADD COLUMN     "module" "ModuleType" NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "module",
ADD COLUMN     "module" "ModuleType" NOT NULL;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "company_folder_name" TEXT;

-- AlterTable
ALTER TABLE "DmsDocument" ADD COLUMN     "drive_id" TEXT,
ADD COLUMN     "sharepoint_item_id" TEXT;

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "module",
ADD COLUMN     "module" "ModuleType" NOT NULL;

-- AlterTable
ALTER TABLE "StatusMaster" DROP COLUMN "module",
ADD COLUMN     "module" "ModuleType" NOT NULL;

-- DropEnum
DROP TYPE "Module";

-- CreateTable
CREATE TABLE "DmsActivityLog" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmsActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyModule" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CompanyModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DmsActivityLog_company_id_created_at_idx" ON "DmsActivityLog"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "DmsActivityLog_entity_id_idx" ON "DmsActivityLog"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "Module_name_key" ON "Module"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyModule_company_id_module_id_key" ON "CompanyModule"("company_id", "module_id");

-- AddForeignKey
ALTER TABLE "CompanyModule" ADD CONSTRAINT "CompanyModule_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyModule" ADD CONSTRAINT "CompanyModule_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
