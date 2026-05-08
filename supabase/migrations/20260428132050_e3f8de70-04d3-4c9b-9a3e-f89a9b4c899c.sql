CREATE TABLE public.admin_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID NOT NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_user_id UUID,
  target_email TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX idx_admin_audit_log_target ON public.admin_audit_log (target_user_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit log entries. Inserts happen via the
-- service-role client in the admin-users edge function (RLS bypassed).
CREATE POLICY "Admins view audit log"
ON public.admin_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));