import type {
  EnhancedMealPlanAnalytics,
  EnhancedRecipeNutrition,
} from './types'

function levelClass(level: string): string {
  const l = level.toLowerCase()
  if (l === 'high' || l === 'increasing') return 'enhancedLevelHigh'
  if (l === 'low' || l === 'decreasing') return 'enhancedLevelLow'
  return 'enhancedLevelMid'
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type RecipeProps = {
  data: EnhancedRecipeNutrition
}

export function EnhancedRecipePanel({ data }: RecipeProps) {
  const ap = data.antioxidant_profile
  const env = data.environmental_impact
  return (
    <section className="card enhancedNutritionCard" aria-label="Enhanced recipe nutrition">
      <h3 style={{ marginTop: 0 }}>Enhanced nutrition profile</h3>
      <div className="enhancedNutritionGrid">
        <div>
          <span className="enhancedLabel">Glycemic index</span>
          <strong>{data.glycemic_index}</strong>
        </div>
        <div>
          <span className="enhancedLabel">Nutrient density</span>
          <strong>{data.nutrient_density_score}/10</strong>
        </div>
        <div>
          <span className="enhancedLabel">Satiety index</span>
          <strong>{data.satiety_index}/100</strong>
        </div>
        <div>
          <span className="enhancedLabel">Processing</span>
          <strong>{data.processing_level}</strong>
        </div>
      </div>
      <p className="hint" style={{ marginBottom: '0.5rem' }}>
        <strong>Antioxidants:</strong>{' '}
        polyphenols{' '}
        <span className={levelClass(ap.polyphenols)}>{ap.polyphenols}</span>, flavonoids{' '}
        <span className={levelClass(ap.flavonoids)}>{ap.flavonoids}</span>, carotenoids{' '}
        <span className={levelClass(ap.carotenoids)}>{ap.carotenoids}</span>
      </p>
      <p className="hint" style={{ marginTop: 0 }}>
        <strong>Environmental impact:</strong> carbon{' '}
        <span className={levelClass(env.carbon_footprint)}>{env.carbon_footprint}</span>, water{' '}
        <span className={levelClass(env.water_usage)}>{env.water_usage}</span>
      </p>
    </section>
  )
}

type PlanProps = {
  data: EnhancedMealPlanAnalytics
}

export function EnhancedMealPlanPanel({ data }: PlanProps) {
  const cov = data.micronutrient_coverage
  const trends = data.weekly_trends
  const sustain = data.sustainability_metrics
  return (
    <section className="card enhancedNutritionCard" aria-label="Enhanced meal plan analytics">
      <h3 style={{ marginTop: 0 }}>Plan quality & sustainability</h3>
      <div className="enhancedNutritionGrid">
        <div>
          <span className="enhancedLabel">Balance score</span>
          <strong>{data.nutritional_balance_score}/10</strong>
        </div>
        <div>
          <span className="enhancedLabel">Diversity index</span>
          <strong>{data.diversity_index}/10</strong>
        </div>
        <div>
          <span className="enhancedLabel">Micronutrient coverage</span>
          <strong>{cov.percentage}%</strong>
        </div>
        <div>
          <span className="enhancedLabel">Plant / animal ratio</span>
          <strong>{sustain.plant_to_animal_ratio}</strong>
        </div>
      </div>
      {cov.deficiencies.length > 0 ? (
        <p className="hint">
          <strong>Likely gaps:</strong> {cov.deficiencies.join(', ')}
        </p>
      ) : (
        <p className="hint">No major micronutrient gaps detected vs daily targets.</p>
      )}
      {cov.excess.length > 0 ? (
        <p className="hint">
          <strong>Watch:</strong> {cov.excess.join(', ')}
        </p>
      ) : null}
      <p className="hint">
        <strong>Weekly trends:</strong> protein consistency{' '}
        <span className={levelClass(trends.protein_consistency)}>
          {trends.protein_consistency}
        </span>
        , fiber {capitalize(trends.fiber_trend)}, sugar {capitalize(trends.sugar_trend)}
      </p>
      <p className="hint" style={{ marginTop: 0 }}>
        <strong>Seasonal / plant-forward:</strong> ~{sustain.seasonal_ingredient_percentage}%
        seasonal-style variety estimate
      </p>
    </section>
  )
}
