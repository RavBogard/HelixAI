-- HelixAI v2.0 Database Schema
-- Run this in Supabase SQL Editor: Dashboard -> SQL Editor -> New query -> Paste -> Run
-- IMPORTANT: Do NOT modify table definitions after creation without updating RLS policies

-- ============================================================
-- conversations table
-- ============================================================

CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'New Chat',
  device      TEXT NOT NULL,           -- 'helixLT' | 'helixFloor' | 'podGo' (no CHECK — flexibility for future devices)
  preset_url  TEXT,                    -- Supabase Storage path; nullable until first generation
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS immediately after CREATE TABLE — no gap (CVE-2025-48757 prevention)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_conversations"
  ON conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- messages table
-- ============================================================

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,    -- server-assigned; never client-generated timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite index for correct ordering on fetch
CREATE INDEX idx_messages_conversation_sequence
  ON messages (conversation_id, sequence_number);

-- Enable RLS immediately after CREATE TABLE — no gap (CVE-2025-48757 prevention)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_messages"
  ON messages FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- Storage bucket: presets (private)
-- ============================================================

-- Private bucket — files accessible only via signed URLs
-- NOTE: If this INSERT fails with a permissions error, create the bucket manually:
--   Supabase Dashboard -> Storage -> New Bucket -> Name: "presets" -> Public: OFF -> Create
INSERT INTO storage.buckets (id, name, public)
VALUES ('presets', 'presets', false)
ON CONFLICT (id) DO NOTHING;

-- RLS is already enabled on storage.objects by Supabase — do NOT alter it

-- Path convention: {user_id}/{conversation_id}/latest.hlx (or .pgp)
-- storage.foldername is 1-indexed: [1] = user_id, [2] = conversation_id
-- All policies scoped to bucket_id = 'presets' and TO authenticated role

-- Users can upload their own preset files
CREATE POLICY "users_upload_own_presets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'presets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own preset files
CREATE POLICY "users_read_own_presets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'presets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update (upsert) their own preset files
CREATE POLICY "users_update_own_presets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'presets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own preset files
CREATE POLICY "users_delete_own_presets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'presets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
