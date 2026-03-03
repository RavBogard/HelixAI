import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createSupabaseServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id, title, device, preset_url, created_at, updated_at,
      messages(id, role, content, sequence_number, created_at)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .order('sequence_number', { referencedTable: 'messages', ascending: true })
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Step 1: Read preset_url and verify ownership BEFORE deleting the row.
  // Once the row is deleted, the URL is gone forever — this ordering is critical.
  const { data: conversation, error: fetchError } = await supabase
    .from('conversations')
    .select('id, preset_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Step 2: Delete preset file from Storage (non-fatal).
  // preset_url stores the storage object path (e.g., "{user_id}/{conv_id}/latest.hlx"),
  // NOT a full HTTPS URL — this is the Phase 26/27 contract.
  // Storage errors are intentionally ignored — the DB delete must proceed regardless.
  if (conversation.preset_url) {
    await supabase.storage.from('presets').remove([conversation.preset_url])
  }

  // Step 3: Delete the conversation row.
  // FK cascade on messages.conversation_id automatically deletes all messages.
  const { error: deleteError } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
