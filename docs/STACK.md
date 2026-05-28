# Stack & LLM providers

## Why OpenAI is used for Parts 1–2

This monorepo already uses OpenAI for:

- Structured JSON (meal plan steps, insights)
- Function calling (nutrition tools, scaling)
- RAG-augmented recipe selection

Phase 3 should **not** assume OpenAI is the only option — but **defaulting to OpenAI** reduces integration risk for the course timeline.

## Provider-agnostic interface

```typescript
interface LlmClient {
  chat(params: ChatParams): Promise<ChatResult>
  chatWithTools(params: ToolChatParams): Promise<ToolChatResult>
  embed(text: string): Promise<number[]>
}
```

Implementations: `OpenAiLlmClient`, later `AnthropicLlmClient`, `MistralLlmClient`, etc.

## Comparison (for this product)

| Provider | Best fit here | Tradeoff |
|----------|---------------|----------|
| [OpenAI](https://platform.openai.com) | Tool calling, JSON, already integrated | US API; cost at scale |
| Anthropic (Claude) | Long coaching conversations, tone | New client + eval |
| Google (Gemini) | Price/context; future food images | Different API surface |
| Mistral | EU-friendly, cost | Tool calling needs thorough testing |
| Azure OpenAI | Same models, EU data residency | Extra setup |
| Self-hosted (Llama, etc.) | Data on your infra | Ops + weaker tools unless tuned |

## Recommended model tiers (any provider)

| Task | Tier | Notes |
|------|------|-------|
| Intent routing | Rules → mini model | Avoid LLM if regex covers 80% |
| Wingman reply | Mid/frontier | Quality bar for coaching |
| Thread summarization | Mini | Cheap, runs async |
| Meal plan / batch jobs | Stay in main app | Already sequential + RAG |
| Embeddings | Same vendor as recipe RAG | Consistency |

## Multi-model myth

Three **frontier** models for “analyst / coach / wingman” usually adds cost and inconsistency. Prefer:

- **Zero LLM** for analyst (SQL + charts)
- **One** conversational model with mode-specific system prompt addenda
- **Optional** second **small** model for routing only

## Decision log (fill as you build)

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-28 | Parts 1–2 stay on OpenAI | Already in `apps/api` |
| 2026-05-28 | Part 3 wingman → Anthropic | Coaching tone; separate from meal-plan JSON path |
| 2026-05-28 | Meal photos → Gemini (later) | Vision-only task; calories via DB after user confirm |
| 2026-05-28 | Single submission repo | Full app copied from counting-calories; Part 3 built here |
| TBD | Streaming vs full response | |
