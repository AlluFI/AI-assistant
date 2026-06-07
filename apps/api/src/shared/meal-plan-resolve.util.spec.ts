import { pickMealPlanForDate } from './meal-plan-resolve.util';

function plan(
  id: string,
  duration: 'daily' | 'weekly',
  startDate: string,
  updatedAt: string,
  isActive: boolean,
) {
  return {
    id,
    duration,
    startDate,
    updatedAt: new Date(updatedAt),
    versions: [{ isActive, versionNumber: 1 }],
  };
}

describe('pickMealPlanForDate', () => {
  it('prefers weekly covering today when daily is active but wrong date', () => {
    const plans = [
      plan('daily', 'daily', '2026-06-06', '2026-06-07T10:00:00Z', true),
      plan('weekly', 'weekly', '2026-06-03', '2026-06-05T10:00:00Z', false),
    ];
    const picked = pickMealPlanForDate(plans, '2026-06-07');
    expect(picked?.id).toBe('weekly');
  });

  it('uses active daily when it covers today', () => {
    const plans = [
      plan('daily', 'daily', '2026-06-07', '2026-06-07T12:00:00Z', true),
      plan('weekly', 'weekly', '2026-06-03', '2026-06-06T10:00:00Z', false),
    ];
    const picked = pickMealPlanForDate(plans, '2026-06-07');
    expect(picked?.id).toBe('daily');
  });

  it('returns null when no plan covers the date', () => {
    const plans = [
      plan('daily', 'daily', '2026-06-06', '2026-06-07T10:00:00Z', true),
    ];
    expect(pickMealPlanForDate(plans, '2026-06-07')).toBeNull();
  });
});
