export type MemoryFactCategory =
  | 'preference'
  | 'goal'
  | 'habit'
  | 'constraint'
  | 'note';

export type AssistantMemoryFact = {
  category: MemoryFactCategory;
  text: string;
  updatedAt?: string;
};

export type AssistantUserMemoryPayload = {
  narrative: string | null;
  facts: AssistantMemoryFact[];
  updatedAt: string;
};
