ALTER TABLE public.note_attachments
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint NOT NULL DEFAULT 0;