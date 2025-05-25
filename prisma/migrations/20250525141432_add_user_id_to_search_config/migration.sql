/*
  Warnings:

  - The primary key for the `SearchConfig` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[userId,configType]` on the table `SearchConfig` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `SearchConfig` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `userId` to the `SearchConfig` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SearchConfig" DROP CONSTRAINT "SearchConfig_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL,
ADD CONSTRAINT "SearchConfig_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "SearchConfig_userId_configType_key" ON "SearchConfig"("userId", "configType");
