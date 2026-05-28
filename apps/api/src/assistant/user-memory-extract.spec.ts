import { extractMemoryFactsFromMessages } from './user-memory-extract.util';

describe('extractMemoryFactsFromMessages', () => {
  it('captures dislikes and goals', () => {
    const facts = extractMemoryFactsFromMessages([
      "I don't like mushrooms in my meals",
      'My goal is to lose 5 kg by summer',
    ]);
    expect(facts.some((f) => f.text.toLowerCase().includes('mushroom'))).toBe(
      true,
    );
    expect(facts.some((f) => f.category === 'goal')).toBe(true);
  });

  it('skips credential questions', () => {
    const facts = extractMemoryFactsFromMessages(['What is my email?']);
    expect(facts.length).toBe(0);
  });
});
