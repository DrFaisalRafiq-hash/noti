-- ── Enums ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.support_ticket_status AS ENUM ('open','in_progress','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_ticket_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Sequence for friendly ticket numbers ───────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.generate_support_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE n BIGINT;
BEGIN
  n := nextval('public.support_ticket_number_seq');
  RETURN 'NOTI-' || lpad(n::text, 6, '0');
END; $$;

-- ── Tickets table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number   TEXT NOT NULL UNIQUE DEFAULT public.generate_support_ticket_number(),
  user_id         UUID NOT NULL,
  user_email      TEXT,
  subject         TEXT NOT NULL,
  description     TEXT NOT NULL,
  status          public.support_ticket_status   NOT NULL DEFAULT 'open',
  priority        public.support_ticket_priority NOT NULL DEFAULT 'normal',
  assigned_to     UUID,
  page_url        TEXT,
  user_agent      TEXT,
  app_version     TEXT,
  diagnostics     JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_support_tickets_user      ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status    ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned  ON public.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_activity  ON public.support_tickets(last_activity_at DESC);

-- timestamp trigger reuses existing public.touch_updated_at()
DROP TRIGGER IF EXISTS trg_support_tickets_touch ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_touch
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: users see/own their tickets; admins see all
CREATE POLICY "Users insert own tickets"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users update own open tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status IN ('open','in_progress'))
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update all tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete tickets"
ON public.support_tickets FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ── Comments ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_ticket_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
  body        TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false, -- admin-only notes
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_support_comments_ticket
  ON public.support_ticket_comments(ticket_id, created_at);

-- A comment is visible if the user owns the ticket (and it isn't internal)
-- or the viewer is an admin.
CREATE POLICY "View ticket comments"
ON public.support_ticket_comments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  )
);

-- Insert: ticket owner posts non-internal comments; admins can post any.
CREATE POLICY "Insert ticket comments"
ON public.support_ticket_comments FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid() AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      is_internal = false
      AND EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = ticket_id AND t.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Admins delete comments"
ON public.support_ticket_comments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Bump ticket activity + status when a new comment lands
CREATE OR REPLACE FUNCTION public.support_bump_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_tickets
     SET last_activity_at = now(),
         status = CASE
           WHEN NEW.author_role = 'user' AND status = 'resolved' THEN 'open'::public.support_ticket_status
           ELSE status
         END
   WHERE id = NEW.ticket_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_support_bump_activity ON public.support_ticket_comments;
CREATE TRIGGER trg_support_bump_activity
AFTER INSERT ON public.support_ticket_comments
FOR EACH ROW EXECUTE FUNCTION public.support_bump_activity();

-- ── Attachments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_ticket_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  storage_path  TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  mime_type     TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes    BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_support_attachments_ticket
  ON public.support_ticket_attachments(ticket_id);

CREATE POLICY "View ticket attachments"
ON public.support_ticket_attachments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Insert ticket attachments"
ON public.support_ticket_attachments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins delete attachments"
ON public.support_ticket_attachments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Cap at 3 attachments per ticket
CREATE OR REPLACE FUNCTION public.support_cap_attachments()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE c INTEGER;
BEGIN
  SELECT count(*) INTO c FROM public.support_ticket_attachments
   WHERE ticket_id = NEW.ticket_id;
  IF c >= 3 THEN
    RAISE EXCEPTION 'Each ticket can have at most 3 attachments';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_support_cap_attachments ON public.support_ticket_attachments;
CREATE TRIGGER trg_support_cap_attachments
BEFORE INSERT ON public.support_ticket_attachments
FOR EACH ROW EXECUTE FUNCTION public.support_cap_attachments();

-- ── Storage bucket for attachments (private) ───────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: <user_id>/<ticket_id>/<filename>
CREATE POLICY "Support attachments — owner read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Support attachments — admin read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Support attachments — owner upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'support-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Support attachments — owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Support attachments — admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND public.has_role(auth.uid(), 'admin')
);
