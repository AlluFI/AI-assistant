/**
 * Offline golden-set check for wingman routing (no LLM API calls).
 * Run: pnpm --filter api wingman:eval
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  inferExpectedIntent,
  inferExpectedTools,
} from './tool-routing.heuristic';

type GoldenCase = {
  id: string;
  message: string;
  expectTools?: string[];
  anyOfTools?: boolean;
  argHints?: Record<string, string>;
  expectIntent?: string;
  allowNoTools?: boolean;
};

const setPath = path.join(__dirname, 'wingman-golden-set.json');
const cases = JSON.parse(fs.readFileSync(setPath, 'utf8')) as GoldenCase[];

let passed = 0;
let failed = 0;

for (const c of cases) {
  const reasons: string[] = [];

  if (c.expectIntent) {
    const intent = inferExpectedIntent(c.message);
    if (intent !== c.expectIntent) {
      reasons.push(`intent: got ${intent ?? 'null'}, want ${c.expectIntent}`);
    }
  }

  if (c.expectTools) {
    const tools = inferExpectedTools(c.message);
    if (c.anyOfTools) {
      const hit = c.expectTools.some((t) => tools.includes(t));
      if (!hit) {
        reasons.push(
          `tools: want one of [${c.expectTools.join(', ')}], got [${tools.join(', ')}]`,
        );
      }
    } else if (c.allowNoTools && tools.length === 0) {
      /* ok */
    } else {
      for (const t of c.expectTools) {
        if (!tools.includes(t)) reasons.push(`missing tool ${t}`);
      }
    }
  }

  if (reasons.length) {
    failed++;
    console.error(`FAIL ${c.id}: ${reasons.join('; ')}`);
  } else {
    passed++;
    console.log(`OK   ${c.id}`);
  }
}

console.log(`\n${passed}/${cases.length} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
