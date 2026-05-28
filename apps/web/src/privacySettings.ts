export type PrivacySettingsForm = {
  allowAiProcessing: boolean
  publicProfileVisible: boolean
  shareAnonymizedData: boolean
  emailNotifications: boolean
  insightCadence: 'off' | 'daily' | 'weekly'
  weightReminderEnabled: boolean
  activityReminderEnabled: boolean
  reminderChannel: 'email' | 'in_app'
  activityReminderCadence: 'off' | 'daily' | 'weekly'
}

const DEFAULTS: PrivacySettingsForm = {
  allowAiProcessing: true,
  publicProfileVisible: false,
  shareAnonymizedData: false,
  emailNotifications: true,
  insightCadence: 'off',
  weightReminderEnabled: true,
  activityReminderEnabled: true,
  reminderChannel: 'in_app',
  activityReminderCadence: 'daily',
}

export function privacyFromApi(raw: unknown): PrivacySettingsForm | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  return {
    allowAiProcessing:
      typeof o.allowAiProcessing === 'boolean'
        ? o.allowAiProcessing
        : DEFAULTS.allowAiProcessing,
    publicProfileVisible:
      typeof o.publicProfileVisible === 'boolean'
        ? o.publicProfileVisible
        : DEFAULTS.publicProfileVisible,
    shareAnonymizedData:
      typeof o.shareAnonymizedData === 'boolean'
        ? o.shareAnonymizedData
        : DEFAULTS.shareAnonymizedData,
    emailNotifications:
      typeof o.emailNotifications === 'boolean'
        ? o.emailNotifications
        : DEFAULTS.emailNotifications,
    insightCadence:
      o.insightCadence === 'daily' || o.insightCadence === 'weekly'
        ? o.insightCadence
        : 'off',
    weightReminderEnabled:
      typeof o.weightReminderEnabled === 'boolean'
        ? o.weightReminderEnabled
        : DEFAULTS.weightReminderEnabled,
    activityReminderEnabled:
      typeof o.activityReminderEnabled === 'boolean'
        ? o.activityReminderEnabled
        : DEFAULTS.activityReminderEnabled,
    reminderChannel: o.reminderChannel === 'email' ? 'email' : 'in_app',
    activityReminderCadence:
      o.activityReminderCadence === 'weekly' || o.activityReminderCadence === 'off'
        ? o.activityReminderCadence
        : 'daily',
  }
}

export function privacyToPayload(form: PrivacySettingsForm): PrivacySettingsForm {
  return {
    allowAiProcessing: form.allowAiProcessing,
    publicProfileVisible: form.publicProfileVisible,
    shareAnonymizedData: form.shareAnonymizedData,
    emailNotifications: form.emailNotifications,
    insightCadence: form.insightCadence,
    weightReminderEnabled: form.weightReminderEnabled,
    activityReminderEnabled: form.activityReminderEnabled,
    reminderChannel: form.reminderChannel,
    activityReminderCadence: form.activityReminderCadence,
  }
}
