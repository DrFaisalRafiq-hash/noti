DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS priority public.task_priority NOT NULL DEFAULT 'medium';

CREATE INDEX IF NOT EXISTS notes_priority_idx ON public.notes (priority);