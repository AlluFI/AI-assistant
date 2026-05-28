-- AlterTable
ALTER TABLE "PlannedMeal" ADD COLUMN "eatenAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PlannedMeal_versionId_dayIndex_eatenAt_idx" ON "PlannedMeal"("versionId", "dayIndex", "eatenAt");
