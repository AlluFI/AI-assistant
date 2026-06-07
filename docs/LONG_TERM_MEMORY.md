# Long-term wingman memory

Cross-session memory persists **per user** (not per chat thread). It complements **thread memory** (`AssistantThread.summary` + token-trimmed recent turns), which only covers the current conversation.

## Thread vs cross-session UI

| UI control | Scope | API |
|------------|-------|-----|
| **History** (Wingman header) | Past chat threads — list, switch, **New chat** | `GET /api/assistant/threads` |
| **Memory** (Wingman panel) | Long-term preferences/goals across threads | `GET/DELETE /api/assistant/memory` |

Do not confuse thread History with cross-session Memory.

## Storage

- Table: `AssistantUserMemory` (`userId`, `narrative`, `facts` JSON)
- Facts: `{ category, text }` where category is `preference` | `goal` | `habit` | `constraint` | `note`

## When it updates

After each wingman reply, `maybeConsolidate` runs in the background when:

- At least **4** new user messages since last update (`ASSISTANT_MEMORY_MIN_NEW_MESSAGES`), or
- **24 hours** since last update, or
- First memory row is created after **2** user messages (with profile seed if available)

Consolidation uses:

1. Rule-based extraction from recent user lines (e.g. “I don't like …”, “My goal is …”)
2. LLM merge (when `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set) into narrative + facts

## Prompt injection

`buildLlmContext` adds a **Long-term memory** section to the system prompt. Recent turns are trimmed by **estimated token budget** (`ASSISTANT_CONTEXT_*` — see `docs/PROMPT_ENGINEERING.md` and `wingman-context.util.ts`). When turns are dropped and no thread summary exists yet, `ThreadSummaryService` runs (from **8+** messages). The model must still call tools for live metrics.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/assistant/memory` | View memory |
| DELETE | `/api/assistant/memory` | Clear all memory |

## Env

```env
ASSISTANT_MEMORY_ENABLED=true
ASSISTANT_MEMORY_MIN_NEW_MESSAGES=4
```

## Privacy

- Never stores email, password, or DOB (enforced in prompts and extractors)
- Cleared with `DELETE /api/assistant/memory`
- User row deleted on account cascade

## Demo

1. In Wingman: “I don't like cilantro and I'm trying to cut carbs”
2. Tap **History** → **New chat**, then ask: “What do you remember about my food preferences?”
3. Open **Memory** in the wingman panel to inspect or clear (cross-session facts, not thread list)
