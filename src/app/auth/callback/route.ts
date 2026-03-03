import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // In production Vercel sets x-forwarded-host; use it to build the correct base URL.
      // In development use origin directly.
      const forwardedHost = request.headers.get('x-forwarded-host')
      const baseUrl =
        process.env.NODE_ENV === 'development'
          ? origin
          : forwardedHost
          ? `https://${forwardedHost}`
          : origin

      return NextResponse.redirect(`${baseUrl}${next}`)
    }
  }

  // No code param or exchange failed — redirect with error flag
  return NextResponse.redirect(`${origin}/?auth_error=true`)
}
