# Part 3 — Implementation status vs requirements

Legend: ✅ Done · 🟡 Partial · ⬜ Not started

| Area | Requirement | Status | Where |
|------|-------------|--------|--------|
| **Docs** | Requirements + testing criteria | ✅ | `Documentation (part 3)/` |
| **Docs** | Prompt + few-shots | ✅ | `docs/PROMPT_EXAMPLES.md`, `PROMPT_ENGINEERING.md` |
| **UI** | Floating chat + persisted history | ✅ | `apps/web/src/wingman/` |
| **UI** | Charts in chat (line / bar / pie) | ✅ | `WingmanChart.tsx` + `ui_blocks` |
| **UI** | Streaming replies (SSE) | ✅ | `VITE_ASSISTANT_STREAMING` |
| **UI** | Starter prompts (mode-aware) | ✅ | `WingmanChat` + `coachingMode` |
| **UI** | Tab CTAs (Record, Nutrition, Insights) | ✅ | `open_*` actions |
| **UI** | Coaching mode toggle | ✅ | Balanced / Nutrition / Wellness |
| **API** | 7 data tools + validation | ✅ | + `search_recipes` |
| **API** | LLM tool loop (OpenAI / Anthropic) | ✅ | `WingmanLlmFacade` |
| **API** | SSE stream endpoint | ✅ | `POST .../messages/stream` |
| **API** | LLM thread summary | ✅ | `ThreadSummaryService` |
| **API** | Confirm actions (log, meal, shopping) | ✅ | Confirm endpoint |
| **API** | Golden eval set | ✅ | `pnpm wingman:eval` |
| **API** | Long-term cross-session memory | ✅ | `AssistantUserMemory`, `docs/LONG_TERM_MEMORY.md` |
| **API** | Medical / PII guardrails | 🟡 | Keywords + prompt |

## Env (reviewer)

```env
ASSISTANT_STREAMING=true
ASSISTANT_SUMMARY_MODE=llm
VITE_ASSISTANT_STREAMING=true
```

## Demo prompts

See Phase 3 list in prior docs; add: ask a long question and watch tokens stream in the chat bubble.
