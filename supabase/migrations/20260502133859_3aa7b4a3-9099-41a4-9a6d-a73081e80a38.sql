-- Podcast publishing settings, one row per user
CREATE TABLE public.podcast_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  host TEXT NOT NULL DEFAULT 'rsscom',
  api_key TEXT,
  show_id TEXT,
  default_author TEXT,
  default_author_email TEXT,
  default_explicit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.podcast_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own podcast settings"
  ON public.podcast_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own podcast settings"
  ON public.podcast_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own podcast settings"
  ON public.podcast_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own podcast settings"
  ON public.podcast_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all podcast settings"
  ON public.podcast_settings FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_podcast_settings_touch
  BEFORE UPDATE ON public.podcast_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Log of publishes to remote podcast hosts
CREATE TABLE public.episode_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  voice_memo_id UUID,
  script_note_id UUID,
  host TEXT NOT NULL,
  remote_episode_id TEXT,
  remote_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  title TEXT NOT NULL,
  description TEXT,
  error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.episode_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own publications"
  ON public.episode_publications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own publications"
  ON public.episode_publications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own publications"
  ON public.episode_publications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all publications"
  ON public.episode_publications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_episode_pub_user ON public.episode_publications(user_id, created_at DESC);

CREATE TRIGGER trg_episode_pub_touch
  BEFORE UPDATE ON public.episode_publications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();