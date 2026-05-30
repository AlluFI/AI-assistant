import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RecipeFeedbackController } from './recipe-feedback.controller';
import { RecipeCommunityService } from './recipe-community.service';
import { RecipeFeedbackService } from './recipe-feedback.service';

@Module({
  imports: [AuthModule],
  controllers: [RecipeFeedbackController],
  providers: [RecipeFeedbackService, RecipeCommunityService],
  exports: [RecipeFeedbackService, RecipeCommunityService],
})
export class RecipeFeedbackModule {}
