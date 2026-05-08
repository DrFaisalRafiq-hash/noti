ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS notes_deleted_at_idx ON public.notes (deleted_at);