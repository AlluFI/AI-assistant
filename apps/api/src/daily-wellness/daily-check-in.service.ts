import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  UpsertDailyCheckInDto,
  WearableDemoSyncDto,
} from './dto/upsert-daily-check-in.dto';

@Injectable()
export class DailyCheckInService {
  constructor(private readonly prisma: PrismaService) {}

  todayDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async getForDate(userId: string, date?: string) {
    const d = date ?? this.todayDate();
    const row = await this.prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date: d } },
    });
    return row ?? null;
  }

  async upsert(userId: string, dto: UpsertDailyCheckInDto) {
    const date = dto.date ?? this.todayDate();
    const data: {
      sleepHours?: number | null;
      waterGlasses?: number | null;
      mood?: number | null;
      steps?: number | null;
      source?: string;
    } = { source: 'user' };

    if (dto.sleepHours !== undefined) data.sleepHours = dto.sleepHours;
    if (dto.waterGlasses !== undefined) data.waterGlasses = dto.waterGlasses;
    if (dto.mood !== undefined) data.mood = dto.mood;
    if (dto.steps !== undefined) {
      data.steps = dto.steps != null ? Math.round(dto.steps) : null;
    }

    return this.prisma.dailyCheckIn.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        sleepHours: dto.sleepHours ?? null,
        waterGlasses: dto.waterGlasses ?? null,
        mood: dto.mood ?? null,
        steps: dto.steps != null ? Math.round(dto.steps) : null,
        source: 'user',
      },
      update: data,
    });
  }

  async syncWearableDemo(userId: string, dto: WearableDemoSyncDto) {
    const date = dto.date ?? this.todayDate();
    const steps = dto.steps != null ? Math.round(dto.steps) : undefined;
    const sleepHours = dto.sleepHours;

    return this.prisma.dailyCheckIn.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        steps: steps ?? null,
        sleepHours: sleepHours ?? null,
        source: 'wearable_demo',
      },
      update: {
        steps: steps ?? undefined,
        sleepHours: sleepHours ?? undefined,
        source: 'wearable_demo',
      },
    });
  }
}
