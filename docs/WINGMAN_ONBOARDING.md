# Wingman setup wizard

New users complete initial setup **in the Wingman chat** after the consent modal (consent stays a separate legal step).

## Flow

1. **Health basics** — age, height (cm), weight (kg), activity level, fitness goal (free-text or `update_health_profile` tool).
2. **Calorie & macros** — confirm **AI recommend** or **formula** targets.
3. **Meal schedule** — snack count (0–2) or **default schedule** (3 meals, standard UTC times).

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/assistant/onboarding` | `{ active, step, steps, percentComplete, opener }` |
| `POST /api/assistant/onboarding/skip` | Dismiss wizard (`wingmanOnboardingSkippedAt`) |

Confirm actions (same as other wingman writes): `confirm_onboarding_ai_targets`, `confirm_onboarding_formula_targets`, `confirm_onboarding_meal_defaults`, `confirm_onboarding_skip`.

## Web

- Wingman opens automatically when `active` is true.
- Progress chips in the chat header; **Skip setup** in the header.
- Coaching mode `onboarding` on the setup thread.

## Tools

- `update_health_profile` — save profile fields during setup.
- Existing `update_nutrition_targets` / `update_nutrition_preferences` for steps 2–3.
