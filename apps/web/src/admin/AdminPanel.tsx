import { DeletionQueueSection } from './DeletionQueueSection'
import { RecipeModerationSection } from './RecipeModerationSection'

type Props = {
  accessToken: string
  isModerator: boolean
  isPurgeAdmin: boolean
  busy: boolean
  setBusy: (v: boolean) => void
  setMessage: (v: string) => void
  setError: (v: string) => void
}

export function AdminPanel({
  accessToken,
  isModerator,
  isPurgeAdmin,
  busy,
  setBusy,
  setMessage,
  setError,
}: Props) {
  return (
    <div className="adminPanel">
      <section className="card cardWide">
        <h2>Admin</h2>
        <p className="hint">
          {isModerator && isPurgeAdmin
            ? 'Recipe moderation and account deletion tools.'
            : isModerator
              ? 'Recipe review moderation.'
              : 'Account deletion queue and purge.'}
        </p>
      </section>
      {isModerator ? (
        <RecipeModerationSection
          accessToken={accessToken}
          busy={busy}
          setBusy={setBusy}
          setMessage={setMessage}
          setError={setError}
        />
      ) : null}
      {isPurgeAdmin ? (
        <DeletionQueueSection
          accessToken={accessToken}
          busy={busy}
          setBusy={setBusy}
          setMessage={setMessage}
          setError={setError}
        />
      ) : null}
    </div>
  )
}
