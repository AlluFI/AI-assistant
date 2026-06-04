# Part 3 — Requirements quick check

Fast pass/fail for reviewers and self-review before submission.  
Mark `[x]` when **verified in your environment** (live demo or test).  
**Code audit (2026-05-28):** see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for what is already built in the repo.

**Detailed criteria:** [PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md](./PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md)  
**API/UI steps:** [TEST_MATRIX_PART3.md](./TEST_MATRIX_PART3.md)

---

## A) Review setup

- [ ] Docker one-command startup (`pnpm compose:up`)
- [ ] Web / API / Mailpit reachable (`:8080`, `:3000/docs`, `:8025`)
- [ ] Demo user or fresh account works
- [ ] `pnpm verify` passes (or documented exceptions)
- [ ] README covers full app (Parts 1–3) + wingman

**Built in repo:** Compose stack, seeds, README Phase 3 section.  
**Notes:** Put `ANTHROPIC_API_KEY` (or OpenAI wingman) in **repo root** `.env` for Docker; copy `.env.example` as template.

---

## B) Documentation (mandatory)

- [ ] System prompt engineering strategy documented
- [ ] AI model selection rationale (Parts 1–2 vs wingman)
- [ ] Conversation management approach (threads, context, summaries)
- [ ] Error handling methods
- [ ] Function calling implementation details

**Built in repo:** `docs/PROMPT_ENGINEERING.md`, `docs/STACK.md`, `docs/ARCHITECTURE.md`, `docs/LONG_TERM_MEMORY.md`.

---

## C) Conversation layer

- [ ] Floating / accessible chat UI with message history
- [ ] Multi-turn: ≥ 3 turns without losing messages in DB
- [ ] Close and reopen chat — history continues
- [ ] Empty input handled gracefully
- [ ] Very long / special character input handled
- [ ] Malformed input does not corrupt thread state

**Built in repo:** `WingmanChat.tsx`, Prisma threads, `@MaxLength(8000)` on content, empty blocked in UI/API.

---

## D) Health profile access (mandatory)

- [ ] BMI, weight, wellness score, activity level, goals accessible via assistant
- [ ] No email, DOB, passwords, other users' data
- [ ] Jailbreak prompts tested (admin mode, other user ID, etc.)
- [ ] Multi-metric question → unified answer (weight + BMI)
- [ ] Trend interpretation, not only raw numbers
- [ ] "What are my fitness goals?" → user-specific goals
- [ ] Wellness improvement question uses score components

**Built in repo:** `get_health_metrics`, `get_progress_summary`; PII/medical rules in `assistant-wingman.service.ts`.

---

## E) Nutrition access (mandatory)

- [ ] Today's meal plan listing
- [ ] Tonight's dinner → ingredients + steps
- [ ] Protein/calories vs target for week/day
- [ ] Dietary restrictions respected in recommendations

**Built in repo:** `get_meal_plan`, `get_recipe`, `get_nutrition_summary`, `search_recipes`.

---

## F) Six conversation types

- [ ] Health metrics queries
- [ ] Progress questions
- [ ] Meal plan inquiries
- [ ] Recipe information
- [ ] Nutritional analysis
- [ ] General wellness (with boundaries)

**Built in repo:** Few-shots in `docs/PROMPT_EXAMPLES.md`; eval cases in `wingman-golden-set.json`.

---

## G) Multi-turn & formatting

- [ ] Follow-up: "Can you tell me more about that?"
- [ ] Reference: breakfast → "Is that enough protein?"
- [ ] Week meal plan scannable (days, bullets)
- [ ] Medical escalation (e.g. chest pain when exercising)
- [ ] Units: kg, cm, kcal, g throughout

**Built in repo:** Formatting + safety in system prompt; medical keyword guard.

---

## H) Data access layer & architecture

- [ ] Health + nutrition data in same conversation from real APIs
- [ ] Missing data date → clear message, no fabrication
- [ ] Student can trace one message end-to-end
- [ ] Auth required for all private data paths

**Built in repo:** `toolTraces` on messages; JWT on all assistant routes.

---

## I) GenAI — system prompt & tools

- [ ] System prompt: role, capabilities, boundaries, domain terms
- [ ] Format examples in prompt; responses match style
- [ ] Ethical / safety guidelines visible in outputs
- [ ] ≥ 4 distinct function calls implemented
- [ ] Invalid tool parameters rejected before DB access
- [ ] ≥ 5 turns context with follow-ups
- [ ] Student explains model + temperature / top-p

**Built in repo:** 9 tools (incl. `update_nutrition_targets`); `pnpm wingman:eval` 18/18; docs in `PROMPT_ENGINEERING.md`.

---

## J) Actions & reminders (product)

- [ ] Wingman nudges for weekly weight (when due)
- [ ] Wingman nudges for activity (when due)
- [ ] Log activity via chat with **confirm** (e.g. 1 h tennis)
- [ ] Log weight via chat with **confirm**

**Built in repo:** `GET /assistant/nudges`, confirm actions endpoint.

---

## K) Extra

- [ ] Docker-only reviewer path confirmed
- [ ] NL → line chart (weight trend)
- [ ] NL → bar chart (protein vs target)
- [ ] NL → pie chart (macros today)
- [ ] Proactive chart suggestion in conversation
- [ ] History compression after 10+ turns
- [ ] Dynamic context on topic shift
- [ ] Graceful AI outage fallback
- [ ] Bonus features documented

**Built in repo:** Charts, summary at 12+ msgs, `IMPLEMENTATION_STATUS.md` bonus table; meal photos + streaming documented.

---

## L) Deliverables demo

- [ ] Full system demo (Parts 1–3)
- [ ] Design choices explained
- [ ] Integration with Parts 1–2 explained
- [ ] Challenges & tradeoffs discussed

**Prep:** [REVIEW_CHECKLIST_PART3.md](./REVIEW_CHECKLIST_PART3.md), `docs/STACK.md`.

---

## Summary counts

| Section | Checked | Total |
|---------|---------|-------|
| A Setup | | 5 |
| B Docs | | 5 |
| C Conversation layer | | 6 |
| D Health | | 7 |
| E Nutrition | | 4 |
| F Conversation types | | 6 |
| G Multi-turn | | 5 |
| H Data layer | | 4 |
| I GenAI | | 7 |
| J Actions | | 4 |
| K Extra | | 9 |
| L Demo | | 4 |

*Totals are for reviewer use — check boxes during your run-through.*
