type Props = {
  onOpenNutrition?: () => void
}

export function NutritionSetupBanner({ onOpenNutrition }: Props) {
  if (!onOpenNutrition) return null
  return (
    <section className="card cardSpan2 nutritionSetupBanner" role="status">
      <h2>Set your nutrition targets</h2>
      <p className="hint">
        Add a daily calorie and macro target so meal plans, Today, and Wingman can track progress
        against your goals.
      </p>
      <button type="button" onClick={onOpenNutrition}>
        Open Nutrition tab
      </button>
    </section>
  )
}
