-- HelixTones v2.0 Database Schema
-- PART 1: Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> New query -> Paste -> Run)
-- PART 2: Storage bucket + policies must be created via Dashboard UI (see instructions below)

-- ============================================================
-- PART 1: Tables (run in SQL Editor)
-- ============================================================

-- conversations table
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

-- messages table
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
-- PART 2: Storage (do NOT run in SQL Editor — use Dashboard UI)
-- ============================================================
-- Supabase owns storage.objects so SQL Editor cannot CREATE POLICY on it.
--
-- Step 1: Create bucket
--   Dashboard -> Storage -> New Bucket
--   Name: "presets" | Public: OFF | Click Create
--
-- Step 2: Create 4 storage policies
--   Dashboard -> Storage -> Policies (on the "presets" bucket) -> New Policy -> "Full customization"
--
--   Policy 1 — INSERT (upload):
--     Name: users_upload_own_presets
--     Allowed operation: INSERT
--     Target roles: authenticated
--     WITH CHECK: bucket_id = 'presets' AND (storage.foldername(name))[1] = auth.uid()::text
--
--   Policy 2 — SELECT (read):
--     Name: users_read_own_presets
--     Allowed operation: SELECT
--     Target roles: authenticated
--     USING: bucket_id = 'presets' AND (storage.foldername(name))[1] = auth.uid()::text
--
--   Policy 3 — UPDATE (upsert):
--     Name: users_update_own_presets
--     Allowed operation: UPDATE
--     Target roles: authenticated
--     USING: bucket_id = 'presets' AND (storage.foldername(name))[1] = auth.uid()::text
--
--   Policy 4 — DELETE:
--     Name: users_delete_own_presets
--     Allowed operation: DELETE
--     Target roles: authenticated
--     USING: bucket_id = 'presets' AND (storage.foldername(name))[1] = auth.uid()::text

-- ============================================================
-- PART 3: Phase 66 Migration — Device Column backfill
-- ============================================================
-- Run this in Supabase Dashboard SQL Editor BEFORE deploying Phase 66 code.
-- The conversations table already has `device TEXT NOT NULL` (Part 1 above).
-- This backfill handles legacy rows created before the column existed or
-- rows where device was inserted as empty string due to bugs.
--
-- Step 1: Allow NULL temporarily (in case NOT NULL constraint blocks UPDATE)
-- ALTER TABLE conversations ALTER COLUMN device DROP NOT NULL;
--
-- Step 2: Backfill from preset_url extension heuristic
-- .hsp = helix_stadium, .pgp = pod_go, everything else = helix_lt
-- UPDATE conversations
-- SET device = CASE
--   WHEN preset_url LIKE '%.hsp' THEN 'helix_stadium'
--   WHEN preset_url LIKE '%.pgp' THEN 'pod_go'
--   ELSE 'helix_lt'
-- END
-- WHERE device IS NULL OR device = '';
--
-- Step 3: Re-enforce NOT NULL
-- ALTER TABLE conversations ALTER COLUMN device SET NOT NULL;
--
-- Step 4: Verify (should return 0)
-- SELECT COUNT(*) FROM conversations WHERE device IS NULL OR device = '';
