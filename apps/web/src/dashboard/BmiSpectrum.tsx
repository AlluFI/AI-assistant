import type { CSSProperties } from 'react'
import {
  BMI_BANDS,
  BMI_SCALE_MAX,
  BMI_SCALE_MIN,
  bmiBandForValue,
  bmiMarkerPercent,
  formatBmiClass,
} from './dashboardUtils'

type Props = {
  bmi: number | null
  classification: string | null
}

export function BmiSpectrum({ bmi, classification }: Props) {
  const band = bmi != null ? bmiBandForValue(bmi) : null
  const markerPct = bmi != null ? bmiMarkerPercent(bmi) : null

  return (
    <section className="vizBlock bmiSpectrum">
      <div className="vizBlockHead">
        <h3>BMI classification</h3>
        {bmi != null ? (
          <p className="vizHeadValue" style={{ color: band?.color }}>
            {bmi.toFixed(1)} · {formatBmiClass(classification ?? band?.key)}
          </p>
        ) : (
          <p className="vizHeadValue muted">Add height & weight</p>
        )}
      </div>
      <div
        className="bmiSpectrumTrack"
        role="img"
        aria-label={
          bmi != null
            ? `BMI ${bmi.toFixed(1)}, ${formatBmiClass(classification ?? band?.key)}`
            : 'BMI not available'
        }
      >
        <div className="bmiSpectrumBar">
        {BMI_BANDS.map((b) => {
          const widthPct =
            ((Math.min(b.max, BMI_SCALE_MAX) - Math.max(b.min, BMI_SCALE_MIN)) /
              (BMI_SCALE_MAX - BMI_SCALE_MIN)) *
            100
          return (
            <div
              key={b.key}
              className="bmiSpectrumSegment"
              style={{ width: `${widthPct}%`, background: b.color }}
              title={`${b.label} (${b.min}–${b.max})`}
            />
          )
        })}
        </div>
        {markerPct != null ? (
          <div
            className="bmiSpectrumMarker"
            style={
              { left: `${markerPct}%`, '--marker-accent': band?.color ?? '#0f172a' } as CSSProperties
            }
            title={`Your BMI: ${bmi!.toFixed(1)}`}
          >
            <span className="bmiSpectrumMarkerLabel">You</span>
            <span className="bmiSpectrumMarkerStem" aria-hidden />
            <span className="bmiSpectrumMarkerDot" />
          </div>
        ) : null}
      </div>
      <div className="bmiSpectrumLegend">
        {BMI_BANDS.map((b) => (
          <span key={b.key} className="bmiLegendItem">
            <span className="bmiLegendSwatch" style={{ background: b.color }} />
            {b.label}
          </span>
        ))}
      </div>
      <p className="hint bmiHealthyHint">
        Healthy range: <strong>18.5–24.9</strong>
        {bmi != null && bmi >= 18.5 && bmi < 25 ? ' — you are in range' : ''}
      </p>
    </section>
  )
}
