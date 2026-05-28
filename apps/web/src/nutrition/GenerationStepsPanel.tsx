import { useState } from 'react'
import type { GenerationStepRecord } from './types'

type Props = {
  steps: GenerationStepRecord[] | null | undefined
}

function summarizeResponse(response: unknown): string {
  if (response == null) return '—'
  if (typeof response === 'string') {
    return response.length > 280 ? `${response.slice(0, 280)}…` : response
  }
  try {
    const text = JSON.stringify(response)
    return text.length > 320 ? `${text.slice(0, 320)}…` : text
  } catch {
    return String(response)
  }
}

export function GenerationStepsPanel({ steps }: Props) {
  const [open, setOpen] = useState(false)
  const list = Array.isArray(steps) ? steps : []
  if (!list.length) {
    return (
      <p className="hint">
        No generation step log on this version (generate a new plan to record sequential prompts).
      </p>
    )
  }

  const sorted = [...list].sort((a, b) => a.step - b.step || a.name.localeCompare(b.name))

  return (
    <div className="generationStepsPanel">
      <button
        type="button"
        className="secondary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Hide' : 'Show'} how this plan was generated ({sorted.length} steps)
      </button>
      {open ? (
        <ol className="generationStepsList">
          {sorted.map((step) => (
            <li key={`${step.step}-${step.name}`} className="generationStepItem">
              <p>
                <strong>
                  Step {step.step}: {step.name}
                </strong>
              </p>
              {step.prompt ? (
                <details>
                  <summary>Prompt</summary>
                  <pre className="pre generationStepPre">{step.prompt}</pre>
                </details>
              ) : null}
              <details>
                <summary>Response summary</summary>
                <pre className="pre generationStepPre">{summarizeResponse(step.response)}</pre>
              </details>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
