ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "communityScore" DOUBLE PRECISION;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "communityRatingCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "communityRagText" TEXT;

CREATE TABLE "RecipeFeedback" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "reviewText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecipeFeedback_recipeId_userId_key" ON "RecipeFeedback"("recipeId", "userId");
CREATE INDEX "RecipeFeedback_recipeId_status_idx" ON "RecipeFeedback"("recipeId", "status");
CREATE INDEX "RecipeFeedback_status_createdAt_idx" ON "RecipeFeedback"("status", "createdAt");
CREATE INDEX "Recipe_verified_communityScore_idx" ON "Recipe"("verified", "communityScore");

ALTER TABLE "RecipeFeedback" ADD CONSTRAINT "RecipeFeedback_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeFeedback" ADD CONSTRAINT "RecipeFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
