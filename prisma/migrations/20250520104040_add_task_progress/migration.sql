-- CreateTable
CREATE TABLE "TaskProgress" (
    "id" TEXT NOT NULL DEFAULT 'current',
    "geoIndex" INTEGER NOT NULL,
    "keywordIndex" INTEGER NOT NULL,
    "step" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskProgress_pkey" PRIMARY KEY ("id")
);
