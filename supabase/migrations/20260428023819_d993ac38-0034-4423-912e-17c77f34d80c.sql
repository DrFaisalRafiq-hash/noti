-- Folders
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  name text not null,
  color text not null default 'neutral',
  created_at timestamptz not null default now()
);
create index folders_device_idx on public.folders(device_id);
alter table public.folders enable row level security;
create policy "folders open" on public.folders for all using (true) with check (true);

-- Notes
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  text text not null default '',
  mode text not null default 'note',
  done boolean not null default false,
  remind_at timestamptz,
  fired boolean not null default false,
  folder_id uuid references public.folders(id) on delete set null,
  category text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_device_idx on public.notes(device_id);
create index notes_folder_idx on public.notes(folder_id);
alter table public.notes enable row level security;
create policy "notes open" on public.notes for all using (true) with check (true);

-- Updated-at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger notes_touch before update on public.notes
for each row execute function public.touch_updated_at();

-- Links (web URLs)
create table public.note_links (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  url text not null,
  title text,
  favicon text,
  created_at timestamptz not null default now()
);
create index note_links_note_idx on public.note_links(note_id);
alter table public.note_links enable row level security;
create policy "note_links open" on public.note_links for all using (true) with check (true);

-- Attachments (images)
create table public.note_attachments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  url text not null,
  storage_path text,
  source text not null default 'upload', -- 'upload' | 'ai'
  prompt text,
  created_at timestamptz not null default now()
);
create index note_attachments_note_idx on public.note_attachments(note_id);
alter table public.note_attachments enable row level security;
create policy "note_attachments open" on public.note_attachments for all using (true) with check (true);

-- Storage bucket for media
insert into storage.buckets (id, name, public)
values ('note-media', 'note-media', true)
on conflict (id) do nothing;

create policy "note-media public read"
  on storage.objects for select
  using (bucket_id = 'note-media');

create policy "note-media open insert"
  on storage.objects for insert
  with check (bucket_id = 'note-media');

create policy "note-media open update"
  on storage.objects for update
  using (bucket_id = 'note-media');

create policy "note-media open delete"
  on storage.objects for delete
  using (bucket_id = 'note-media');