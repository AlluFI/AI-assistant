import { Module } from '@nestjs/common';
import { RecipeFeedbackModule } from '../recipe-feedback/recipe-feedback.module';
import { RagService } from './rag.service';

@Module({
  imports: [RecipeFeedbackModule],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
