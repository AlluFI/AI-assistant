import {
  dayIndexForPlanDate,
  planCoversDate,
  planEndDate,
} from './meal-plan-date.util';

describe('meal-plan-date.util', () => {
  it('daily plan covers only its start date', () => {
    expect(planCoversDate('2026-06-07', 'daily', '2026-06-07')).toBe(true);
    expect(planCoversDate('2026-06-07', 'daily', '2026-06-08')).toBe(false);
  });

  it('weekly plan covers seven days from start', () => {
    expect(planCoversDate('2026-06-01', 'weekly', '2026-06-01')).toBe(true);
    expect(planCoversDate('2026-06-01', 'weekly', '2026-06-07')).toBe(true);
    expect(planCoversDate('2026-06-01', 'weekly', '2026-06-08')).toBe(false);
    expect(planEndDate('2026-06-01', 'weekly')).toBe('2026-06-07');
  });

  it('dayIndexForPlanDate clamps weekly range', () => {
    expect(dayIndexForPlanDate('2026-06-01', '2026-06-03', 'weekly')).toBe(2);
    expect(dayIndexForPlanDate('2026-06-01', '2026-06-01', 'daily')).toBe(0);
  });
});
