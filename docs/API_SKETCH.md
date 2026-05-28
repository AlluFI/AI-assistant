# API sketch — Assistant

Base path (if embedded in main API): `/api/assistant`  
All routes: `JwtAuthGuard`, rate limited.

## Threads

```
POST   /assistant/threads
       → { id, createdAt }

GET    /assistant/threads
       → [{ id, title?, updatedAt, preview }]

GET    /assistant/threads/:threadId
       → { id, summary?, messages: [...] }

DELETE /assistant/threads/:threadId
```

## Messages

```
POST   /assistant/threads/:threadId/messages
       Body: { content: string }
       → AssistantMessage (may include uiBlocks, toolTraces)

       Optional query: ?stream=true
       → SSE: token deltas + final ui_blocks event
```

### Server-side loop (non-streaming)

1. Persist user message  
2. Build context: profile snapshot + thread summary + last N messages  
3. Call LLM with tool definitions  
4. While `tool_calls`: execute tools → append tool results → call LLM again (max 5 rounds)  
5. Persist assistant message + traces  
6. If token count high → async summarize thread  

## Context injection (every turn)

```json
{
  "profile": {
    "displayName": "…",
    "goal": "…",
    "dietaryRestrictions": [],
    "calorieTarget": 2000,
    "macroTargets": { "protein": 150, "carbs": 200, "fats": 65 }
  },
  "snapshot": {
    "todayIntake": { "calories": 1200, "…": "…" },
    "weeklyAvgDeficit": 150,
    "activeMealPlanId": "uuid-or-null"
  },
  "threadSummary": "User wants to increase protein; asked about weekend snacking."
}
```

No email, no internal ids in prompts unless needed for tool args.

## Tool definitions (OpenAI-style)

Mirror existing services — thin wrappers, no duplicate business logic.

```json
{
  "name": "get_trend",
  "description": "Calorie and macro trend for the last N days",
  "parameters": {
    "type": "object",
    "properties": {
      "days": { "type": "integer", "minimum": 7, "maximum": 90 }
    },
    "required": ["days"]
  }
}
```

## Errors

| Code | Meaning |
|------|---------|
| 429 | Rate limit |
| 503 | LLM unavailable → optional cached fallback message |
| 400 | Empty message / thread not found |

## Web UI (sketch)

- Floating panel or dedicated **Assistant** tab next to Overview / Nutrition  
- Message list + composer  
- Render `uiBlocks` inline (Recharts wrappers shared with dashboard)  
- “Suggested prompts” chips: “How am I doing this week?”, “Explain my deficit chart”
