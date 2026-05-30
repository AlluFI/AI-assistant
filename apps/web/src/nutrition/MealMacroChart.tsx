import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { MacroNutrition } from './types'

const COLORS = ['#2563eb', '#16a34a', '#f59e0b']

type Props = {
  nutrition: MacroNutrition
  compact?: boolean
  /** Larger chart for recipe detail modals */
  detail?: boolean
}

export function MealMacroChart({ nutrition, compact, detail }: Props) {
  const proteinKcal = nutrition.protein * 4
  const carbsKcal = nutrition.carbs * 4
  const fatsKcal = nutrition.fats * 9
  const total = proteinKcal + carbsKcal + fatsKcal

  if (total <= 0) {
    return <p className="hint mealMacroEmpty">No macro data</p>
  }

  const data = [
    { name: 'P', value: proteinKcal, grams: nutrition.protein },
    { name: 'C', value: carbsKcal, grams: nutrition.carbs },
    { name: 'F', value: fatsKcal, grams: nutrition.fats },
  ].filter((d) => d.value > 0)

  const height = detail ? 120 : compact ? 72 : 96
  const innerR = detail ? 28 : compact ? 18 : 24
  const outerR = detail ? 48 : compact ? 30 : 40

  return (
    <div
      className={`mealMacroChart${compact ? ' compact' : ''}${detail ? ' detail' : ''}`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={innerR}
            outerRadius={outerR}
          >
            {data.map((d, i) => (
              <Cell key={d.name} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, item) => {
              const row = item?.payload as { name: string; grams: number }
              const pct = Math.round((Number(value) / total) * 100)
              return [`${pct}% (${row.grams}g)`, row.name === 'P' ? 'Protein' : row.name === 'C' ? 'Carbs' : 'Fats']
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mealMacroLegend">
        {data.map((d, i) => (
          <span key={d.name} style={{ color: COLORS[i % COLORS.length] }}>
            {d.name} {Math.round((d.value / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  )
}
