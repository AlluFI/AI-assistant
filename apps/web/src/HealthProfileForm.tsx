import {
  ACTIVITY_OPTIONS,
  DIETARY_PREFERENCE_OPTIONS,
  DIETARY_RESTRICTION_OPTIONS,
  EXERCISE_ENV_OPTIONS,
  EXERCISE_TIME_OPTIONS,
  EXERCISE_TYPE_OPTIONS,
  FITNESS_GOAL_OPTIONS,
  FITNESS_LEVEL_OPTIONS,
  GENDER_OPTIONS,
  type HealthProfileFormState,
  SESSION_DURATION_OPTIONS,
  toggleProfileList,
} from './profileFormModel'

type Props = {
  value: HealthProfileFormState
  onChange: (next: HealthProfileFormState) => void
  disabled?: boolean
  hasStartingWeight?: boolean
  changingStartingWeight?: boolean
  onRequestChangeStartingWeight?: () => void
  onApplyNewStartingWeight?: () => void
  onCancelChangeStartingWeight?: () => void
}

function patch(
  value: HealthProfileFormState,
  onChange: (next: HealthProfileFormState) => void,
  partial: Partial<HealthProfileFormState>,
) {
  onChange({ ...value, ...partial })
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string
  options: ReadonlyArray<{ value: string; label: string }>
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map((o) => (
          <option key={o.value || '_empty'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function CheckboxGroup({
  legend,
  options,
  selected,
  onToggle,
  disabled,
}: {
  legend: string
  options: ReadonlyArray<{ value: string; label: string }>
  selected: string[]
  onToggle: (value: string, checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="profileSection profileGridFull">
      <legend>{legend}</legend>
      <div className="checkboxGroup">
        {options.map((o) => (
          <label key={o.value}>
            <input
              type="checkbox"
              checked={selected.includes(o.value)}
              disabled={disabled}
              onChange={(e) => onToggle(o.value, e.target.checked)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function HealthProfileForm({
  value,
  onChange,
  disabled,
  hasStartingWeight = false,
  changingStartingWeight = false,
  onRequestChangeStartingWeight,
  onApplyNewStartingWeight,
  onCancelChangeStartingWeight,
}: Props) {
  const set = (partial: Partial<HealthProfileFormState>) => patch(value, onChange, partial)
  const startingLocked = hasStartingWeight && !changingStartingWeight

  return (
    <div className="profileForm">
      <fieldset className="profileSection">
        <legend>Basic demographics</legend>
        <div className="profileGrid">
          <label>
            Age
            <input
              type="number"
              min={0}
              max={120}
              value={value.age}
              disabled={disabled}
              onChange={(e) => set({ age: e.target.value })}
            />
          </label>
          <SelectField
            label="Gender"
            value={value.gender}
            options={GENDER_OPTIONS}
            disabled={disabled}
            onChange={(gender) => set({ gender })}
          />
        </div>
      </fieldset>

      <fieldset className="profileSection">
        <legend>Physical metrics</legend>
        <div className="profileGrid">
          <label>
            Height (cm)
            <input
              type="number"
              min={50}
              max={260}
              step={0.1}
              value={value.heightCm}
              disabled={disabled}
              onChange={(e) => set({ heightCm: e.target.value })}
            />
          </label>
          <label>
            Starting weight (kg)
            <input
              type="number"
              min={20}
              max={400}
              step={0.1}
              value={value.startingWeightKg}
              disabled={disabled || startingLocked}
              onChange={(e) => set({ startingWeightKg: e.target.value })}
            />
          </label>
          {hasStartingWeight && !changingStartingWeight ? (
            <div className="profileGridFull startingWeightActions">
              <p className="hint">
                Locked — this is the baseline for weight progress and goal tracking.
              </p>
              <button
                type="button"
                className="secondary"
                disabled={disabled}
                onClick={onRequestChangeStartingWeight}
              >
                Change starting weight…
              </button>
            </div>
          ) : null}
          {changingStartingWeight ? (
            <div className="profileGridFull">
              <p className="hint profileWarning">
                Enter your new starting weight, then apply. All weight entries, wellness snapshots,
                and activity logs will be removed. Charts will restart from this weight.
              </p>
              <div className="row">
                <button
                  type="button"
                  className="danger"
                  disabled={disabled}
                  onClick={onApplyNewStartingWeight}
                >
                  Apply new starting weight
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={disabled}
                  onClick={onCancelChangeStartingWeight}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : !hasStartingWeight ? (
            <p className="hint profileGridFull">
              Saved as the first point on your progress charts when you save the profile.
            </p>
          ) : null}
          <label>
            Current weight (kg)
            <input
              type="number"
              min={20}
              max={400}
              step={0.1}
              value={value.weightKg}
              disabled={disabled}
              onChange={(e) => set({ weightKg: e.target.value })}
            />
          </label>
          <label className="profileGridFull">
            Target weight (kg)
            <input
              type="number"
              min={20}
              max={400}
              step={0.1}
              value={value.targetWeightKg}
              disabled={disabled}
              onChange={(e) => set({ targetWeightKg: e.target.value })}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="profileSection">
        <legend>Lifestyle</legend>
        <div className="profileGrid">
          <label>
            Occupation type
            <input
              type="text"
              maxLength={120}
              value={value.occupationType}
              disabled={disabled}
              placeholder="e.g. desk job, manual labor"
              onChange={(e) => set({ occupationType: e.target.value })}
            />
          </label>
          <SelectField
            label="Activity level"
            value={value.activityLevel}
            options={ACTIVITY_OPTIONS}
            disabled={disabled}
            onChange={(activityLevel) => set({ activityLevel })}
          />
        </div>
      </fieldset>

      <CheckboxGroup
        legend="Dietary preferences"
        options={DIETARY_PREFERENCE_OPTIONS}
        selected={value.dietaryPreferences}
        disabled={disabled}
        onToggle={(v, checked) =>
          onChange(toggleProfileList(value, 'dietaryPreferences', v, checked))
        }
      />

      <CheckboxGroup
        legend="Dietary restrictions"
        options={DIETARY_RESTRICTION_OPTIONS}
        selected={value.dietaryRestrictions}
        disabled={disabled}
        onToggle={(v, checked) =>
          onChange(toggleProfileList(value, 'dietaryRestrictions', v, checked))
        }
      />

      <fieldset className="profileSection">
        <legend>Fitness goals</legend>
        <div className="profileGrid">
          <SelectField
            label="Primary goal"
            value={value.fitnessGoalPrimary}
            options={FITNESS_GOAL_OPTIONS}
            disabled={disabled}
            onChange={(fitnessGoalPrimary) => set({ fitnessGoalPrimary })}
          />
          <SelectField
            label="Desired activity level"
            value={value.desiredActivityLevel}
            options={ACTIVITY_OPTIONS}
            disabled={disabled}
            onChange={(desiredActivityLevel) => set({ desiredActivityLevel })}
          />
        </div>
      </fieldset>

      <fieldset className="profileSection">
        <legend>Initial fitness assessment</legend>
        <div className="profileGrid">
          <label>
            Weekly activity (days, 0–7)
            <input
              type="number"
              min={0}
              max={7}
              value={value.weeklyActivityDays}
              disabled={disabled}
              onChange={(e) => set({ weeklyActivityDays: e.target.value })}
            />
          </label>
          <SelectField
            label="Average session duration"
            value={value.sessionDurationBand}
            options={SESSION_DURATION_OPTIONS}
            disabled={disabled}
            onChange={(sessionDurationBand) => set({ sessionDurationBand })}
          />
          <SelectField
            label="Self-assessed fitness level"
            value={value.fitnessSelfLevel}
            options={FITNESS_LEVEL_OPTIONS}
            disabled={disabled}
            onChange={(fitnessSelfLevel) => set({ fitnessSelfLevel })}
          />
          <SelectField
            label="Preferred environment"
            value={value.exerciseEnvironment}
            options={EXERCISE_ENV_OPTIONS}
            disabled={disabled}
            onChange={(exerciseEnvironment) => set({ exerciseEnvironment })}
          />
          <SelectField
            label="Preferred time of day"
            value={value.exerciseTimeOfDay}
            options={EXERCISE_TIME_OPTIONS}
            disabled={disabled}
            onChange={(exerciseTimeOfDay) => set({ exerciseTimeOfDay })}
          />
          <label>
            Endurance (minutes run/walk)
            <input
              type="number"
              min={0}
              max={600}
              value={value.enduranceMinutes}
              disabled={disabled}
              onChange={(e) => set({ enduranceMinutes: e.target.value })}
            />
          </label>
          <label>
            Max push-ups
            <input
              type="number"
              min={0}
              max={500}
              value={value.pushupsMax}
              disabled={disabled}
              onChange={(e) => set({ pushupsMax: e.target.value })}
            />
          </label>
          <label>
            Max squats
            <input
              type="number"
              min={0}
              max={500}
              value={value.squatsMax}
              disabled={disabled}
              onChange={(e) => set({ squatsMax: e.target.value })}
            />
          </label>
        </div>
      </fieldset>

      <CheckboxGroup
        legend="Exercise types"
        options={EXERCISE_TYPE_OPTIONS}
        selected={value.exerciseTypes}
        disabled={disabled}
        onToggle={(v, checked) => onChange(toggleProfileList(value, 'exerciseTypes', v, checked))}
      />
    </div>
  )
}
