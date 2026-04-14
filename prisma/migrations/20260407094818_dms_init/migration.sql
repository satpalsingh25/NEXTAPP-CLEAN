/*
  Warnings:

  - Added the required column `updated_at` to the `AMC` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EmailTemplateType" AS ENUM ('REMINDER', 'APPROVAL', 'OVERDUE');

-- AlterTable
ALTER TABLE "AMC" ADD COLUMN     "assigned_user_id" UUID,
ADD COLUMN     "department_id" UUID,
ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "due_day" INTEGER,
ADD COLUMN     "escalation_days" INTEGER,
ADD COLUMN     "function_id" UUID,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "period_month" INTEGER,
ADD COLUMN     "period_year" INTEGER,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "reminder_days" INTEGER,
ADD COLUMN     "submitted_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Compliance" ADD COLUMN     "escalation_days" INTEGER,
ADD COLUMN     "is_recurring_master" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_id" UUID,
ADD COLUMN     "period_month" INTEGER,
ADD COLUMN     "period_year" INTEGER;

-- AlterTable
ALTER TABLE "ComplianceTemplate" ADD COLUMN     "due_day" INTEGER,
ADD COLUMN     "reminder_days" INTEGER,
ADD COLUMN     "start_date" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AMCApprovalLevel" (
    "id" UUID NOT NULL,
    "amc_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "approver_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "acted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AMCApprovalLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmtpConfig" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "from_email" TEXT NOT NULL,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmtpConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "record_id" UUID,
    "record_module" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "type" "EmailTemplateType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharePointConfig" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "site_url" TEXT NOT NULL,
    "document_library" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharePointConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmsSettings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "max_file_size_mb" INTEGER NOT NULL DEFAULT 10,
    "max_files_per_upload" INTEGER NOT NULL DEFAULT 20,
    "allow_user_folder_creation" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmsFolder" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmsFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolderPermission" (
    "id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "access_type" TEXT NOT NULL,
    "access_id" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolderPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmsDocument" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "folder_path" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmsDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AMCApprovalLevel_amc_id_level_key" ON "AMCApprovalLevel"("amc_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "SmtpConfig_company_id_key" ON "SmtpConfig"("company_id");

-- CreateIndex
CREATE INDEX "Notification_user_id_idx" ON "Notification"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_company_id_type_key" ON "EmailTemplate"("company_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SharePointConfig_company_id_key" ON "SharePointConfig"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "DmsSettings_company_id_key" ON "DmsSettings"("company_id");

-- AddForeignKey
ALTER TABLE "AMC" ADD CONSTRAINT "AMC_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMC" ADD CONSTRAINT "AMC_function_id_fkey" FOREIGN KEY ("function_id") REFERENCES "business_functions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMC" ADD CONSTRAINT "AMC_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMCApprovalLevel" ADD CONSTRAINT "AMCApprovalLevel_amc_id_fkey" FOREIGN KEY ("amc_id") REFERENCES "AMC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMCApprovalLevel" ADD CONSTRAINT "AMCApprovalLevel_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmtpConfig" ADD CONSTRAINT "SmtpConfig_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
