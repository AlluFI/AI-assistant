-- Base demo account, profile, weekly metric snapshots, privacy, and consents.
-- Activity logs, nutrition profile, and hidden intake history (charts only): prisma/seed-demo-extras.ts (via pnpm demo:seed).

INSERT INTO "User" (
  "id",
  "email",
  "passwordHash",
  "emailVerifiedAt",
  "totpEnabled",
  "createdAt",
  "updatedAt"
)
VALUES (
  'demo_user_001',
  'demo@numbers.local',
  '$argon2id$v=19$m=65536,t=3,p=4$jhlROAFP9bXaxL2poSKjNw$tGhInuXYcTisIXDbvnWd36t/ewnM2KgS59GUGDH6t+Q',
  NOW(),
  false,
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO UPDATE
SET
  "passwordHash" = EXCLUDED."passwordHash",
  "emailVerifiedAt" = NOW(),
  "updatedAt" = NOW();

INSERT INTO "HealthProfile" (
  "id",
  "userId",
  "age",
  "gender",
  "heightCm",
  "weightKg",
  "targetWeightKg",
  "occupationType",
  "activityLevel",
  "dietaryPreferences",
  "dietaryRestrictions",
  "fitnessGoalPrimary",
  "desiredActivityLevel",
  "weeklyActivityDays",
  "exerciseTypes",
  "sessionDurationBand",
  "fitnessSelfLevel",
  "exerciseEnvironment",
  "exerciseTimeOfDay",
  "enduranceMinutes",
  "pushupsMax",
  "squatsMax",
  "createdAt",
  "updatedAt"
)
SELECT
  'demo_profile_001',
  u."id",
  31,
  'female',
  176,
  76.8,
  73,
  'desk job',
  'moderate',
  '["balanced","high_protein"]'::jsonb,
  '[]'::jsonb,
  'weight_loss',
  'active',
  4,
  '["cardio","strength"]'::jsonb,
  '30_60',
  'intermediate',
  'mixed',
  'morning',
  28,
  20,
  35,
  NOW() - INTERVAL '90 days',
  NOW()
FROM "User" u
WHERE u."email" = 'demo@numbers.local'
ON CONFLICT ("userId") DO UPDATE
SET
  "age" = EXCLUDED."age",
  "gender" = EXCLUDED."gender",
  "heightCm" = EXCLUDED."heightCm",
  "weightKg" = EXCLUDED."weightKg",
  "targetWeightKg" = EXCLUDED."targetWeightKg",
  "occupationType" = EXCLUDED."occupationType",
  "activityLevel" = EXCLUDED."activityLevel",
  "dietaryPreferences" = EXCLUDED."dietaryPreferences",
  "dietaryRestrictions" = EXCLUDED."dietaryRestrictions",
  "fitnessGoalPrimary" = EXCLUDED."fitnessGoalPrimary",
  "desiredActivityLevel" = EXCLUDED."desiredActivityLevel",
  "weeklyActivityDays" = EXCLUDED."weeklyActivityDays",
  "exerciseTypes" = EXCLUDED."exerciseTypes",
  "sessionDurationBand" = EXCLUDED."sessionDurationBand",
  "fitnessSelfLevel" = EXCLUDED."fitnessSelfLevel",
  "exerciseEnvironment" = EXCLUDED."exerciseEnvironment",
  "exerciseTimeOfDay" = EXCLUDED."exerciseTimeOfDay",
  "enduranceMinutes" = EXCLUDED."enduranceMinutes",
  "pushupsMax" = EXCLUDED."pushupsMax",
  "squatsMax" = EXCLUDED."squatsMax",
  "updatedAt" = NOW();

-- Remove prior demo metrics (weekly seed + any profile baseline from earlier runs).
DELETE FROM "HealthMetricSnapshot"
WHERE "userId" = (SELECT "id" FROM "User" WHERE "email" = 'demo@numbers.local')
  AND "source" IN ('seed', 'profile_baseline');

-- ~90 days of weekly snapshots: weight loss with plateaus, variable activity weeks, rising wellness.
-- days_ago, weight_kg, activity_days, wellness_score, bmi (height 176 cm)
INSERT INTO "HealthMetricSnapshot" (
  "id",
  "userId",
  "recordedAt",
  "weightKg",
  "heightCm",
  "weeklyActivityDays",
  "wellnessScore",
  "bmi",
  "source"
)
SELECT
  m.metric_id,
  u."id",
  (DATE_TRUNC('day', NOW()) - (m.days_ago || ' days')::interval) + TIME '12:00:00',
  m.weight_kg::decimal(9, 3),
  176::decimal(8, 2),
  m.activity_days,
  m.wellness_score,
  m.bmi::decimal(6, 2),
  m.metric_source
FROM "User" u
CROSS JOIN (
  VALUES
    ('demo_baseline_001', 84, 84.0::float, 1, 52, 27.1::float, 'profile_baseline'),
    ('demo_metric_001', 77, 83.3::float, 2, 54, 26.9::float, 'seed'),
    ('demo_metric_002', 70, 82.6::float, 2, 55, 26.7::float, 'seed'),
    ('demo_metric_003', 63, 81.8::float, 3, 57, 26.4::float, 'seed'),
    ('demo_metric_004', 56, 81.0::float, 4, 60, 26.2::float, 'seed'),
    ('demo_metric_005', 49, 80.4::float, 5, 63, 25.9::float, 'seed'),
    ('demo_metric_006', 42, 80.1::float, 2, 59, 25.9::float, 'seed'),
    ('demo_metric_007', 35, 79.3::float, 4, 62, 25.6::float, 'seed'),
    ('demo_metric_008', 28, 78.6::float, 5, 65, 25.4::float, 'seed'),
    ('demo_metric_009', 21, 78.0::float, 6, 69, 25.2::float, 'seed'),
    ('demo_metric_010', 14, 77.5::float, 5, 71, 25.0::float, 'seed'),
    ('demo_metric_011', 7, 77.1::float, 4, 73, 24.9::float, 'seed'),
    ('demo_metric_012', 0, 76.8::float, 4, 74, 24.8::float, 'seed')
) AS m(metric_id, days_ago, weight_kg, activity_days, wellness_score, bmi, metric_source)
WHERE u."email" = 'demo@numbers.local';

INSERT INTO "PrivacySettings" (
  "id",
  "userId",
  "allowAiProcessing",
  "publicProfileVisible",
  "shareAnonymizedData",
  "emailNotifications",
  "createdAt",
  "updatedAt"
)
SELECT
  'demo_privacy_001',
  u."id",
  true,
  false,
  false,
  true,
  NOW(),
  NOW()
FROM "User" u
WHERE u."email" = 'demo@numbers.local'
ON CONFLICT ("userId") DO UPDATE
SET
  "allowAiProcessing" = EXCLUDED."allowAiProcessing",
  "publicProfileVisible" = EXCLUDED."publicProfileVisible",
  "shareAnonymizedData" = EXCLUDED."shareAnonymizedData",
  "emailNotifications" = EXCLUDED."emailNotifications",
  "updatedAt" = NOW();

INSERT INTO "ConsentRecord" (
  "id",
  "userId",
  "consentType",
  "granted",
  "source",
  "createdAt"
)
SELECT
  'demo_consent_001',
  u."id",
  'analytics',
  true,
  'demo-seed',
  NOW()
FROM "User" u
WHERE u."email" = 'demo@numbers.local'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ConsentRecord" ("id", "userId", "consentType", "granted", "source", "createdAt")
SELECT 'demo_consent_dc', u."id", 'data_collection', true, 'demo-seed', NOW()
FROM "User" u
WHERE u."email" = 'demo@numbers.local'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ConsentRecord" ("id", "userId", "consentType", "granted", "source", "createdAt")
SELECT 'demo_consent_ai', u."id", 'ai_processing', true, 'demo-seed', NOW()
FROM "User" u
WHERE u."email" = 'demo@numbers.local'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ConsentRecord" ("id", "userId", "consentType", "granted", "source", "createdAt")
SELECT 'demo_consent_mkt', u."id", 'marketing_email', true, 'demo-seed', NOW()
FROM "User" u
WHERE u."email" = 'demo@numbers.local'
ON CONFLICT ("id") DO NOTHING;
