-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'APPROVER';

-- DropForeignKey
ALTER TABLE "AMC" DROP CONSTRAINT "AMC_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "AMC" DROP CONSTRAINT "AMC_vendor_id_fkey";

-- AlterTable
ALTER TABLE "AMC" ADD COLUMN     "title" TEXT,
ALTER COLUMN "asset_id" DROP NOT NULL,
ALTER COLUMN "vendor_id" DROP NOT NULL,
ALTER COLUMN "start_date" DROP NOT NULL,
ALTER COLUMN "expiry_date" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Compliance" ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "department_id" UUID,
ADD COLUMN     "function_id" UUID,
ADD COLUMN     "group_id" UUID,
ADD COLUMN     "must_reset_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_function_id_fkey" FOREIGN KEY ("function_id") REFERENCES "business_functions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMC" ADD CONSTRAINT "AMC_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMC" ADD CONSTRAINT "AMC_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
