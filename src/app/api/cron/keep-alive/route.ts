import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Prevent caching of cron responses
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Validate CRON_SECRET to prevent unauthorized calls
  // Vercel automatically sends CRON_SECRET as a Bearer token in cron requests
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = await createSupabaseServerClient()

  // Execute a REAL database query — not an HTTP ping.
  // HTTP pings alone do not reliably prevent Supabase free-tier 7-day inactivity pause.
  // A query against an actual table registers as database activity.
  const { error } = await supabase
    .from('conversations')
    .select('id')
    .limit(1)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
}
