-- ============================================================================
-- Voice cast: reusable personas + per-speaker mappings
-- ============================================================================

CREATE TABLE public.cast_personas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  accent TEXT NOT NULL DEFAULT '',
  age_range TEXT NOT NULL DEFAULT 'adult',
  gender TEXT NOT NULL DEFAULT 'unspecified',
  sample_line TEXT NOT NULL DEFAULT '',
  tone_tags TEXT[] NOT NULL DEFAULT '{}',
  color TEXT NOT NULL DEFAULT 'neutral',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cast_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own personas"
  ON public.cast_personas FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own personas"
  ON public.cast_personas FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own personas"
  ON public.cast_personas FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own personas"
  ON public.cast_personas FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all personas"
  ON public.cast_personas FOR SELECT
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER cast_personas_updated_at
  BEFORE UPDATE ON public.cast_personas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- script_cast: per-user mapping of a (case-insensitive) speaker name to a persona.
-- ----------------------------------------------------------------------------

CREATE TABLE public.script_cast (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  speaker_name TEXT NOT NULL,
  persona_id UUID NOT NULL REFERENCES public.cast_personas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX script_cast_user_speaker_idx
  ON public.script_cast (user_id, lower(speaker_name));

CREATE INDEX script_cast_persona_idx ON public.script_cast (persona_id);

ALTER TABLE public.script_cast ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cast"
  ON public.script_cast FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own cast"
  ON public.script_cast FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own cast"
  ON public.script_cast FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own cast"
  ON public.script_cast FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all cast"
  ON public.script_cast FOR SELECT
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER script_cast_updated_at
  BEFORE UPDATE ON public.script_cast
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();