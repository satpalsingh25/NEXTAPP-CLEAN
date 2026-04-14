-- AlterTable
ALTER TABLE "AMC" ADD COLUMN     "amc_template_id" UUID,
ADD COLUMN     "approved_by" UUID,
ADD COLUMN     "current_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "submitted_by" UUID;

-- AlterTable
ALTER TABLE "Compliance" ADD COLUMN     "current_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT';

-- AddForeignKey
ALTER TABLE "AMC" ADD CONSTRAINT "AMC_amc_template_id_fkey" FOREIGN KEY ("amc_template_id") REFERENCES "AMCTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
