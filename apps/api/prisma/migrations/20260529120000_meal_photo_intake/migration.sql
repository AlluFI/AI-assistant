-- CreateTable
CREATE TABLE "MealPhotoScan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "mealType" TEXT,
    "description" TEXT,
    "foods" JSONB NOT NULL DEFAULT '[]',
    "nutrition" JSONB,
    "unmatchedFoods" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPhotoScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealIntakeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scanId" TEXT,
    "date" TEXT NOT NULL,
    "mealType" TEXT,
    "title" TEXT NOT NULL,
    "nutrition" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'photo',
    "eatenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealIntakeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealPhotoScan_userId_createdAt_idx" ON "MealPhotoScan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MealIntakeLog_userId_date_idx" ON "MealIntakeLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MealIntakeLog_scanId_key" ON "MealIntakeLog"("scanId");

-- AddForeignKey
ALTER TABLE "MealPhotoScan" ADD CONSTRAINT "MealPhotoScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealIntakeLog" ADD CONSTRAINT "MealIntakeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealIntakeLog" ADD CONSTRAINT "MealIntakeLog_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "MealPhotoScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
