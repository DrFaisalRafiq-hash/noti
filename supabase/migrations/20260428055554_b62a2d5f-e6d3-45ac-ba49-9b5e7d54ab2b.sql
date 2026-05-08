-- Voice memos table
CREATE TABLE public.voice_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  title text NOT NULL DEFAULT 'Voice memo',
  url text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'audio/webm',
  duration_seconds integer NOT NULL DEFAULT 0,
  size_bytes integer NOT NULL DEFAULT 0,
  transcript text,
  note_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_memos_device ON public.voice_memos (device_id, created_at DESC);

ALTER TABLE public.voice_memos ENABLE ROW LEVEL SECURITY;

-- Match the existing open access pattern used by notes/folders.
CREATE POLICY "voice_memos open"
  ON public.voice_memos
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER voice_memos_touch_updated_at
  BEFORE UPDATE ON public.voice_memos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket for the audio files (public read so the <audio> tag can stream them).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-memos',
  'voice-memos',
  true,
  52428800, -- 50 MB
  ARRAY['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-m4a','audio/aac']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "voice memos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-memos');

CREATE POLICY "voice memos public insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-memos');

CREATE POLICY "voice memos public update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'voice-memos');

CREATE POLICY "voice memos public delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'voice-memos');