import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/apiClient'

type DeletionRow = {
  id: string
  userId: string
  userEmail: string
  reason: string | null
  requestedAt: string
  scheduledFor: string
  isDue: boolean
}

type Props = {
  accessToken: string
  busy: boolean
  setBusy: (v: boolean) => void
  setMessage: (v: string) => void
  setError: (v: string) => void
}

export function DeletionQueueSection({
  accessToken,
  busy,
  setBusy,
  setMessage,
  setError,
}: Props) {
  const [rows, setRows] = useState<DeletionRow[]>([])

  const load = useCallback(async () => {
    try {
      const body = await apiGet<DeletionRow[]>('/admin/deletion-queue', accessToken)
      setRows(Array.isArray(body) ? body : [])
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : 'Could not load deletion queue')
    }
  }, [accessToken, setError])

  useEffect(() => {
    void load()
  }, [load])

  async function purgeDue() {
    if (
      !window.confirm(
        'Permanently delete all accounts whose deletion grace period has ended? This cannot be undone.',
      )
    ) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const body = await apiPost<{ purged?: number }>('/admin/purge-due', accessToken, {})
      setMessage(`Purged ${body.purged ?? 0} account(s).`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purge failed')
    } finally {
      setBusy(false)
    }
  }

  const dueCount = rows.filter((r) => r.isDue).length

  return (
    <section className="card cardWide adminSection">
      <h2>Account deletion queue</h2>
      <p className="hint adminDeletionHint">
        Users request deletion from Profile; accounts are removed only after{' '}
        <code>DELETE_RETENTION_DAYS</code> (not automatic — run purge when due). Ops can also call the
        purge-due API with <code>PURGE_ADMIN_SECRET</code> in the request body.
      </p>
      <div className="row">
        <button type="button" disabled={busy || dueCount === 0} onClick={() => void purgeDue()}>
          Purge {dueCount} due account{dueCount === 1 ? '' : 's'}
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="hint">No pending deletion requests.</p>
      ) : (
        <>
          <ul className="adminDeletionCards" aria-label="Pending deletion requests">
            {rows.map((r) => (
              <li key={r.id} className="adminDeletionCard">
                <p className="adminDeletionCardEmail">{r.userEmail}</p>
                <dl className="adminDeletionCardMeta">
                  <div>
                    <dt>Requested</dt>
                    <dd>{r.requestedAt.slice(0, 10)}</dd>
                  </div>
                  <div>
                    <dt>Scheduled</dt>
                    <dd>{r.scheduledFor.slice(0, 10)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{r.isDue ? 'Due now' : 'Waiting'}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="adminTableWrap adminTableWrapDesktop">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Requested</th>
                  <th>Scheduled purge</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.userEmail}</td>
                    <td>{r.requestedAt.slice(0, 10)}</td>
                    <td>{r.scheduledFor.slice(0, 10)}</td>
                    <td>{r.isDue ? 'Due now' : 'Waiting'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
