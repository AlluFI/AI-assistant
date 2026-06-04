import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/validate-env';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { ProfileModule } from './profile/profile.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { InsightsModule } from './insights/insights.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { NutritionToolsModule } from './nutrition-tools/nutrition-tools.module';
import { RagModule } from './rag/rag.module';
import { RecipeFeedbackModule } from './recipe-feedback/recipe-feedback.module';
import { RecipesModule } from './recipes/recipes.module';
import { MealPlansModule } from './meal-plans/meal-plans.module';
import { ShoppingListsModule } from './shopping-lists/shopping-lists.module';
import { NutritionAnalyticsModule } from './nutrition-analytics/nutrition-analytics.module';
import { AiModule } from './ai/ai.module';
import { AssistantModule } from './assistant/assistant.module';
import { MealPhotosModule } from './meal-photos/meal-photos.module';
import { DailyWellnessModule } from './daily-wellness/daily-wellness.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    RedisModule,
    PrismaModule,
    MailModule,
    UsersModule,
    AuthModule,
    ProfileModule,
    AnalyticsModule,
    InsightsModule,
    NutritionModule,
    NutritionToolsModule,
    RagModule,
    RecipesModule,
    RecipeFeedbackModule,
    MealPlansModule,
    ShoppingListsModule,
    NutritionAnalyticsModule,
    AiModule,
    AssistantModule,
    MealPhotosModule,
    DailyWellnessModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
