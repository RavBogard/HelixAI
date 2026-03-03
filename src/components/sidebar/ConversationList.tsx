'use client'

import { useState } from 'react'

interface Conversation {
  id: string
  title: string | null
  device: string
  updated_at: string
}

interface ConversationListProps {
  conversations: Conversation[]
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

function relativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (diffMins < 60) return rtf.format(-diffMins, 'minute')
  if (diffHours < 24) return rtf.format(-diffHours, 'hour')
  if (diffDays < 30) return rtf.format(-diffDays, 'day')
  return date.toLocaleDateString()
}

function deviceLabel(device: string): string {
  return device === 'helix_lt' ? 'LT'
    : device === 'helix_floor' ? 'FLOOR'
    : device === 'pod_go' ? 'POD GO'
    : device.toUpperCase()
}

export function ConversationList({ conversations, onSelect, onDelete }: ConversationListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function handleDeleteClick(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (confirmDelete === id) {
      onDelete(id)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
      // Auto-cancel confirm after 3 seconds
      setTimeout(() => setConfirmDelete(prev => prev === id ? null : prev), 3000)
    }
  }

  return (
    <ul className="space-y-0.5 px-2">
      {conversations.map((conv) => (
        <li key={conv.id} className="group relative">
          <button
            onClick={() => onSelect(conv.id)}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[var(--hlx-elevated)] transition-colors"
          >
            {/* Title */}
            <p className="text-[0.8125rem] text-[var(--hlx-text)] leading-snug truncate pr-7">
              {conv.title || 'Untitled Session'}
            </p>

            {/* Device badge + timestamp */}
            <div className="flex items-center gap-2 mt-1">
              <span
                className="px-1 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border border-[var(--hlx-border)] text-[var(--hlx-text-muted)] bg-[var(--hlx-surface)]"
                style={{ fontFamily: 'var(--font-mono), monospace' }}
              >
                {deviceLabel(conv.device)}
              </span>
              <span className="text-[10px] text-[var(--hlx-text-muted)]">
                {relativeTime(conv.updated_at)}
              </span>
            </div>
          </button>

          {/* Delete button — appears on hover or when confirming */}
          <button
            onClick={(e) => handleDeleteClick(e, conv.id)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center transition-all ${
              confirmDelete === conv.id
                ? 'opacity-100 text-red-400 bg-red-950/30'
                : 'opacity-0 group-hover:opacity-100 text-[var(--hlx-text-muted)] hover:text-[var(--hlx-text-sub)]'
            }`}
            aria-label={confirmDelete === conv.id ? 'Confirm delete' : 'Delete session'}
            title={confirmDelete === conv.id ? 'Click again to confirm delete' : 'Delete session'}
          >
            {confirmDelete === conv.id ? (
              // Confirm: trash icon in red
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            ) : (
              // Default: smaller × icon
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
