import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Temporary verification route for Phase 24 — will be deleted after checkpoint confirms it works
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return NextResponse.json({ user: user?.id ?? null, error: error?.message ?? null })
}
