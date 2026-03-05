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

    // If Supabase returned identity_already_exists, the Google account is already
    // linked to a previous user — retry with a plain OAuth sign-in to reach it.
    const params = new URLSearchParams(window.location.search)
    if (params.get('error_code') === 'identity_already_exists') {
      // Clean up the error params from the URL before redirecting
      window.history.replaceState({}, '', window.location.pathname)
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      return
    }

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
    window.dispatchEvent(new Event('helixtones:before-signin'))

    const supabase = createSupabaseBrowserClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    const oauthOptions = {
      provider: 'google' as const,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    }

    if (currentUser?.is_anonymous) {
      // Preserve anonymous UUID — link Google identity to the same user
      const { error } = await supabase.auth.linkIdentity(oauthOptions)
      if (error) {
        // Identity already linked to another account — sign in to that account instead
        const { error: oauthError } = await supabase.auth.signInWithOAuth(oauthOptions)
        if (oauthError) console.error('[AuthButton] signInWithOAuth error:', oauthError.message)
      }
    } else {
      // No anonymous session — start a fresh OAuth flow
      const { error } = await supabase.auth.signInWithOAuth(oauthOptions)
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

  function handleSupport() {
    window.dispatchEvent(new Event('helixtones:show-support'))
  }

  // Anonymous (or no user): show Support + Sign in
  if (user?.is_anonymous ?? true) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleSupport}
          className="text-sm px-3 py-1.5 text-[var(--hlx-text-muted)] hover:text-[var(--hlx-amber)] transition-colors"
        >
          Support
        </button>
        <button
          onClick={handleSignIn}
          className="text-sm px-3 py-1.5 rounded-lg border bg-[var(--hlx-elevated)] border-[var(--hlx-border)] text-[var(--hlx-text)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-surface)] transition-colors"
        >
          Sign in
        </button>
      </div>
    )
  }

  // Authenticated: show avatar + Sign out
  const avatarUrl = user?.user_metadata?.avatar_url
  const emailInitial = user?.email ? user.email[0].toUpperCase() : '?'

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSupport}
        className="text-sm px-3 py-1.5 text-[var(--hlx-text-muted)] hover:text-[var(--hlx-amber)] transition-colors"
      >
        Support
      </button>
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
