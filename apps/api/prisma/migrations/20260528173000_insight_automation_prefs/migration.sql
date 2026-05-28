-- AlterTable
ALTER TABLE "PrivacySettings"
ADD COLUMN "insightCadence" TEXT NOT NULL DEFAULT 'off',
ADD COLUMN "weightReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "activityReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lastAutoInsightAt" TIMESTAMP(3),
ADD COLUMN "lastWeightReminderAt" TIMESTAMP(3),
ADD COLUMN "lastActivityReminderAt" TIMESTAMP(3);
