# Security and AI Decisions

This document is a concise review companion for all "student can explain" criteria.

## AI Data and Personalization

- **PII removal impact**: We remove direct identifiers (name/email) from AI context and use a pseudonymous `user_id` to reduce privacy risk. This slightly reduces personalization granularity (no identity-linked personalization), but keeps recommendations meaningful via metrics, goals, and history.
- **Missing data impact**: When profile or metric fields are missing, context marks data completeness and fallback recommendations become more conservative and habit-focused.
- **Normalization impact**: Health metrics are stored and processed in standard units (kg, cm, weekly-day integers). This keeps scoring and chart rendering consistent and prevents unit-mismatch distortions.

## AI Quality and Hallucination Handling

- **Hallucination strategy**:
  - prompt constrains outputs to practical, non-medical guidance
  - strict JSON response format is enforced
  - recommendation structure is normalized before storing
  - dietary-restriction filtering removes incompatible suggestions
  - deterministic fallback exists when AI is unavailable
- **Response caching vs regeneration**:
  - regeneration: new model call using latest context
  - cached fallback: reuses most recent stored recommendations when AI provider is down or key is missing
- **Context length tradeoff**: More history improves continuity but increases token usage and latency; Parts 1–2 use bounded summary fields; Part 3 wingman uses **token-budget trimming** (`ASSISTANT_CONTEXT_*`) plus thread summaries from 8+ messages.
- **Zero-shot vs few-shot tradeoff**:
  - zero-shot is simpler and cheaper to iterate
  - few-shot improves consistency but increases prompt size and token cost
  - current approach uses few-shot examples in meal-plan steps (strategy + structure) and constrained JSON outputs.

## Model Selection Rationale

- **Model capability priorities**:
  - reliable structured output
  - moderate latency
  - stable instruction-following for safety constraints
- **Quality vs latency**:
  - default model favors practical speed for dashboard workflows
  - lower-temperature / moderate top-p settings are used where deterministic structure matters (planning/selection)
  - fallback path protects UX when model/API quality fluctuates.

## Security Decisions

- **JWT access-token duration**:
  - short-lived access token limits exposure window if leaked
  - refresh token rotation supports continuity without long access-token lifetime
  - reuse detection on refresh family improves incident containment.
- **Rate limiting / abuse prevention**:
  - throttler applies limits to sensitive auth endpoints and APIs
  - rapid-fire requests are constrained by endpoint-level policies.

## Data Visualization Rationale

- **Library tradeoffs (Recharts)**:
  - pros: quick implementation, composable charts, responsive containers
  - cons: bundle size considerations and limited advanced annotation defaults.
- **Visualization choices and user understanding**:
  - top-level summary cards provide immediate status
  - trend lines support progress interpretation
  - goal reference line improves target awareness
  - priority badges and expandable insights prevent information overload.
