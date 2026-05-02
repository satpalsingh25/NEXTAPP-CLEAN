/*
  Warnings:

  - You are about to drop the column `company_id` on the `Country` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Country" DROP CONSTRAINT "Country_company_id_fkey";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "country_id" UUID;

-- AlterTable
ALTER TABLE "Compliance" ADD COLUMN     "assigned_user_id" UUID,
ADD COLUMN     "department_id" UUID,
ADD COLUMN     "due_day" INTEGER,
ADD COLUMN     "function_id" UUID,
ADD COLUMN     "reminder_days" INTEGER,
ADD COLUMN     "start_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Country" DROP COLUMN "company_id";

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "department_id" UUID,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "function_id" UUID,
ADD COLUMN     "owner_id" UUID;

-- AlterTable
ALTER TABLE "business_functions" ADD COLUMN     "department_id" UUID;

-- CreateTable
CREATE TABLE "ComplianceApprovalLevel" (
    "id" UUID NOT NULL,
    "compliance_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "approver_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "acted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceApprovalLevel_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compliance" ADD CONSTRAINT "Compliance_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compliance" ADD CONSTRAINT "Compliance_function_id_fkey" FOREIGN KEY ("function_id") REFERENCES "business_functions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compliance" ADD CONSTRAINT "Compliance_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_functions" ADD CONSTRAINT "business_functions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_function_id_fkey" FOREIGN KEY ("function_id") REFERENCES "business_functions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceApprovalLevel" ADD CONSTRAINT "ComplianceApprovalLevel_compliance_id_fkey" FOREIGN KEY ("compliance_id") REFERENCES "Compliance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
