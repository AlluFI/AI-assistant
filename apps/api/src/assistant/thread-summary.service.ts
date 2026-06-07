import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WingmanLlmFacade } from '../ai/llm/wingman-llm.facade';

@Injectable()
export class ThreadSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly llm: WingmanLlmFacade,
  ) {}

  async maybeUpdate(threadId: string) {
    const count = await this.prisma.assistantMessage.count({
      where: { threadId },
    });
    if (count < 8) return;

    const messages = await this.prisma.assistantMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { role: true, content: true },
    });

    const mode =
      this.config.get<string>('ASSISTANT_SUMMARY_MODE')?.toLowerCase() ?? 'llm';
    let summary: string;

    if (mode === 'llm' && this.llm.isConfigured()) {
      const llmSummary = await this.llm.summarizeConversation(messages);
      summary =
        llmSummary?.trim() ||
        this.ruleBasedSummary(
          messages.filter((m) => m.role === 'user').map((m) => m.content),
        );
    } else {
      summary = this.ruleBasedSummary(
        messages.filter((m) => m.role === 'user').map((m) => m.content),
      );
    }

    await this.prisma.assistantThread.update({
      where: { id: threadId },
      data: { summary: summary.slice(0, 500) },
    });
  }

  private ruleBasedSummary(userLines: string[]) {
    const userTopics = userLines.map((c) => c.trim().slice(0, 80)).slice(-6);
    return `Recent topics: ${userTopics.join('; ')}`.slice(0, 500);
  }
}
