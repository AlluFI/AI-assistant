import { useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { fmtDateTime } from '../dashboard/dashboardUtils'
import { apiDelete, apiPatch } from '../lib/apiClient'
import type { ShoppingList } from './types'

const CATEGORY_ORDER = [
  'produce',
  'dairy',
  'protein',
  'grains',
  'pantry',
  'frozen',
  'beverages',
  'other',
] as const

const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  protein: 'Protein',
  grains: 'Grains & bakery',
  pantry: 'Pantry',
  frozen: 'Frozen',
  beverages: 'Beverages',
  other: 'Other',
}

type Props = {
  accessToken: string
  lists: ShoppingList[]
  selectedListId: string | null
  onSelectList: (id: string | null) => void
  onRefreshLists: () => Promise<void>
  isOpen: boolean
  onClose: () => void
  busy: boolean
  setBusy: (v: boolean) => void
  setMessage: (v: string) => void
  setError: (v: string) => void
}

function formatQty(item: ShoppingList['items'][0]): string {
  if (item.quantityMl != null && item.quantityMl > 0) {
    return `${Math.round(item.quantityMl)} ml`
  }
  if (item.quantityGrams != null && item.quantityGrams > 0) {
    const g = item.quantityGrams
    return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`
  }
  return '—'
}

export function ShoppingListPanel({
  accessToken,
  lists,
  selectedListId,
  onSelectList,
  onRefreshLists,
  isOpen,
  onClose,
  busy,
  setBusy,
  setMessage,
  setError,
}: Props) {
  const [editingQty, setEditingQty] = useState<Record<string, string>>({})
  const modalRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const focusableQuery = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ')

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const root = modalRef.current
      if (!root) return
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(focusableQuery)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [isOpen, onClose])

  const activeList = lists.find((l) => l.id === selectedListId) ?? lists[0] ?? null

  const itemsByCategory = useMemo(() => {
    if (!activeList) return []
    const map = new Map<string, ShoppingList['items']>()
    for (const item of activeList.items) {
      const cat = item.category || 'other'
      const list = map.get(cat) ?? []
      list.push(item)
      map.set(cat, list)
    }
    const order = [...CATEGORY_ORDER]
    return order
      .filter((cat) => map.has(cat))
      .map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat] ?? cat,
        items: (map.get(cat) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      }))
  }, [activeList])

  const visibleCount = activeList?.items.filter((i) => !i.excluded).length ?? 0
  const totalCount = activeList?.items.length ?? 0

  async function patchItem(
    itemId: string,
    body: { quantityGrams?: number; excluded?: boolean },
  ) {
    if (!activeList) return
    setBusy(true)
    setError('')
    try {
      await apiPatch(`/shopping-lists/${activeList.id}/items/${itemId}`, accessToken, body)
      await onRefreshLists()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update item')
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(itemId: string) {
    if (!activeList) return
    if (!window.confirm('Remove this ingredient from the list?')) return
    setBusy(true)
    setError('')
    try {
      await apiDelete(`/shopping-lists/${activeList.id}/items/${itemId}`, accessToken)
      setMessage('Item removed')
      await onRefreshLists()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove item')
    } finally {
      setBusy(false)
    }
  }

  function saveQuantity(itemId: string) {
    const raw = editingQty[itemId]
    if (raw === undefined) return
    const grams = Number.parseFloat(raw)
    if (!Number.isFinite(grams) || grams < 0) {
      setError('Enter a valid quantity in grams (0 or more).')
      return
    }
    setEditingQty((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
    void patchItem(itemId, { quantityGrams: grams })
  }

  function downloadPdf() {
    if (!activeList) return
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 14
    let y = 18

    const title = activeList.title ?? 'Shopping list'
    doc.setFontSize(16)
    doc.text(title, margin, y)
    y += 7
    doc.setFontSize(10)
    doc.text(`Created: ${fmtDateTime(activeList.createdAt)}`, margin, y)
    y += 7
    doc.text(`${visibleCount} of ${totalCount} items to buy`, margin, y)
    y += 9

    for (const group of itemsByCategory) {
      if (y > 275) {
        doc.addPage()
        y = 16
      }
      doc.setFontSize(12)
      doc.text(group.label, margin, y)
      y += 6
      doc.setFontSize(10)
      for (const item of group.items) {
        const marker = item.excluded ? '[x]' : '[ ]'
        const line = `${marker} ${item.name} - ${formatQty(item)}`
        const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2)
        for (const segment of wrapped) {
          if (y > 280) {
            doc.addPage()
            y = 16
          }
          doc.text(segment, margin + 2, y)
          y += 5
        }
      }
      y += 3
    }

    const filename = `${title.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || 'shopping_list'}.pdf`
    doc.save(filename)
  }

  if (!isOpen) {
    return null
  }

  if (!lists.length) {
    return (
      <div
        className="consentModalBackdrop shoppingListBackdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopping-list-title"
        aria-describedby="shopping-list-description"
        onClick={onClose}
      >
        <section
          ref={modalRef}
          className="card cardWide shoppingListPanel shoppingListModalCard"
          onClick={(e) => e.stopPropagation()}
        >
          <p id="shopping-list-description" className="srOnly">
            Edit shopping list items, update quantities, and download a PDF copy.
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            className="secondary shoppingModalCloseIcon"
            onClick={onClose}
            aria-label="Close shopping list"
          >
            ×
          </button>
          <div className="shoppingListHead">
            <h2 id="shopping-list-title">Shopping lists</h2>
            <button type="button" className="secondary" onClick={onClose}>
              Close
            </button>
          </div>
          <p className="hint">
            Create a list from <strong>Meal plan detail</strong> → <strong>Create shopping list</strong>. Your
            ingredients will appear here grouped by store aisle.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div
      className="consentModalBackdrop shoppingListBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopping-list-title"
      aria-describedby="shopping-list-description"
      onClick={onClose}
    >
      <section
        ref={modalRef}
        className="card cardWide shoppingListPanel shoppingListModalCard"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="shopping-list-description" className="srOnly">
          Edit shopping list items, update quantities, and download a PDF copy.
        </p>
        <button
          ref={closeButtonRef}
          type="button"
          className="secondary shoppingModalCloseIcon"
          onClick={onClose}
          aria-label="Close shopping list"
        >
          ×
        </button>
        <div className="shoppingListHead">
          <h2 id="shopping-list-title">Shopping lists</h2>
          <label>
            List
            <select
              value={activeList?.id ?? ''}
              onChange={(e) => onSelectList(e.target.value || null)}
              disabled={busy}
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title ?? 'Untitled list'} · {fmtDateTime(l.createdAt)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          <button type="button" className="secondary" onClick={downloadPdf} disabled={busy || !activeList}>
            Download PDF
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {activeList ? (
          <>
            <p className="hint shoppingListMeta">
              {visibleCount} of {totalCount} items to buy
              {activeList.mealPlanVersionId ? ' · from meal plan' : ''}
            </p>

          <div className="shoppingCategories">
            {itemsByCategory.map((group) => (
              <div key={group.category} className="shoppingCategory">
                <h3>{group.label}</h3>
                <ul className="shoppingItems">
                  {group.items.map((item) => {
                    const qtyKey = item.id
                    const editing = editingQty[qtyKey] !== undefined
                    const qtyValue =
                      editingQty[qtyKey] ??
                      (item.quantityGrams != null ? String(Math.round(item.quantityGrams)) : '')

                    return (
                      <li
                        key={item.id}
                        className={`shoppingItem${item.excluded ? ' excluded' : ''}`}
                      >
                        <label className="shoppingItemCheck">
                          <input
                            type="checkbox"
                            checked={!item.excluded}
                            disabled={busy}
                            onChange={(e) =>
                              void patchItem(item.id, { excluded: !e.target.checked })
                            }
                          />
                          <span className="shoppingItemName">{item.name}</span>
                        </label>
                        <div className="shoppingItemActions">
                          {editing ? (
                            <>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                className="shoppingQtyInput"
                                value={qtyValue}
                                disabled={busy}
                                onChange={(e) =>
                                  setEditingQty((prev) => ({
                                    ...prev,
                                    [qtyKey]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveQuantity(item.id)
                                }}
                              />
                              <span className="shoppingQtyUnit">g</span>
                              <button
                                type="button"
                                className="secondary"
                                disabled={busy}
                                onClick={() => saveQuantity(item.id)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                disabled={busy}
                                onClick={() =>
                                  setEditingQty((prev) => {
                                    const next = { ...prev }
                                    delete next[qtyKey]
                                    return next
                                  })
                                }
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="shoppingQtyDisplay">{formatQty(item)}</span>
                              <button
                                type="button"
                                className="secondary"
                                disabled={busy || item.excluded}
                                onClick={() =>
                                  setEditingQty((prev) => ({
                                    ...prev,
                                    [qtyKey]:
                                      item.quantityGrams != null
                                        ? String(Math.round(item.quantityGrams))
                                        : '0',
                                  }))
                                }
                              >
                                Edit qty
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="secondary dangerText"
                            disabled={busy}
                            onClick={() => void removeItem(item.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          {itemsByCategory.length === 0 ? (
            <p className="hint">This list has no items yet.</p>
          ) : null}
          </>
        ) : null}
      </section>
    </div>
  )
}
