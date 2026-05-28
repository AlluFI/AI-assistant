import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { InsightsController } from './insights.controller';
import { InsightsAutomationService } from './insights-automation.service';
import { InsightsService } from './insights.service';

@Module({
  imports: [AuthModule, AnalyticsModule, MailModule],
  controllers: [InsightsController],
  providers: [InsightsService, InsightsAutomationService],
})
export class InsightsModule {}
