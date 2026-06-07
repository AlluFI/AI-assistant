/** Public readiness probe for wingman (GET /api/assistant/bootstrap). */
export type AssistantReadinessReport = {
  enabled: boolean;
  providers: {
    openAi: boolean;
    anthropic: boolean;
    gemini: boolean;
  };
  database: {
    assistantTables: boolean;
  };
};
