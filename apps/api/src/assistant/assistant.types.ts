/** Checklist area in this monorepo (not a second git repo). */
export type RepoOwner = 'code' | 'docs' | 'both';

export type ChecklistStatus = 'done' | 'stub' | 'todo';

export type Phase3ChecklistItem = {
  id: string;
  title: string;
  owner: RepoOwner;
  status: ChecklistStatus;
  notes?: string;
};

export type Phase3BootstrapReport = {
  phase: 'bootstrap';
  designRepo: string;
  enabled: boolean;
  providers: {
    parts12OpenAi: boolean;
    assistantAnthropic: boolean;
    visionGemini: boolean;
  };
  database: {
    assistantTables: boolean;
  };
  checklist: Phase3ChecklistItem[];
};
