import type {
  AssistantChartType,
  AssistantUiBlock,
} from './assistant-ui.types';

type ToolTrace = {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
};

const CHART_TITLES: Record<AssistantChartType, string> = {
  weight_trend: 'Weight trend',
  calorie_trend: 'Calorie trend',
  protein_vs_target: 'Protein vs target',
  macro_breakdown: "Today's macros",
};

function isChartType(v: string): v is AssistantChartType {
  return v in CHART_TITLES;
}

export function chartUiBlocksFromToolTraces(
  traces: ToolTrace[],
): AssistantUiBlock[] {
  const blocks: AssistantUiBlock[] = [];
  for (const trace of traces) {
    if (trace.name !== 'get_chart_data' || trace.result == null) continue;
    const raw = trace.result as { chart_type?: string };
    const chartType = raw.chart_type;
    if (!chartType || !isChartType(chartType)) continue;
    blocks.push({
      type: 'chart',
      chart: chartType,
      title: CHART_TITLES[chartType],
      data: trace.result,
    });
  }
  return blocks;
}

/** If the user explicitly asks for a chart, fetch data when the model skips the tool. */
export function inferChartToolCall(
  message: string,
): { chart_type: AssistantChartType; days?: number } | null {
  const lower = message.toLowerCase();
  const daysMatch = lower.match(/(\d+)\s*days?/);
  const days = daysMatch ? Number(daysMatch[1]) : 30;

  if (/weight trend|show.*weight|my weight.*month|weight.*chart/.test(lower)) {
    return { chart_type: 'weight_trend', days };
  }
  if (/calorie trend|caloric trend|calories over|intake over/.test(lower)) {
    return { chart_type: 'calorie_trend', days };
  }
  if (
    /protein.*target|protein intake compare|protein.*chart|show.*protein/.test(
      lower,
    )
  ) {
    return { chart_type: 'protein_vs_target' };
  }
  if (/macro|macronutrient|breakdown today|macros today/.test(lower)) {
    return { chart_type: 'macro_breakdown' };
  }
  return null;
}
