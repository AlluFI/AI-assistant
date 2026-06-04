import {
  inferExpectedIntent,
  inferExpectedTools,
} from './tool-routing.heuristic';
import { inferChartToolCall } from '../chart-ui-blocks.util';
import { parseLogActivityIntent } from '../wingman-intent';

describe('wingman golden routing', () => {
  it('detects BMI health tool', () => {
    expect(inferExpectedTools("What's my current BMI?")).toContain(
      'get_health_metrics',
    );
  });

  it('detects chart from weight trend phrase', () => {
    const chart = inferChartToolCall('Show my weight trend for the last month');
    expect(chart?.chart_type).toBe('weight_trend');
    expect(
      inferExpectedTools('Show my weight trend for the last month'),
    ).toContain('get_chart_data');
  });

  it('detects activity log intent', () => {
    expect(inferExpectedIntent('record 1 hour tennis for today')).toBe(
      'log_activity',
    );
    expect(
      parseLogActivityIntent('record 1 hour tennis for today'),
    ).toMatchObject({
      activityType: 'tennis',
      durationMinutes: 60,
    });
  });

  it('detects recipe search', () => {
    expect(
      inferExpectedTools('Find high protein chicken dinner recipes'),
    ).toContain('search_recipes');
  });

  it('detects nutrition target updates', () => {
    expect(
      inferExpectedTools(
        'Recommend and set my calorie and macro targets from my health profile',
      ),
    ).toContain('update_nutrition_targets');
    expect(
      inferExpectedTools('Set my daily calories to 2400'),
    ).toContain('update_nutrition_targets');
  });
});
