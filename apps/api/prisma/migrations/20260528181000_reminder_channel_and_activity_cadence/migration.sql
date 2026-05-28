-- AlterTable
ALTER TABLE "PrivacySettings"
ADD COLUMN "reminderChannel" TEXT NOT NULL DEFAULT 'in_app',
ADD COLUMN "activityReminderCadence" TEXT NOT NULL DEFAULT 'daily';
