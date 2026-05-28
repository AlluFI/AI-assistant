import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { InsightsService } from './insights.service';

@Injectable()
export class InsightsAutomationService {
  private readonly logger = new Logger(InsightsAutomationService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
    private readonly mail: MailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runAutomationTick() {
    if (this.running) return;
    this.running = true;
    try {
      const settings = await this.prisma.privacySettings.findMany({
        where: {
          OR: [
            { insightCadence: { in: ['daily', 'weekly'] } },
            {
              emailNotifications: true,
              reminderChannel: 'email',
              OR: [
                { weightReminderEnabled: true },
                { activityReminderCadence: { in: ['daily', 'weekly'] } },
              ],
            },
          ],
        },
        include: {
          user: {
            select: { id: true, email: true, displayName: true },
          },
        },
      });

      for (const pref of settings) {
        await this.processInsightCadence(pref);
        await this.processReminders(pref);
      }
    } catch (error) {
      this.logger.error(
        `Automation tick failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async processInsightCadence(pref: {
    userId: string;
    insightCadence: string;
    lastAutoInsightAt: Date | null;
  }) {
    if (pref.insightCadence !== 'daily' && pref.insightCadence !== 'weekly') {
      return;
    }
    const intervalMs =
      pref.insightCadence === 'daily'
        ? 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;
    const lastAt = pref.lastAutoInsightAt?.getTime() ?? 0;
    if (Date.now() - lastAt < intervalMs) return;

    const historyDays = pref.insightCadence === 'daily' ? 7 : 30;
    await this.insights.generate(pref.userId, historyDays);
    await this.prisma.privacySettings.update({
      where: { userId: pref.userId },
      data: { lastAutoInsightAt: new Date() },
    });
  }

  private async processReminders(pref: {
    userId: string;
    emailNotifications: boolean;
    reminderChannel: string;
    weightReminderEnabled: boolean;
    activityReminderCadence: string;
    lastWeightReminderAt: Date | null;
    lastActivityReminderAt: Date | null;
    user: { email: string; displayName: string | null };
  }) {
    if (!pref.emailNotifications || pref.reminderChannel !== 'email') return;
    const [latestWeight, latestActivity] = await Promise.all([
      this.prisma.healthMetricSnapshot.findFirst({
        where: { userId: pref.userId, weightKg: { not: null } },
        orderBy: { recordedAt: 'desc' },
        select: { recordedAt: true },
      }),
      this.prisma.activityLog.findFirst({
        where: { userId: pref.userId },
        orderBy: { activityAt: 'desc' },
        select: { activityAt: true },
      }),
    ]);
    const now = Date.now();
    if (pref.weightReminderEnabled) {
      const dueByMetric =
        !latestWeight ||
        now - latestWeight.recordedAt.getTime() >= 7 * 24 * 60 * 60 * 1000;
      const notRecentlyReminded =
        !pref.lastWeightReminderAt ||
        now - pref.lastWeightReminderAt.getTime() >= 7 * 24 * 60 * 60 * 1000;
      if (dueByMetric && notRecentlyReminded) {
        await this.mail.sendWellnessReminderEmail(
          pref.user.email,
          'Weekly reminder: record your weight',
          `Hi ${pref.user.displayName ?? 'there'},\n\nThis is your weekly reminder to record your weight in Numbers Dont Lie so your trend and insights stay accurate.\n\nOpen the dashboard and use the Record tab.\n`,
        );
        await this.prisma.privacySettings.update({
          where: { userId: pref.userId },
          data: { lastWeightReminderAt: new Date() },
        });
      }
    }
    if (
      pref.activityReminderCadence === 'daily' ||
      pref.activityReminderCadence === 'weekly'
    ) {
      const cadenceMs =
        pref.activityReminderCadence === 'daily'
          ? 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000;
      const dueByActivity =
        !latestActivity ||
        now - latestActivity.activityAt.getTime() >= cadenceMs;
      const notRecentlyReminded =
        !pref.lastActivityReminderAt ||
        now - pref.lastActivityReminderAt.getTime() >= cadenceMs;
      if (dueByActivity && notRecentlyReminded) {
        await this.mail.sendWellnessReminderEmail(
          pref.user.email,
          `${
            pref.activityReminderCadence === 'daily' ? 'Daily' : 'Weekly'
          } reminder: log an activity`,
          `Hi ${pref.user.displayName ?? 'there'},\n\nQuick ${
            pref.activityReminderCadence === 'daily' ? 'daily' : 'weekly'
          } reminder to log at least one activity in Numbers Dont Lie.\n\nOpen the dashboard and use the Record tab.\n`,
        );
        await this.prisma.privacySettings.update({
          where: { userId: pref.userId },
          data: { lastActivityReminderAt: new Date() },
        });
      }
    }
  }
}
