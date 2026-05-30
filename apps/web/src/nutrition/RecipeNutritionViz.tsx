import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MealMacroChart } from './MealMacroChart'
import type { MacroNutrition } from './types'

const MACRO_COLORS = ['#2563eb', '#16a34a', '#f59e0b']

type Props = {
  title: string
  nutrition: MacroNutrition
  footnote?: string
}

function roundMacro(n: number) {
  return Math.round(n * 10) / 10
}

export function RecipeNutritionViz({ title, nutrition, footnote }: Props) {
  const barData = [
    { name: 'Protein', grams: roundMacro(nutrition.protein) },
    { name: 'Carbs', grams: roundMacro(nutrition.carbs) },
    { name: 'Fats', grams: roundMacro(nutrition.fats) },
  ].filter((row) => row.grams > 0)

  const hasData =
    nutrition.calories > 0 ||
    nutrition.protein > 0 ||
    nutrition.carbs > 0 ||
    nutrition.fats > 0

  if (!hasData) {
    return (
      <div className="recipeNutritionViz">
        <h3 className="recipeNutritionTitle">{title}</h3>
        <p className="hint">No nutrition data available for this recipe.</p>
      </div>
    )
  }

  return (
    <div className="recipeNutritionViz">
      <h3 className="recipeNutritionTitle">{title}</h3>
      <p className="recipeNutritionCalories">{Math.round(nutrition.calories)} kcal</p>
      <p className="hint recipeNutritionMacroLine">
        P {roundMacro(nutrition.protein)}g · C {roundMacro(nutrition.carbs)}g · F{' '}
        {roundMacro(nutrition.fats)}g
      </p>
      <div className="recipeNutritionCharts">
        <div className="recipeNutritionChartBlock">
          <p className="chartTitle">Macro energy split</p>
          <MealMacroChart
            nutrition={{
              calories: nutrition.calories,
              protein: nutrition.protein,
              carbs: nutrition.carbs,
              fats: nutrition.fats,
            }}
            detail
          />
        </div>
        <div className="recipeNutritionChartBlock">
          <p className="chartTitle">Macros by weight (g)</p>
          {barData.length ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="g" width={36} />
                <Tooltip formatter={(v) => [`${v}g`, 'Amount']} />
                <Bar dataKey="grams" radius={[4, 4, 0, 0]} barSize={28}>
                  {barData.map((row, i) => (
                    <Cell key={row.name} fill={MACRO_COLORS[i % MACRO_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="hint">No macro breakdown.</p>
          )}
        </div>
      </div>
      {footnote ? <p className="hint recipeNutritionFootnote">{footnote}</p> : null}
    </div>
  )
}
