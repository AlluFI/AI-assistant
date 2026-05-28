import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  weekKeyFromIso,
  weekStartUtc,
  weeklyActiveDaysFromLogs,
} from './activity-week.util';

export type HealthProfileLike = {
  heightCm: Prisma.Decimal | null;
  weightKg: Prisma.Decimal | null;
  targetWeightKg: Prisma.Decimal | null;
  activityLevel: string | null;
  fitnessGoalPrimary: string | null;
  weeklyActivityDays: number | null;
};

export function num(
  v: Prisma.Decimal | number | null | undefined,
): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  return v.toNumber();
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  computeBmi(weightKg: number, heightCm: number): number | null {
    if (heightCm <= 0 || weightKg <= 0) return null;
    const m = heightCm / 100;
    return weightKg / (m * m);
  }

  classifyBmi(bmi: number): string {
    if (bmi < 18.5) return 'underweight';
    if (bmi < 25) return 'normal_weight';
    if (bmi < 30) return 'overweight';
    return 'obese';
  }

  bmiComponentScore(bmi: number | null): number {
    if (bmi == null) return 50;
    if (bmi >= 18.5 && bmi < 25) return 100;
    if (bmi >= 25 && bmi < 30) return 70;
    if (bmi >= 30) return 40;
    if (bmi >= 17 && bmi < 18.5) return 75;
    return 55;
  }

  activityComponentScore(activityLevel: string | null): number {
    const a = (activityLevel ?? '').toLowerCase();
    const map: Record<string, number> = {
      sedentary: 25,
      light: 50,
      moderate: 75,
      active: 90,
      very_active: 100,
    };
    return map[a] ?? 55;
  }

  progressComponentScore(
    profile: HealthProfileLike,
    currentWeightKg: number | null,
  ): number {
    const target = num(profile.targetWeightKg);
    const w = currentWeightKg ?? num(profile.weightKg);
    const goal = (profile.fitnessGoalPrimary ?? '').toLowerCase();
    if (target == null || w == null) return 60;
    if (goal.includes('loss') && w > target) {
      const gap = Math.min(1, (w - target) / Math.max(1, w));
      return Math.round(100 * (1 - gap));
    }
    if (goal.includes('gain') && w < target) {
      const gap = Math.min(1, (target - w) / Math.max(1, target));
      return Math.round(100 * (1 - gap));
    }
    return 75;
  }

  habitsComponentScore(weeklyDays: number | null): number {
    if (weeklyDays == null) return 50;
    return Math.min(100, Math.round((weeklyDays / 7) * 100));
  }

  wellnessScore(
    profile: HealthProfileLike,
    snapshot: {
      weightKg: number | null;
      heightCm: number | null;
      weeklyActivityDays: number | null;
    },
  ): { score: number; bmi: number | null; bmiClass: string | null } {
    const w = snapshot.weightKg ?? num(profile.weightKg);
    const h = snapshot.heightCm ?? num(profile.heightCm);
    const bmi = w != null && h != null ? this.computeBmi(w, h) : null;
    const bmiScore = this.bmiComponentScore(bmi);
    const activityScore = this.activityComponentScore(profile.activityLevel);
    const progressScore = this.progressComponentScore(profile, w);
    const habitsScore = this.habitsComponentScore(
      snapshot.weeklyActivityDays ?? profile.weeklyActivityDays,
    );
    const score = Math.round(
      bmiScore * 0.3 +
        activityScore * 0.3 +
        progressScore * 0.2 +
        habitsScore * 0.2,
    );
    return {
      score: Math.max(0, Math.min(100, score)),
      bmi,
      bmiClass: bmi != null ? this.classifyBmi(bmi) : null,
    };
  }

  async getSummary(userId: string) {
    const profile = await this.prisma.healthProfile.findUnique({
      where: { userId },
    });
    const latest = await this.prisma.healthMetricSnapshot.findFirst({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
    });
    const w =
      latest?.weightKg != null
        ? num(latest.weightKg)
        : profile?.weightKg != null
          ? num(profile.weightKg)
          : null;
    const h =
      latest?.heightCm != null
        ? num(latest.heightCm)
        : profile?.heightCm != null
          ? num(profile.heightCm)
          : null;
    const logWeekly = await this.currentWeekActiveDaysFromLogs(userId);
    const weekly =
      logWeekly ??
      latest?.weeklyActivityDays ??
      profile?.weeklyActivityDays ??
      null;
    const emptyProfile: HealthProfileLike = {
      heightCm: null,
      weightKg: null,
      targetWeightKg: null,
      activityLevel: null,
      fitnessGoalPrimary: null,
      weeklyActivityDays: null,
    };
    const p = profile ?? emptyProfile;
    const { score, bmi, bmiClass } = this.wellnessScore(p, {
      weightKg: w,
      heightCm: h,
      weeklyActivityDays: weekly,
    });
    return {
      bmi,
      bmiClassification: bmiClass,
      wellnessScore: score,
      components: profile
        ? {
            bmi: this.bmiComponentScore(bmi),
            activity: this.activityComponentScore(profile.activityLevel),
            progress: this.progressComponentScore(profile, w),
            habits: this.habitsComponentScore(weekly),
          }
        : null,
      latestMetricAt: latest?.recordedAt ?? null,
    };
  }

  private async profileBaselineRow(userId: string) {
    const stored = await this.prisma.healthMetricSnapshot.findFirst({
      where: { userId, source: 'profile_baseline' },
      orderBy: { recordedAt: 'asc' },
      select: {
        recordedAt: true,
        weightKg: true,
        heightCm: true,
        weeklyActivityDays: true,
        wellnessScore: true,
        bmi: true,
      },
    });
    if (stored) return stored;

    const profile = await this.prisma.healthProfile.findUnique({
      where: { userId },
    });
    if (!profile) return null;
    const w = num(profile.weightKg);
    if (w == null && profile.weeklyActivityDays == null) return null;

    const h = num(profile.heightCm);
    const { score, bmi } = this.wellnessScore(profile, {
      weightKg: w,
      heightCm: h,
      weeklyActivityDays: profile.weeklyActivityDays,
    });

    return {
      recordedAt: profile.createdAt,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      weeklyActivityDays: profile.weeklyActivityDays,
      wellnessScore: score,
      bmi: bmi != null ? new Prisma.Decimal(Number(bmi.toFixed(2))) : null,
    };
  }

  private baselineWithinRange(
    baseline: { recordedAt: Date } | null,
    since: Date,
  ): boolean {
    return baseline != null && baseline.recordedAt >= since;
  }

  private mergeBaselineActivitySeries(
    series: Array<{
      t: string;
      weeklyActivityDays: number | null;
      isBaseline?: boolean;
    }>,
    baseline: {
      recordedAt: Date;
      weeklyActivityDays: number | null;
    } | null,
    since: Date,
  ) {
    if (!this.baselineWithinRange(baseline, since)) return series;
    if (baseline?.weeklyActivityDays == null) return series;
    const point = {
      t: baseline.recordedAt.toISOString(),
      weeklyActivityDays: baseline.weeklyActivityDays,
      isBaseline: true,
    };
    if (
      series.some(
        (p) =>
          p.t === point.t && p.weeklyActivityDays === point.weeklyActivityDays,
      )
    ) {
      return series.map((p) =>
        p.t === point.t ? { ...p, isBaseline: true } : p,
      );
    }
    return [point, ...series].sort((a, b) => a.t.localeCompare(b.t));
  }

  private async currentWeekActiveDaysFromLogs(
    userId: string,
  ): Promise<number | null> {
    const weekStart = weekStartUtc(new Date());
    const logs = await this.prisma.activityLog.findMany({
      where: { userId, activityAt: { gte: weekStart } },
      select: { activityAt: true },
    });
    if (!logs.length) return null;
    const days = new Set(
      logs.map((l) => l.activityAt.toISOString().slice(0, 10)),
    );
    return Math.min(7, days.size);
  }

  async activitySeries(userId: string, days: number) {
    const since = new Date(Date.now() - days * 86400000);
    const [rows, activityLogs, baseline] = await Promise.all([
      this.prisma.healthMetricSnapshot.findMany({
        where: {
          userId,
          recordedAt: { gte: since },
          weeklyActivityDays: { not: null },
        },
        orderBy: { recordedAt: 'asc' },
        select: { recordedAt: true, weeklyActivityDays: true, source: true },
      }),
      this.prisma.activityLog.findMany({
        where: { userId, activityAt: { gte: since } },
        select: { activityAt: true },
        orderBy: { activityAt: 'asc' },
      }),
      this.profileBaselineRow(userId),
    ]);

    const fromLogs = weeklyActiveDaysFromLogs(activityLogs);
    const logWeekKeys = new Set(fromLogs.map((p) => weekKeyFromIso(p.t)));

    const fromSnapshots = rows
      .filter(
        (r) => !logWeekKeys.has(weekKeyFromIso(r.recordedAt.toISOString())),
      )
      .map((r) => ({
        t: r.recordedAt.toISOString(),
        weeklyActivityDays: r.weeklyActivityDays,
        isBaseline: r.source === 'profile_baseline',
      }));

    const fromLogPoints = fromLogs.map((p) => ({
      ...p,
      isBaseline: false as boolean | undefined,
    }));

    const series = [...fromSnapshots, ...fromLogPoints].sort((a, b) =>
      a.t.localeCompare(b.t),
    );
    return this.mergeBaselineActivitySeries(series, baseline, since);
  }

  private mergeBaselineWeightSeries(
    series: Array<{ t: string; weightKg: number | null; isBaseline?: boolean }>,
    baseline: {
      recordedAt: Date;
      weightKg: Prisma.Decimal | null;
      source?: string;
    } | null,
    since: Date,
  ) {
    if (!this.baselineWithinRange(baseline, since)) return series;
    if (!baseline?.weightKg) return series;
    const w = num(baseline.weightKg);
    if (w == null) return series;
    const point = {
      t: baseline.recordedAt.toISOString(),
      weightKg: w,
      isBaseline: true,
    };
    if (series.some((p) => p.t === point.t && p.weightKg === point.weightKg)) {
      return series.map((p) =>
        p.t === point.t ? { ...p, isBaseline: true } : p,
      );
    }
    return [point, ...series].sort((a, b) => a.t.localeCompare(b.t));
  }

  private mergeBaselineWellnessSeries(
    series: Array<{
      t: string;
      wellnessScore: number | null;
      bmi: number | null;
      isBaseline?: boolean;
    }>,
    baseline: {
      recordedAt: Date;
      wellnessScore: number | null;
      bmi: Prisma.Decimal | null;
    } | null,
    since: Date,
  ) {
    if (!this.baselineWithinRange(baseline, since)) return series;
    if (!baseline?.wellnessScore) return series;
    const point = {
      t: baseline.recordedAt.toISOString(),
      wellnessScore: baseline.wellnessScore,
      bmi: baseline.bmi != null ? num(baseline.bmi) : null,
      isBaseline: true,
    };
    if (series.some((p) => p.t === point.t)) {
      return series.map((p) =>
        p.t === point.t ? { ...p, isBaseline: true } : p,
      );
    }
    return [point, ...series].sort((a, b) => a.t.localeCompare(b.t));
  }

  async weightSeries(userId: string, days: number) {
    const since = new Date(Date.now() - days * 86400000);
    const [rows, baseline] = await Promise.all([
      this.prisma.healthMetricSnapshot.findMany({
        where: {
          userId,
          recordedAt: { gte: since },
          weightKg: { not: null },
        },
        orderBy: { recordedAt: 'asc' },
        select: { recordedAt: true, weightKg: true, source: true },
      }),
      this.profileBaselineRow(userId),
    ]);
    const series = rows.map((r) => ({
      t: r.recordedAt.toISOString(),
      weightKg: num(r.weightKg),
      isBaseline: r.source === 'profile_baseline',
    }));
    return this.mergeBaselineWeightSeries(series, baseline, since);
  }

  async wellnessSeries(userId: string, days: number) {
    const since = new Date(Date.now() - days * 86400000);
    const [rows, baseline] = await Promise.all([
      this.prisma.healthMetricSnapshot.findMany({
        where: {
          userId,
          recordedAt: { gte: since },
          wellnessScore: { not: null },
        },
        orderBy: { recordedAt: 'asc' },
        select: {
          recordedAt: true,
          wellnessScore: true,
          bmi: true,
          source: true,
        },
      }),
      this.profileBaselineRow(userId),
    ]);
    const series = rows.map((r) => ({
      t: r.recordedAt.toISOString(),
      wellnessScore: r.wellnessScore,
      bmi: r.bmi != null ? num(r.bmi) : null,
      isBaseline: r.source === 'profile_baseline',
    }));
    return this.mergeBaselineWellnessSeries(series, baseline, since);
  }

  async progressSummaries(userId: string) {
    const now = Date.now();
    const weekStart = new Date(now - 7 * 86400000);
    const monthStart = new Date(now - 30 * 86400000);

    const [weekRows, monthRows] = await Promise.all([
      this.prisma.healthMetricSnapshot.findMany({
        where: { userId, recordedAt: { gte: weekStart } },
        orderBy: { recordedAt: 'asc' },
        select: { recordedAt: true, weightKg: true, wellnessScore: true },
      }),
      this.prisma.healthMetricSnapshot.findMany({
        where: { userId, recordedAt: { gte: monthStart } },
        orderBy: { recordedAt: 'asc' },
        select: { recordedAt: true, weightKg: true, wellnessScore: true },
      }),
    ]);

    const summarize = (
      rows: Array<{
        recordedAt: Date;
        weightKg: Prisma.Decimal | null;
        wellnessScore: number | null;
      }>,
    ) => {
      const firstWeight = rows.find((r) => r.weightKg != null)?.weightKg;
      const lastWeight = [...rows]
        .reverse()
        .find((r) => r.weightKg != null)?.weightKg;
      const firstScore = rows.find(
        (r) => r.wellnessScore != null,
      )?.wellnessScore;
      const lastScore = [...rows]
        .reverse()
        .find((r) => r.wellnessScore != null)?.wellnessScore;
      return {
        entries: rows.length,
        from: rows[0]?.recordedAt ?? null,
        to: rows[rows.length - 1]?.recordedAt ?? null,
        weightDeltaKg:
          firstWeight != null && lastWeight != null
            ? Number((num(lastWeight)! - num(firstWeight)!).toFixed(2))
            : null,
        wellnessDelta:
          firstScore != null && lastScore != null
            ? lastScore - firstScore
            : null,
      };
    };

    return {
      weekly: summarize(weekRows),
      monthly: summarize(monthRows),
    };
  }
}
