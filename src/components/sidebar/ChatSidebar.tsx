'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ConversationList } from './ConversationList'

interface Conversation {
  id: string
  title: string | null
  device: string
  updated_at: string
}

export function ChatSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const router = useRouter()

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(Array.isArray(data) ? data : [])
      }
    } catch {
      // Non-fatal — leave conversations as empty array
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Listen for new conversation creation from page.tsx (Phase 28 Plan 02)
  useEffect(() => {
    const handler = () => fetchConversations()
    window.addEventListener('helixtones:conversation-created', handler)
    return () => window.removeEventListener('helixtones:conversation-created', handler)
  }, [fetchConversations])

  async function handleDelete(id: string) {
    const prev = conversations
    // Optimistic remove
    setConversations(c => c.filter(conv => conv.id !== id))

    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setConversations(prev) // Rollback
        setDeleteError('Failed to delete. Please try again.')
        setTimeout(() => setDeleteError(null), 3000)
      }
    } catch {
      setConversations(prev) // Rollback
      setDeleteError('Failed to delete. Please try again.')
      setTimeout(() => setDeleteError(null), 3000)
    }
  }

  function handleNewChat() {
    window.dispatchEvent(new Event('helixtones:new-chat'))
    router.push('/')
    setIsOpen(false)
  }

  function handleSelect(id: string) {
    router.push(`/?conversation=${id}`)
    setIsOpen(false)
  }

  return (
    <>
      {/* Hamburger toggle — fixed top-left, always visible for authenticated users */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="fixed top-0 left-0 z-50 p-3 text-[var(--hlx-text-muted)] hover:text-[var(--hlx-text-sub)] transition-colors"
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-expanded={isOpen}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </>
          )}
        </svg>
      </button>

      {/* Sidebar panel — always mounted, toggled via CSS transform */}
      <aside
        className="fixed top-0 left-0 z-40 h-full w-64 flex flex-col bg-[var(--hlx-surface)] border-r border-[var(--hlx-border)] transition-transform duration-200 ease-in-out"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(-100%)' }}
        aria-hidden={!isOpen}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-[var(--hlx-border)]">
          <span
            className="text-[0.8125rem] font-medium text-[var(--hlx-text-sub)] tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-mono), monospace' }}
          >
            Sessions
          </span>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--hlx-border)] bg-[var(--hlx-elevated)] text-[11px] text-[var(--hlx-text-sub)] hover:border-[var(--hlx-border-warm)] hover:text-[var(--hlx-text)] transition-all"
            style={{ fontFamily: 'var(--font-mono), monospace' }}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Conversation list body */}
        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="hlx-spin h-4 w-4 text-[var(--hlx-text-muted)]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-center text-[11px] text-[var(--hlx-text-muted)] py-8 px-4">
              No sessions yet. Generate a preset to get started.
            </p>
          ) : (
            <ConversationList
              conversations={conversations}
              onSelect={handleSelect}
              onDelete={handleDelete}
            />
          )}
        </div>

        {/* Error toast */}
        {deleteError && (
          <div className="mx-3 mb-3 px-3 py-2 rounded-lg border border-red-900/30 bg-red-950/20 text-[11px] text-red-400">
            {deleteError}
          </div>
        )}
      </aside>

      {/* Mobile backdrop — tapping closes sidebar */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}
