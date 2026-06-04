import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module';
import { RecipeFeedbackModule } from '../recipe-feedback/recipe-feedback.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [ProfileModule, RecipeFeedbackModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
