import {
  averageCheckInScore,
  dayCheckInScore,
  moodCheckInScore,
  sleepCheckInScore,
  waterCheckInScore,
} from './check-in-wellness.util';

describe('check-in-wellness.util', () => {
  it('scores sleep near target highest', () => {
    expect(sleepCheckInScore(8)).toBe(100);
    expect(sleepCheckInScore(5)).toBe(70);
  });

  it('scores water toward 8 glasses', () => {
    expect(waterCheckInScore(8)).toBe(100);
    expect(waterCheckInScore(4)).toBe(50);
  });

  it('averages multi-day check-ins', () => {
    const avg = averageCheckInScore([
      { sleepHours: 8, waterGlasses: 8, mood: 5 },
      { sleepHours: 6, waterGlasses: 4, mood: 3 },
    ]);
    expect(avg).toBeGreaterThan(50);
    expect(avg).toBeLessThanOrEqual(100);
  });

  it('returns null when no habit fields', () => {
    expect(dayCheckInScore({ sleepHours: null, waterGlasses: null, mood: null })).toBeNull();
    expect(moodCheckInScore(4)).toBe(80);
  });
});
