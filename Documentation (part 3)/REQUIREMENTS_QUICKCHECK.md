# Part 3 — Requirements quick check

Fast pass/fail for reviewers and self-review before submission.  
Mark `[x]` when verified; add evidence in **Notes**.

**Status overview:** [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)  
**Detailed criteria:** [PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md](./PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md)  
**API/UI steps:** [TEST_MATRIX_PART3.md](./TEST_MATRIX_PART3.md)

---

## A) Review setup

- [ ] Docker one-command startup (`pnpm compose:up`)
- [ ] Web / API / Mailpit reachable (`:8080`, `:3000/docs`, `:8025`)
- [ ] Demo user or fresh account works
- [ ] `pnpm verify` passes (or documented exceptions)
- [ ] README covers full app (Parts 1–3) + wingman

Notes:

---

## B) Documentation (mandatory)

- [ ] System prompt engineering strategy documented
- [ ] AI model selection rationale (Parts 1–2 vs wingman)
- [ ] Conversation management approach (threads, context, summaries)
- [ ] Error handling methods
- [ ] Function calling implementation details

Notes:

---

## C) Conversation layer

- [ ] Floating / accessible chat UI with message history
- [ ] Multi-turn: ≥ 3 turns without losing messages in DB
- [ ] Close and reopen chat — history continues *(target; verify)*
- [ ] Empty input handled gracefully
- [ ] Very long / special character input handled
- [ ] Malformed input does not corrupt thread state

Notes:

---

## D) Health profile access (mandatory)

- [ ] BMI, weight, wellness score, activity level, goals accessible via assistant
- [ ] No email, DOB, passwords, other users' data
- [ ] Jailbreak prompts tested (admin mode, other user ID, etc.)
- [ ] Multi-metric question → unified answer (weight + BMI)
- [ ] Trend interpretation, not only raw numbers
- [ ] "What are my fitness goals?" → user-specific goals
- [ ] Wellness improvement question uses score components

Notes:

---

## E) Nutrition access (mandatory)

- [ ] Today's meal plan listing
- [ ] Tonight's dinner → ingredients + steps
- [ ] Protein/calories vs target for week/day
- [ ] Dietary restrictions respected in recommendations

Notes:

---

## F) Six conversation types

- [ ] Health metrics queries
- [ ] Progress questions
- [ ] Meal plan inquiries
- [ ] Recipe information
- [ ] Nutritional analysis
- [ ] General wellness (with boundaries)

Notes:

---

## G) Multi-turn & formatting

- [ ] Follow-up: "Can you tell me more about that?"
- [ ] Reference: breakfast → "Is that enough protein?"
- [ ] Week meal plan scannable (days, bullets)
- [ ] Medical escalation (e.g. chest pain when exercising)
- [ ] Units: kg, cm, kcal, g throughout

Notes:

---

## H) Data access layer & architecture

- [ ] Health + nutrition data in same conversation from real APIs
- [ ] Missing data date → clear message, no fabrication
- [ ] Student can trace one message end-to-end
- [ ] Auth required for all private data paths

Notes:

---

## I) GenAI — system prompt & tools

- [ ] System prompt: role, capabilities, boundaries, domain terms
- [ ] Format examples in prompt; responses match style
- [ ] Ethical / safety guidelines visible in outputs
- [ ] ≥ 4 distinct function calls implemented
- [ ] Invalid tool parameters rejected before DB access
- [ ] ≥ 5 turns context with follow-ups
- [ ] Student explains model + temperature / top-p

Notes:

---

## J) Actions & reminders (product)

- [ ] Wingman nudges for weekly weight (when due)
- [ ] Wingman nudges for activity (when due)
- [ ] Log activity via chat with **confirm** (e.g. 1 h tennis)
- [ ] Log weight via chat with **confirm**

Notes:

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

Notes:

---

## L) Deliverables demo

- [ ] Full system demo (Parts 1–3)
- [ ] Design choices explained
- [ ] Integration with Parts 1–2 explained
- [ ] Challenges & tradeoffs discussed

Notes:

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
| K Extra | | 8 |
| L Demo | | 4 |

*Update totals if you add rows.*
