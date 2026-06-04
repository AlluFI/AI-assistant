export type AiMacroTargets = {
  protein: number;
  carbs: number;
  fats: number;
};

export type AiTargetRecommendation = {
  calories: number;
  macros: AiMacroTargets;
  rationale?: string;
};

export function validateAiTargetRecommendation(
  raw: unknown,
): AiTargetRecommendation | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const calories = Math.round(Number(o.calories));
  if (!Number.isFinite(calories) || calories < 1200 || calories > 6000) {
    return null;
  }
  const macrosRaw = o.macros;
  if (!macrosRaw || typeof macrosRaw !== 'object') return null;
  const m = macrosRaw as Record<string, unknown>;
  const protein = Math.round(Number(m.protein));
  const carbs = Math.round(Number(m.carbs));
  const fats = Math.round(Number(m.fats));
  if (
    !Number.isFinite(protein) ||
    !Number.isFinite(carbs) ||
    !Number.isFinite(fats) ||
    protein < 40 ||
    protein > 400 ||
    carbs < 50 ||
    carbs > 800 ||
    fats < 20 ||
    fats > 250
  ) {
    return null;
  }
  const kcalFromMacros = protein * 4 + carbs * 4 + fats * 9;
  const ratio = kcalFromMacros / calories;
  if (ratio < 0.85 || ratio > 1.15) return null;

  const rationale =
    typeof o.rationale === 'string' && o.rationale.trim()
      ? o.rationale.trim().slice(0, 500)
      : undefined;

  return { calories, macros: { protein, carbs, fats }, rationale };
}
