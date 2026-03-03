'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface UserState {
  id: string
  is_anonymous?: boolean
  email?: string
  user_metadata?: Record<string, string>
}

export function AuthButton() {
  const router = useRouter()
  const [user, setUser] = useState<UserState | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const supabase = createSupabaseBrowserClient()

    // Set initial user state
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser as UserState | null)
    })

    // Subscribe to auth state changes and refresh server components
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser((session?.user as UserState | null) ?? null)
        router.refresh()
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  // router is stable — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSignIn() {
    // Dispatch event so page.tsx can serialize chat state before redirect
    window.dispatchEvent(new Event('helixai:before-signin'))

    const supabase = createSupabaseBrowserClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    if (currentUser?.is_anonymous) {
      // Preserve anonymous UUID — link Google identity to the same user
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) console.error('[AuthButton] linkIdentity error:', error.message)
    } else {
      // Fallback: no anonymous session exists — start a fresh OAuth flow
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) console.error('[AuthButton] signInWithOAuth error:', error.message)
    }
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    // Immediately restore anonymous session so the app always has a user ID
    await supabase.auth.signInAnonymously()
    router.refresh()
  }

  // Prevent hydration mismatch — render neutral placeholder until client mount
  if (!mounted) {
    return <div className="w-8 h-8" aria-hidden />
  }

  // Anonymous (or no user): show Sign in button
  if (user?.is_anonymous ?? true) {
    return (
      <button
        onClick={handleSignIn}
        className="text-sm px-3 py-1.5 rounded-lg border bg-[var(--hlx-elevated)] border-[var(--hlx-border)] text-[var(--hlx-text)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-surface)] transition-colors"
      >
        Sign in
      </button>
    )
  }

  // Authenticated: show avatar + Sign out
  const avatarUrl = user?.user_metadata?.avatar_url
  const emailInitial = user?.email ? user.email[0].toUpperCase() : '?'

  return (
    <div className="flex items-center gap-2">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt="Profile"
          className="w-7 h-7 rounded-full border border-[var(--hlx-border)]"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-[var(--hlx-elevated)] border border-[var(--hlx-border)] flex items-center justify-center text-xs font-semibold text-[var(--hlx-text)]">
          {emailInitial}
        </div>
      )}
      <button
        onClick={handleSignOut}
        className="text-sm px-3 py-1.5 rounded-lg border bg-[var(--hlx-elevated)] border-[var(--hlx-border)] text-[var(--hlx-text)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-surface)] transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}
