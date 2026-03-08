import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params

  const supabase = await createSupabaseServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify conversation ownership BEFORE saving the message
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let role: string, content: string;
  try {
    const body = await request.json();
    role = body.role;
    content = body.content;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (role !== 'user' && role !== 'assistant') {
    return NextResponse.json({ error: 'role must be user or assistant' }, { status: 400 })
  }

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  // Compute server-side sequence number — NEVER client-generated (STATE.md locked decision)
  const { data: maxSeq } = await supabase
    .from('messages')
    .select('sequence_number')
    .eq('conversation_id', conversationId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .single()

  const nextSeq = (maxSeq?.sequence_number ?? 0) + 1

  const { data: message, error: insertError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      sequence_number: nextSeq,
    })
    .select('id, conversation_id, role, content, sequence_number, created_at')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Update conversations.updated_at — fire-and-forget, does not block 201 response
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', user.id)

  return NextResponse.json(message, { status: 201 })
}
