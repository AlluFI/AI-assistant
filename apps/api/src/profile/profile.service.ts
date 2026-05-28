import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ProfileUpdateDto } from './dto/profile-update.dto';
import { MetricRecordDto } from './dto/metric-record.dto';
import { ActivityRecordDto } from './dto/activity-record.dto';
import { ActivityUpdateDto } from './dto/activity-update.dto';
import { MetricUpdateDto } from './dto/metric-update.dto';
import { PrivacyUpdateDto } from './dto/privacy-update.dto';
import { ConsentDto } from './dto/consent.dto';
import { num } from '../analytics/analytics.service';
import { DeleteRequestDto } from './dto/delete-request.dto';
import { ACTIVITY_TYPES, activityTypeLabel } from './activity-catalog';
import { parseRecordedAt } from './recorded-at.util';
import { weekStartUtc } from '../analytics/activity-week.util';

function dec(n?: number) {
  if (n === undefined) return undefined;
  return new Prisma.Decimal(n);
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly config: ConfigService,
  ) {}

  async get(userId: string) {
    const profile = await this.prisma.healthProfile.findUnique({
      where: { userId },
    });
    const baseline = await this.prisma.healthMetricSnapshot.findFirst({
      where: { userId, source: 'profile_baseline' },
      orderBy: { recordedAt: 'asc' },
      select: { weightKg: true, recordedAt: true },
    });
    if (!profile) {
      return {
        profile: null,
        startingWeightKg: baseline?.weightKg?.toNumber() ?? null,
        startingWeightSetAt: baseline?.recordedAt ?? null,
        hasStartingWeight: baseline != null,
      };
    }
    return {
      profile: this.serializeProfile(profile),
      startingWeightKg: baseline?.weightKg?.toNumber() ?? null,
      startingWeightSetAt: baseline?.recordedAt ?? null,
      hasStartingWeight: baseline != null,
    };
  }

  async upsert(userId: string, dto: ProfileUpdateDto) {
    await this.assertDataCollectionConsent(userId);

    const existingBaseline = await this.prisma.healthMetricSnapshot.findFirst({
      where: { userId, source: 'profile_baseline' },
      select: { id: true },
    });

    const data: Prisma.HealthProfileUpdateInput = {
      age: dto.age,
      gender: dto.gender,
      heightCm: dec(dto.heightCm),
      weightKg: dec(dto.weightKg),
      targetWeightKg: dec(dto.targetWeightKg),
      occupationType: dto.occupationType,
      activityLevel: dto.activityLevel,
      dietaryPreferences: dto.dietaryPreferences as Prisma.InputJsonValue,
      dietaryRestrictions: dto.dietaryRestrictions as Prisma.InputJsonValue,
      fitnessGoalPrimary: dto.fitnessGoalPrimary,
      desiredActivityLevel: dto.desiredActivityLevel,
      weeklyActivityDays: dto.weeklyActivityDays,
      exerciseTypes: dto.exerciseTypes as Prisma.InputJsonValue,
      sessionDurationBand: dto.sessionDurationBand,
      fitnessSelfLevel: dto.fitnessSelfLevel,
      exerciseEnvironment: dto.exerciseEnvironment,
      exerciseTimeOfDay: dto.exerciseTimeOfDay,
      enduranceMinutes: dto.enduranceMinutes,
      pushupsMax: dto.pushupsMax,
      squatsMax: dto.squatsMax,
    };

    const fields = this.stripUndefined(
      data as unknown as Record<string, unknown>,
    );

    if (!existingBaseline && dto.startingWeightKg !== undefined) {
      fields.weightKg = dec(dto.startingWeightKg);
    }

    const profile = await this.prisma.healthProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...fields,
      } as Prisma.HealthProfileUncheckedCreateInput,
      update: fields as Prisma.HealthProfileUpdateInput,
    });

    await this.ensureProfileBaselineSnapshot(userId, profile);

    const baseline = await this.prisma.healthMetricSnapshot.findFirst({
      where: { userId, source: 'profile_baseline' },
      orderBy: { recordedAt: 'asc' },
      select: { weightKg: true, recordedAt: true },
    });

    return {
      profile: this.serializeProfile(profile),
      startingWeightKg: baseline?.weightKg?.toNumber() ?? null,
      startingWeightSetAt: baseline?.recordedAt ?? null,
      hasStartingWeight: baseline != null,
    };
  }

  /**
   * Replaces the chart baseline and clears weight/wellness/activity history so progress
   * restarts from the new starting weight.
   */
  async resetStartingWeightHistory(userId: string, startingWeightKg: number) {
    await this.assertDataCollectionConsent(userId);

    const profile = await this.prisma.healthProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new BadRequestException(
        'Save a health profile before changing starting weight.',
      );
    }

    const [deletedMetrics, deletedActivities] = await this.prisma.$transaction([
      this.prisma.healthMetricSnapshot.deleteMany({ where: { userId } }),
      this.prisma.activityLog.deleteMany({ where: { userId } }),
    ]);

    const updated = await this.prisma.healthProfile.update({
      where: { userId },
      data: { weightKg: dec(startingWeightKg) },
    });

    await this.ensureProfileBaselineSnapshot(userId, updated);

    const baseline = await this.prisma.healthMetricSnapshot.findFirst({
      where: { userId, source: 'profile_baseline' },
      orderBy: { recordedAt: 'asc' },
      select: { weightKg: true, recordedAt: true },
    });

    return {
      profile: this.serializeProfile(updated),
      startingWeightKg: baseline?.weightKg?.toNumber() ?? startingWeightKg,
      startingWeightSetAt: baseline?.recordedAt ?? new Date(),
      hasStartingWeight: true,
      deletedMetrics,
      deletedActivities,
    };
  }

  /** Persists a starting metric point when the user first supplies weight (and related fields). */
  private async ensureProfileBaselineSnapshot(
    userId: string,
    profile: {
      weightKg: Prisma.Decimal | null;
      heightCm: Prisma.Decimal | null;
      weeklyActivityDays: number | null;
      activityLevel: string | null;
      targetWeightKg: Prisma.Decimal | null;
      fitnessGoalPrimary: string | null;
    },
  ) {
    const weightKg = num(profile.weightKg);
    if (weightKg == null && profile.weeklyActivityDays == null) return;

    const { score, bmi } = this.analytics.wellnessScore(profile, {
      weightKg,
      heightCm: num(profile.heightCm),
      weeklyActivityDays: profile.weeklyActivityDays,
    });

    const existing = await this.prisma.healthMetricSnapshot.findFirst({
      where: { userId, source: 'profile_baseline' },
      orderBy: { recordedAt: 'asc' },
    });

    if (!existing) {
      await this.prisma.healthMetricSnapshot.create({
        data: {
          userId,
          recordedAt: new Date(),
          weightKg: weightKg != null ? profile.weightKg : null,
          heightCm: profile.heightCm,
          weeklyActivityDays: profile.weeklyActivityDays,
          wellnessScore: score,
          bmi: bmi != null ? new Prisma.Decimal(Number(bmi.toFixed(2))) : null,
          source: 'profile_baseline',
        },
      });
      return;
    }

    await this.prisma.healthMetricSnapshot.update({
      where: { id: existing.id },
      data: {
        heightCm: profile.heightCm ?? existing.heightCm,
        weeklyActivityDays:
          profile.weeklyActivityDays ?? existing.weeklyActivityDays,
        wellnessScore: score,
        bmi: bmi != null ? new Prisma.Decimal(Number(bmi.toFixed(2))) : null,
      },
    });
  }

  private stripUndefined<T extends Record<string, unknown>>(obj: T): T {
    const out = { ...obj };
    for (const k of Object.keys(out)) {
      if (out[k] === undefined) delete out[k];
    }
    return out;
  }

  private serializeProfile(p: {
    heightCm: Prisma.Decimal | null;
    weightKg: Prisma.Decimal | null;
    targetWeightKg: Prisma.Decimal | null;
    dietaryPreferences: Prisma.JsonValue;
    dietaryRestrictions: Prisma.JsonValue;
    exerciseTypes: Prisma.JsonValue;
    [key: string]: unknown;
  }) {
    return {
      ...p,
      heightCm: p.heightCm?.toNumber() ?? null,
      weightKg: p.weightKg?.toNumber() ?? null,
      targetWeightKg: p.targetWeightKg?.toNumber() ?? null,
    };
  }

  getActivityCatalog() {
    return { activities: ACTIVITY_TYPES };
  }

  async listMetrics(userId: string, days?: number, limit = 200) {
    const since =
      days != null
        ? new Date(Date.now() - Math.min(365, Math.max(7, days)) * 86400000)
        : undefined;
    const rows = await this.prisma.healthMetricSnapshot.findMany({
      where: {
        userId,
        ...(since ? { recordedAt: { gte: since } } : {}),
        OR: [{ weightKg: { not: null } }, { heightCm: { not: null } }],
      },
      orderBy: { recordedAt: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
    });
    return rows.map((r) => ({
      id: r.id,
      recordedAt: r.recordedAt,
      weightKg: r.weightKg?.toNumber() ?? null,
      heightCm: r.heightCm?.toNumber() ?? null,
      weeklyActivityDays: r.weeklyActivityDays,
      wellnessScore: r.wellnessScore,
      bmi: r.bmi?.toNumber() ?? null,
      source: r.source,
    }));
  }

  async listActivities(userId: string, days?: number, limit = 200) {
    const since =
      days != null
        ? new Date(Date.now() - Math.min(365, Math.max(7, days)) * 86400000)
        : undefined;
    const rows = await this.prisma.activityLog.findMany({
      where: {
        userId,
        ...(since ? { activityAt: { gte: since } } : {}),
      },
      orderBy: { activityAt: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
    });
    return rows.map((r) => ({
      id: r.id,
      activityType: r.activityType,
      activityTypeLabel: activityTypeLabel(r.activityType),
      activityAt: r.activityAt,
      durationMinutes: r.durationMinutes,
      notes: r.notes,
      source: r.source,
    }));
  }

  async recordActivity(userId: string, dto: ActivityRecordDto) {
    await this.assertDataCollectionConsent(userId);

    const profile = await this.prisma.healthProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException(
        'Create a health profile before logging activities.',
      );
    }

    const activityAt = parseRecordedAt(dto.activityAt);
    const row = await this.prisma.activityLog.create({
      data: {
        userId,
        activityType: dto.activityType,
        activityAt,
        durationMinutes: dto.durationMinutes,
        notes: dto.notes?.trim() || null,
        source: 'user',
      },
    });

    await this.syncProfileWeeklyActivityFromLogs(userId);

    return {
      activity: {
        id: row.id,
        activityType: row.activityType,
        activityTypeLabel: activityTypeLabel(row.activityType),
        activityAt: row.activityAt,
        durationMinutes: row.durationMinutes,
        notes: row.notes,
        source: row.source,
      },
    };
  }

  async updateActivity(
    userId: string,
    activityId: string,
    dto: ActivityUpdateDto,
  ) {
    await this.assertDataCollectionConsent(userId);

    const existing = await this.prisma.activityLog.findFirst({
      where: { id: activityId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Activity not found.');
    }

    if (
      dto.activityType === undefined &&
      dto.durationMinutes === undefined &&
      dto.activityAt === undefined &&
      dto.notes === undefined
    ) {
      throw new BadRequestException('No fields to update.');
    }

    const row = await this.prisma.activityLog.update({
      where: { id: activityId },
      data: {
        ...(dto.activityType !== undefined
          ? { activityType: dto.activityType }
          : {}),
        ...(dto.durationMinutes !== undefined
          ? { durationMinutes: dto.durationMinutes }
          : {}),
        ...(dto.activityAt !== undefined
          ? { activityAt: parseRecordedAt(dto.activityAt) }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      },
    });

    await this.syncProfileWeeklyActivityFromLogs(userId);

    return {
      activity: {
        id: row.id,
        activityType: row.activityType,
        activityTypeLabel: activityTypeLabel(row.activityType),
        activityAt: row.activityAt,
        durationMinutes: row.durationMinutes,
        notes: row.notes,
        source: row.source,
      },
    };
  }

  async deleteActivity(userId: string, activityId: string) {
    await this.assertDataCollectionConsent(userId);
    const row = await this.prisma.activityLog.findFirst({
      where: { id: activityId, userId },
    });
    if (!row) {
      throw new NotFoundException('Activity not found.');
    }
    await this.prisma.activityLog.delete({ where: { id: activityId } });
    await this.syncProfileWeeklyActivityFromLogs(userId);
    return { deleted: true };
  }

  async updateMetric(userId: string, metricId: string, dto: MetricUpdateDto) {
    await this.assertDataCollectionConsent(userId);

    const existing = await this.prisma.healthMetricSnapshot.findFirst({
      where: { id: metricId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Weight entry not found.');
    }
    if (existing.source === 'profile_baseline') {
      throw new BadRequestException(
        'Profile baseline entries cannot be edited here.',
      );
    }

    if (dto.weightKg === undefined && dto.recordedAt === undefined) {
      throw new BadRequestException('No fields to update.');
    }

    const profile = await this.prisma.healthProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Health profile not found.');
    }

    const weightKg =
      dto.weightKg !== undefined
        ? dto.weightKg
        : existing.weightKg != null
          ? num(existing.weightKg)
          : null;
    const recordedAt =
      dto.recordedAt !== undefined
        ? parseRecordedAt(dto.recordedAt)
        : existing.recordedAt;

    if (weightKg == null) {
      throw new BadRequestException('Weight entry has no weight value.');
    }

    const { score, bmi } = this.analytics.wellnessScore(profile, {
      weightKg,
      heightCm:
        existing.heightCm != null
          ? num(existing.heightCm)
          : profile.heightCm != null
            ? num(profile.heightCm)
            : null,
      weeklyActivityDays:
        existing.weeklyActivityDays ?? profile.weeklyActivityDays,
    });

    const row = await (async () => {
      try {
        return await this.prisma.healthMetricSnapshot.update({
          where: { id: metricId },
          data: {
            recordedAt,
            weightKg: dec(weightKg),
            wellnessScore: score,
            bmi:
              bmi != null ? new Prisma.Decimal(Number(bmi.toFixed(2))) : null,
          },
        });
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code === 'P2002') {
          throw new BadRequestException(
            'Another entry already exists for this timestamp.',
          );
        }
        throw error;
      }
    })();

    await this.syncProfileWeightFromLatestMetric(userId);

    return {
      metric: {
        id: row.id,
        recordedAt: row.recordedAt,
        weightKg: row.weightKg?.toNumber() ?? null,
        heightCm: row.heightCm?.toNumber() ?? null,
        weeklyActivityDays: row.weeklyActivityDays,
        wellnessScore: row.wellnessScore,
        bmi: row.bmi?.toNumber() ?? null,
        source: row.source,
      },
    };
  }

  async deleteMetric(userId: string, metricId: string) {
    await this.assertDataCollectionConsent(userId);

    const row = await this.prisma.healthMetricSnapshot.findFirst({
      where: { id: metricId, userId },
    });
    if (!row) {
      throw new NotFoundException('Weight entry not found.');
    }
    if (row.source === 'profile_baseline') {
      throw new BadRequestException(
        'Profile baseline entries cannot be deleted.',
      );
    }

    await this.prisma.healthMetricSnapshot.delete({ where: { id: metricId } });
    await this.syncProfileWeightFromLatestMetric(userId);
    return { deleted: true };
  }

  private async syncProfileWeightFromLatestMetric(userId: string) {
    const profile = await this.prisma.healthProfile.findUnique({
      where: { userId },
    });
    if (!profile) return;

    const latest = await this.prisma.healthMetricSnapshot.findFirst({
      where: { userId, weightKg: { not: null } },
      orderBy: { recordedAt: 'desc' },
    });

    await this.prisma.healthProfile.update({
      where: { userId },
      data: {
        weightKg: latest?.weightKg ?? profile.weightKg,
      },
    });
  }

  /** Updates profile.weeklyActivityDays from distinct active days in the current week. */
  private async syncProfileWeeklyActivityFromLogs(userId: string) {
    const now = new Date();
    const weekStart = weekStartUtc(now);
    const logs = await this.prisma.activityLog.findMany({
      where: { userId, activityAt: { gte: weekStart } },
      select: { activityAt: true },
    });
    const days = new Set(
      logs.map((l) => l.activityAt.toISOString().slice(0, 10)),
    );
    const weeklyActivityDays = Math.min(7, days.size);
    await this.prisma.healthProfile.update({
      where: { userId },
      data: { weeklyActivityDays },
    });
  }

  async recordMetric(userId: string, dto: MetricRecordDto) {
    await this.assertDataCollectionConsent(userId);

    const profile = await this.prisma.healthProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException(
        'Create a health profile before recording metrics.',
      );
    }

    if (
      dto.weightKg === undefined &&
      dto.heightCm === undefined &&
      dto.weeklyActivityDays === undefined
    ) {
      throw new BadRequestException(
        'Provide at least one of weightKg, heightCm, or weeklyActivityDays.',
      );
    }

    const recordedAt = parseRecordedAt(dto.recordedAt);

    const { score, bmi } = this.analytics.wellnessScore(profile, {
      weightKg: dto.weightKg ?? profile.weightKg?.toNumber() ?? null,
      heightCm: dto.heightCm ?? profile.heightCm?.toNumber() ?? null,
      weeklyActivityDays:
        dto.weeklyActivityDays ?? profile.weeklyActivityDays ?? null,
    });

    const row = await (async () => {
      try {
        return await this.prisma.healthMetricSnapshot.create({
          data: {
            userId,
            recordedAt,
            weightKg: dec(dto.weightKg),
            heightCm: dec(dto.heightCm),
            weeklyActivityDays: dto.weeklyActivityDays,
            wellnessScore: score,
            bmi:
              bmi != null ? new Prisma.Decimal(Number(bmi.toFixed(2))) : null,
            source: dto.source ?? 'user',
          },
        });
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code === 'P2002') {
          throw new BadRequestException(
            'A metric entry already exists for this timestamp.',
          );
        }
        throw error;
      }
    })();

    const patch: Prisma.HealthProfileUpdateInput = {};
    if (dto.weightKg !== undefined) patch.weightKg = dec(dto.weightKg);
    if (dto.heightCm !== undefined) patch.heightCm = dec(dto.heightCm);
    if (dto.weeklyActivityDays !== undefined) {
      patch.weeklyActivityDays = dto.weeklyActivityDays;
    }
    if (Object.keys(patch).length) {
      await this.prisma.healthProfile.update({
        where: { userId },
        data: patch,
      });
    }

    return {
      metric: {
        id: row.id,
        recordedAt: row.recordedAt,
        weightKg: row.weightKg?.toNumber() ?? null,
        heightCm: row.heightCm?.toNumber() ?? null,
        weeklyActivityDays: row.weeklyActivityDays,
        wellnessScore: row.wellnessScore,
        bmi: row.bmi?.toNumber() ?? null,
        source: row.source,
      },
    };
  }

  private toPrivacySettingsResponse(row: {
    allowAiProcessing: boolean;
    publicProfileVisible: boolean;
    shareAnonymizedData: boolean;
    emailNotifications: boolean;
    insightCadence?: string;
    weightReminderEnabled?: boolean;
    activityReminderEnabled?: boolean;
    reminderChannel?: string;
    activityReminderCadence?: string;
  }) {
    return {
      allowAiProcessing: row.allowAiProcessing,
      publicProfileVisible: row.publicProfileVisible,
      shareAnonymizedData: row.shareAnonymizedData,
      emailNotifications: row.emailNotifications,
      insightCadence:
        row.insightCadence === 'daily' || row.insightCadence === 'weekly'
          ? row.insightCadence
          : 'off',
      weightReminderEnabled:
        typeof row.weightReminderEnabled === 'boolean'
          ? row.weightReminderEnabled
          : true,
      activityReminderEnabled:
        typeof row.activityReminderEnabled === 'boolean'
          ? row.activityReminderEnabled
          : true,
      reminderChannel: row.reminderChannel === 'email' ? 'email' : 'in_app',
      activityReminderCadence:
        row.activityReminderCadence === 'weekly' ||
        row.activityReminderCadence === 'off'
          ? row.activityReminderCadence
          : 'daily',
    };
  }

  async getPrivacy(userId: string) {
    const settings = await this.prisma.privacySettings.findUnique({
      where: { userId },
    });
    if (!settings) {
      return {
        settings: this.toPrivacySettingsResponse({
          allowAiProcessing: true,
          publicProfileVisible: false,
          shareAnonymizedData: false,
          emailNotifications: true,
          insightCadence: 'off',
          weightReminderEnabled: true,
          activityReminderEnabled: true,
          reminderChannel: 'in_app',
          activityReminderCadence: 'daily',
        }),
      };
    }
    return { settings: this.toPrivacySettingsResponse(settings) };
  }

  async upsertPrivacy(userId: string, dto: PrivacyUpdateDto) {
    const data = this.stripUndefined({
      allowAiProcessing: dto.allowAiProcessing,
      publicProfileVisible: dto.publicProfileVisible,
      shareAnonymizedData: dto.shareAnonymizedData,
      emailNotifications: dto.emailNotifications,
      insightCadence: dto.insightCadence,
      weightReminderEnabled: dto.weightReminderEnabled,
      activityReminderEnabled: dto.activityReminderEnabled,
      reminderChannel: dto.reminderChannel,
      activityReminderCadence: dto.activityReminderCadence,
    });
    const settings = await this.prisma.privacySettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return { settings: this.toPrivacySettingsResponse(settings) };
  }

  async listConsents(userId: string, limit: number) {
    const rows = await this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
    });
    return { records: rows };
  }

  async recordConsent(userId: string, dto: ConsentDto) {
    const row = await this.prisma.consentRecord.create({
      data: {
        userId,
        consentType: dto.consentType,
        granted: dto.granted,
        source: dto.source || 'user_settings',
      },
    });
    return { record: row };
  }

  private async assertDataCollectionConsent(userId: string) {
    const latest = await this.prisma.consentRecord.findFirst({
      where: { userId, consentType: 'data_collection' },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest?.granted) {
      throw new ForbiddenException(
        'Data collection consent is required before saving profile or metrics.',
      );
    }
  }

  async exportData(userId: string) {
    const [user, profile, metrics, activities, insights, privacy, consents] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            createdAt: true,
            emailVerifiedAt: true,
          },
        }),
        this.prisma.healthProfile.findUnique({ where: { userId } }),
        this.prisma.healthMetricSnapshot.findMany({
          where: { userId },
          orderBy: { recordedAt: 'asc' },
        }),
        this.prisma.activityLog.findMany({
          where: { userId },
          orderBy: { activityAt: 'asc' },
        }),
        this.prisma.aIInsight.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.privacySettings.findUnique({ where: { userId } }),
        this.prisma.consentRecord.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      user,
      profile: profile
        ? {
            ...profile,
            heightCm: profile.heightCm ? num(profile.heightCm) : null,
            weightKg: profile.weightKg ? num(profile.weightKg) : null,
            targetWeightKg: profile.targetWeightKg
              ? num(profile.targetWeightKg)
              : null,
          }
        : null,
      metrics: metrics.map((m) => ({
        ...m,
        weightKg: m.weightKg ? num(m.weightKg) : null,
        heightCm: m.heightCm ? num(m.heightCm) : null,
        bmi: m.bmi ? num(m.bmi) : null,
      })),
      activities: activities.map((a) => ({
        ...a,
        activityTypeLabel: activityTypeLabel(a.activityType),
      })),
      insights: insights.map((i) => ({
        ...i,
        rawResponse: undefined,
      })),
      privacySettings: privacy,
      consentRecords: consents,
    };

    const itemCount =
      (profile ? 1 : 0) +
      metrics.length +
      activities.length +
      insights.length +
      (privacy ? 1 : 0) +
      consents.length;
    await this.prisma.exportEvent.create({
      data: {
        userId,
        format: 'json',
        itemCount,
      },
    });

    return payload;
  }

  async listExportEvents(userId: string, limit: number) {
    const rows = await this.prisma.exportEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
    });
    return { events: rows };
  }

  private retentionDays() {
    return Number(this.config.get<string>('DELETE_RETENTION_DAYS') ?? 30);
  }

  async getDeletionStatus(userId: string) {
    const req = await this.prisma.deletionRequest.findUnique({
      where: { userId },
    });
    return { request: req };
  }

  async requestDeletion(userId: string, dto: DeleteRequestDto) {
    const now = new Date();
    const scheduledFor = new Date(
      now.getTime() + this.retentionDays() * 24 * 60 * 60 * 1000,
    );
    const existing = await this.prisma.deletionRequest.findUnique({
      where: { userId },
    });
    if (existing && existing.status === 'pending') {
      return { request: existing };
    }
    const req = await this.prisma.deletionRequest.upsert({
      where: { userId },
      create: {
        userId,
        reason: dto.reason,
        status: 'pending',
        requestedAt: now,
        scheduledFor,
      },
      update: {
        reason: dto.reason,
        status: 'pending',
        requestedAt: now,
        scheduledFor,
        cancelledAt: null,
        processedAt: null,
      },
    });
    return { request: req };
  }

  async cancelDeletion(userId: string) {
    const req = await this.prisma.deletionRequest.findUnique({
      where: { userId },
    });
    if (!req || req.status !== 'pending') {
      throw new BadRequestException('No pending deletion request to cancel.');
    }
    const out = await this.prisma.deletionRequest.update({
      where: { userId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });
    return { request: out };
  }

  async purgeDue(secret: string) {
    const expected = this.config.get<string>('PURGE_ADMIN_SECRET');
    if (!expected || secret !== expected) {
      throw new ForbiddenException('Invalid purge secret');
    }
    const due = await this.prisma.deletionRequest.findMany({
      where: {
        status: 'pending',
        scheduledFor: { lte: new Date() },
      },
      select: { userId: true },
    });
    let purged = 0;
    for (const row of due) {
      await this.prisma.user.delete({ where: { id: row.userId } });
      purged += 1;
    }
    return { purged };
  }
}
