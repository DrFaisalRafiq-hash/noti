ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS notes_pinned_idx ON public.notes (device_id, pinned);
CREATE INDEX IF NOT EXISTS notes_archived_idx ON public.notes (device_id, archived);