-- Documents folders (separate tree from notes folders)
CREATE TABLE public.document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'neutral',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_folders open"
  ON public.document_folders FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins view all document_folders"
  ON public.document_folders FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Documents
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  file_name text NOT NULL,
  caption text,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  folder_id uuid REFERENCES public.document_folders(id) ON DELETE SET NULL,
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents open"
  ON public.documents FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins view all documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER documents_touch_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_documents_device ON public.documents(device_id);
CREATE INDEX idx_documents_folder ON public.documents(folder_id);
CREATE INDEX idx_documents_tags ON public.documents USING GIN(tags);

-- Storage bucket: private, 25 MB cap, anything goes.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 26214400)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 26214400, public = false;

CREATE POLICY "documents bucket read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

CREATE POLICY "documents bucket insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents bucket update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents');

CREATE POLICY "documents bucket delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents');