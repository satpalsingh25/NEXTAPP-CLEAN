-- AlterTable
ALTER TABLE "ComplianceTemplate" ADD COLUMN     "approval_levels" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ComplianceApprovalMatrix" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "approver_id" UUID NOT NULL,
    "company_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceApprovalMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AMCTemplate" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "approval_levels" INTEGER NOT NULL DEFAULT 1,
    "company_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AMCTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AMCApprovalMatrix" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "approver_id" UUID NOT NULL,
    "company_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AMCApprovalMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_functions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_functions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleMaster" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleMaster_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ComplianceApprovalMatrix" ADD CONSTRAINT "ComplianceApprovalMatrix_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "ComplianceTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMCApprovalMatrix" ADD CONSTRAINT "AMCApprovalMatrix_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "AMCTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_functions" ADD CONSTRAINT "business_functions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Country" ADD CONSTRAINT "Country_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMaster" ADD CONSTRAINT "RoleMaster_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
