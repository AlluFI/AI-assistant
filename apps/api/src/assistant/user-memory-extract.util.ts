import type {
  AssistantMemoryFact,
  MemoryFactCategory,
} from './user-memory.types';

const MAX_FACTS = 20;
const MAX_FACT_LEN = 160;

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 60);
}

function addFact(
  map: Map<string, AssistantMemoryFact>,
  category: MemoryFactCategory,
  text: string,
) {
  const trimmed = text.trim().slice(0, MAX_FACT_LEN);
  if (trimmed.length < 4) return;
  map.set(`${category}:${slug(trimmed)}`, {
    category,
    text: trimmed,
    updatedAt: new Date().toISOString(),
  });
}

/** Rule-based extraction from user chat lines (no LLM). */
export function extractMemoryFactsFromMessages(
  lines: string[],
): AssistantMemoryFact[] {
  const map = new Map<string, AssistantMemoryFact>();

  for (const raw of lines) {
    const text = raw.trim();
    if (text.length < 8) continue;
    const lower = text.toLowerCase();

    if (/email|password|date of birth|\bdob\b/i.test(lower)) continue;

    const dislike = lower.match(
      /\b(?:i\s+)?(?:don't|do not|dont)\s+like\s+(.{3,80})/i,
    );
    if (dislike) {
      addFact(map, 'preference', `Dislikes ${dislike[1].trim()}`);
      continue;
    }

    const prefer = lower.match(/\bi\s+prefer\s+(.{3,80})/i);
    if (prefer) {
      addFact(map, 'preference', `Prefers ${prefer[1].trim()}`);
      continue;
    }

    const allergic = lower.match(
      /\b(?:allergic to|allergy to|can't eat|cannot eat)\s+(.{3,80})/i,
    );
    if (allergic) {
      addFact(map, 'constraint', `Avoids ${allergic[1].trim()}`);
      continue;
    }

    const goal = lower.match(
      /\b(?:my goal is|i want to|trying to|aiming to)\s+(.{3,100})/i,
    );
    if (goal) {
      addFact(map, 'goal', goal[1].trim());
      continue;
    }

    const habit = lower.match(
      /\b(?:i usually|i often|every (?:day|week|morning|evening))\s+(.{3,100})/i,
    );
    if (habit) {
      addFact(map, 'habit', habit[0].trim().slice(0, MAX_FACT_LEN));
    }
  }

  return [...map.values()].slice(-MAX_FACTS);
}

export function mergeMemoryFacts(
  existing: AssistantMemoryFact[],
  incoming: AssistantMemoryFact[],
): AssistantMemoryFact[] {
  const map = new Map<string, AssistantMemoryFact>();
  for (const f of existing) {
    map.set(`${f.category}:${slug(f.text)}`, f);
  }
  for (const f of incoming) {
    map.set(`${f.category}:${slug(f.text)}`, {
      ...f,
      updatedAt: f.updatedAt ?? new Date().toISOString(),
    });
  }
  return [...map.values()].slice(-MAX_FACTS);
}

export function parseMemoryJson(raw: string): {
  narrative: string | null;
  facts: AssistantMemoryFact[];
} | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as {
      narrative?: string;
      facts?: Array<{ category?: string; text?: string }>;
    };
    const facts: AssistantMemoryFact[] = [];
    for (const f of parsed.facts ?? []) {
      if (!f.text?.trim()) continue;
      const cat = f.category as MemoryFactCategory;
      const category: MemoryFactCategory =
        cat === 'preference' ||
        cat === 'goal' ||
        cat === 'habit' ||
        cat === 'constraint' ||
        cat === 'note'
          ? cat
          : 'note';
      facts.push({
        category,
        text: f.text.trim().slice(0, MAX_FACT_LEN),
        updatedAt: new Date().toISOString(),
      });
    }
    return {
      narrative: parsed.narrative?.trim().slice(0, 600) ?? null,
      facts: facts.slice(-MAX_FACTS),
    };
  } catch {
    return null;
  }
}
