-- Enhanced nutritional data (recipe + meal plan version)
ALTER TABLE "Recipe" ADD COLUMN "glycemicIndex" INTEGER;
ALTER TABLE "Recipe" ADD COLUMN "antioxidantProfile" JSONB;
ALTER TABLE "Recipe" ADD COLUMN "nutrientDensityScore" DOUBLE PRECISION;
ALTER TABLE "Recipe" ADD COLUMN "processingLevel" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "environmentalImpact" JSONB;
ALTER TABLE "Recipe" ADD COLUMN "satietyIndex" INTEGER;

ALTER TABLE "MealPlanVersion" ADD COLUMN "nutritionalBalanceScore" DOUBLE PRECISION;
ALTER TABLE "MealPlanVersion" ADD COLUMN "diversityIndex" DOUBLE PRECISION;
ALTER TABLE "MealPlanVersion" ADD COLUMN "micronutrientCoverage" JSONB;
ALTER TABLE "MealPlanVersion" ADD COLUMN "weeklyTrends" JSONB;
ALTER TABLE "MealPlanVersion" ADD COLUMN "sustainabilityMetrics" JSONB;
