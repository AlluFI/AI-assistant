-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totpSecret" TEXT,
ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "backupCodes" JSONB;

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthAccount_provider_providerUserId_key" ON "OAuthAccount"("provider", "providerUserId");

CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "HealthProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "heightCm" DECIMAL(8,2),
    "weightKg" DECIMAL(9,3),
    "occupationType" TEXT,
    "activityLevel" TEXT,
    "dietaryPreferences" JSONB,
    "dietaryRestrictions" JSONB,
    "fitnessGoalPrimary" TEXT,
    "desiredActivityLevel" TEXT,
    "weeklyActivityDays" INTEGER,
    "exerciseTypes" JSONB,
    "sessionDurationBand" TEXT,
    "fitnessSelfLevel" TEXT,
    "exerciseEnvironment" TEXT,
    "exerciseTimeOfDay" TEXT,
    "enduranceMinutes" INTEGER,
    "pushupsMax" INTEGER,
    "squatsMax" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HealthProfile_userId_key" ON "HealthProfile"("userId");

ALTER TABLE "HealthProfile" ADD CONSTRAINT "HealthProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "HealthMetricSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DECIMAL(9,3),
    "heightCm" DECIMAL(8,2),
    "weeklyActivityDays" INTEGER,
    "wellnessScore" INTEGER,
    "bmi" DECIMAL(6,2),
    "source" TEXT NOT NULL DEFAULT 'user',

    CONSTRAINT "HealthMetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HealthMetricSnapshot_userId_recordedAt_idx" ON "HealthMetricSnapshot"("userId", "recordedAt");

ALTER TABLE "HealthMetricSnapshot" ADD CONSTRAINT "HealthMetricSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
