/*
  Warnings:

  - You are about to drop the column `jobCriteria` on the `Job` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Job" DROP COLUMN "jobCriteria",
ADD COLUMN     "employmentType" TEXT,
ADD COLUMN     "industries" TEXT,
ADD COLUMN     "isRemote" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "jobFunction" TEXT,
ADD COLUMN     "seniority" TEXT;
