import type { PrismaService } from '../prisma/prisma.service';
import type { MacroNutrition } from '../shared/units';
import { addMacros, emptyMacros } from '../shared/units';

function parseNutrition(raw: unknown): MacroNutrition | null {
  const n = raw as MacroNutrition;
  if (!n || typeof n.calories !== 'number') return null;
  return n;
}

export type AdherenceSummary = {
  days: number;
  mealsPlanned: number;
  mealsEaten: number;
  manualLogs: number;
  adherencePercent: number | null;
};

export type StreakSummary = {
  proteinTargetDays: number;
  loggingDays: number;
};

export async function computeAdherence(
  prisma: PrismaService,
  userId: string,
  days: number,
  countPlanned: (uid: string, date: string) => Promise<number>,
  countEaten: (uid: string, date: string) => Promise<number>,
  countManualLogs: (uid: string, date: string) => Promise<number>,
): Promise<AdherenceSummary> {
  const span = Math.min(14, Math.max(1, Math.round(days)));
  let mealsPlanned = 0;
  let mealsEaten = 0;
  let manualLogs = 0;

  for (let i = 0; i < span; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    mealsPlanned += await countPlanned(userId, date);
    mealsEaten += await countEaten(userId, date);
    manualLogs += await countManualLogs(userId, date);
  }

  const adherencePercent =
    mealsPlanned > 0
      ? Math.min(100, Math.round((mealsEaten / mealsPlanned) * 100))
      : null;

  return {
    days: span,
    mealsPlanned,
    mealsEaten,
    manualLogs,
    adherencePercent,
  };
}

export async function computeStreaks(
  prisma: PrismaService,
  userId: string,
  proteinTarget: number,
  sumIntakeOnDate: (uid: string, date: string) => Promise<MacroNutrition>,
  hasLoggingOnDate: (uid: string, date: string) => Promise<boolean>,
  maxDays = 30,
): Promise<StreakSummary> {
  const target = Math.max(40, proteinTarget);
  let proteinTargetDays = 0;
  let loggingDays = 0;

  for (let i = 0; i < maxDays; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const intake = await sumIntakeOnDate(userId, date);
    if (intake.protein >= target * 0.9) {
      proteinTargetDays++;
    } else {
      break;
    }
  }

  for (let i = 0; i < maxDays; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const logged = await hasLoggingOnDate(userId, date);
    if (logged) {
      loggingDays++;
    } else {
      break;
    }
  }

  return { proteinTargetDays, loggingDays };
}

export function sumLogNutrition(logs: Array<{ nutrition: unknown }>): MacroNutrition {
  let total = emptyMacros();
  for (const log of logs) {
    const n = parseNutrition(log.nutrition);
    if (n) total = addMacros(total, n);
  }
  return total;
}
