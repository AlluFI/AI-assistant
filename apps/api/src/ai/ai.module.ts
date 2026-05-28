import { Module } from '@nestjs/common';
import { NutritionToolsModule } from '../nutrition-tools/nutrition-tools.module';
import { AnthropicClientService } from './llm/anthropic-client.service';
import { AnthropicWingmanService } from './llm/anthropic-wingman.service';
import { AssistantLlmService } from './llm/assistant-llm.service';
import { OpenAiWingmanService } from './llm/openai-wingman.service';
import { WingmanLlmFacade } from './llm/wingman-llm.facade';
import { OpenAiClientService } from './openai-client.service';

@Module({
  imports: [NutritionToolsModule],
  providers: [
    OpenAiClientService,
    AnthropicClientService,
    AssistantLlmService,
    OpenAiWingmanService,
    AnthropicWingmanService,
    WingmanLlmFacade,
  ],
  exports: [
    OpenAiClientService,
    AssistantLlmService,
    OpenAiWingmanService,
    AnthropicWingmanService,
    WingmanLlmFacade,
  ],
})
export class AiModule {}
