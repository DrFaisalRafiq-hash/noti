import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readSnapshot, writeSnapshot } from "./offline-cache";

export type NoteMode = "note" | "task" | "reminder" | "meeting" | "script";
export type TaskPriority = "low" | "medium" | "high";

export interface Folder {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface NoteLink {
  id: string;
  note_id: string;
  url: string;
  title: string | null;
  favicon: string | null;
}

export interface NoteAttachment {
  id: string;
  note_id: string;
  url: string;
  storage_path: string | null;
  source: "upload" | "ai";
  prompt: string | null;
  mime_type?: string | null;
  file_name?: string | null;
  size_bytes?: number | null;
}

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface Note {
  id: string;
  title: string | null;
  text: string;
  mode: NoteMode;
  done: boolean;
  remind_at: string | null;
  /** Optional heads-up window before due time, in minutes. null/0 = off. */
  notify_lead_minutes: number | null;
  fired: boolean;
  folder_id: string | null;
  category: string | null;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  locked?: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  priority?: TaskPriority;
  subtasks?: Subtask[];
  links?: NoteLink[];
  attachments?: NoteAttachment[];
}

/** How long a soft-deleted note stays in the trash before being purged. */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const DEVICE_KEY = "monolith-device-id";
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export const haptic = {
  light: () => navigator.vibrate?.(8),
  medium: () => navigator.vibrate?.(20),
  success: () => navigator.vibrate?.([10, 30, 10]),
  remind: () => navigator.vibrate?.([100, 50, 100, 50, 200]),
};

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (same(d, today)) return `Today · ${time}`;
  if (same(d, tomorrow)) return `Tomorrow · ${time}`;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + ` · ${time}`;
}

export function extractUrls(text: string): string[] {
  const re = /\bhttps?:\/\/[^\s)]+/gi;
  return Array.from(new Set((text.match(re) || []).map((u) => u.replace(/[.,;:!?)]+$/, ""))));
}

export function deviceId() {
  return getDeviceId();
}

// ─── data hook ───
export function useStore() {
  const dev = getDeviceId();
  // Hydrate synchronously from the offline snapshot so the UI is usable
  // immediately on cold start, even with no network.
  const initial = useRef(readSnapshot(dev));
  const [folders, setFolders] = useState<Folder[]>(initial.current?.folders ?? []);
  const [notes, setNotes] = useState<Note[]>(initial.current?.notes ?? []);
  const [loaded, setLoaded] = useState<boolean>(!!initial.current);
  const [offline, setOffline] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    initial.current?.savedAt ?? null
  );

  const refresh = useCallback(async () => {
    try {
      const [{ data: fs, error: fe }, { data: ns, error: ne }] = await Promise.all([
        supabase.from("folders").select("*").eq("device_id", dev).order("created_at"),
        supabase
          .from("notes")
          .select("*, note_links(*), note_attachments(*)")
          .eq("device_id", dev)
          .order("updated_at", { ascending: false })
          .range(0, 4999),
      ]);
      if (fe || ne) throw fe || ne;
      const nextFolders = (fs as Folder[]) || [];
      const nextNotes = ((ns as any[]) || []).map((n) => ({
        ...n,
        subtasks: Array.isArray(n.subtasks) ? n.subtasks : [],
        links: n.note_links || [],
        attachments: n.note_attachments || [],
      })) as Note[];
      setFolders(nextFolders);
      setNotes(nextNotes);
      setLoaded(true);
      setOffline(false);
      const stamp = new Date().toISOString();
      setLastSyncedAt(stamp);
      writeSnapshot(dev, nextFolders, nextNotes);
    } catch {
      // Network or backend unavailable — keep cached data and surface the
      // offline state. The UI stays browsable in read-only mode.
      setOffline(true);
      setLoaded(true);
    }
  }, [dev]);

  useEffect(() => {
    refresh();
    const onOnline = () => refresh();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refresh]);

  // Auto-purge: drop trashed notes older than the retention window.
  // Runs once after each successful sync.
  useEffect(() => {
    if (!loaded || offline) return;
    const cutoff = new Date(Date.now() - TRASH_RETENTION_MS).toISOString();
    const stale = notes.filter((n) => n.deleted_at && n.deleted_at < cutoff);
    if (!stale.length) return;
    (async () => {
      const ids = stale.map((n) => n.id);
      await supabase.from("notes").delete().in("id", ids);
      setNotes((p) => p.filter((n) => !ids.includes(n.id)));
    })();
  }, [loaded, offline, notes]);

  // Reminder ticker
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const t = setInterval(async () => {
      const due = notes.filter(
        (n) => (n.mode === "reminder" || n.mode === "meeting") && !n.fired && n.remind_at && new Date(n.remind_at).getTime() <= Date.now()
      );
      if (!due.length) return;
      for (const n of due) {
        haptic.remind();
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(n.mode === "meeting" ? "Meeting" : "Reminder", { body: n.text });
        }
        await supabase.from("notes").update({ fired: true }).eq("id", n.id);
      }
      refresh();
    }, 8000);
    return () => clearInterval(t);
  }, [notes, refresh]);

  // CRUD
  const createFolder = useCallback(
    async (name: string, color = "neutral") => {
      const { data, error } = await supabase
        .from("folders")
        .insert({ device_id: dev, name, color })
        .select()
        .single();
      if (error) throw error;
      setFolders((p) => [...p, data as Folder]);
      return data as Folder;
    },
    [dev]
  );

  const updateFolder = useCallback(async (id: string, patch: Partial<Folder>) => {
    const { data, error } = await supabase.from("folders").update(patch).eq("id", id).select().single();
    if (error) throw error;
    setFolders((p) => p.map((f) => (f.id === id ? (data as Folder) : f)));
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    await supabase.from("folders").delete().eq("id", id);
    setFolders((p) => p.filter((f) => f.id !== id));
    setNotes((p) => p.map((n) => (n.folder_id === id ? { ...n, folder_id: null } : n)));
  }, []);

  /**
   * Create a note. A non-empty `title` is required — the call rejects if
   * the caller passes an empty/whitespace-only title. This enforces the
   * "no draft is ever persisted without a title" rule at the data layer.
   */
  const createNote = useCallback(
    async (data: Partial<Note> & { title: string }): Promise<Note> => {
      const title = data.title.trim();
      if (!title) throw new Error("Title is required");
      const payload: any = {
        device_id: dev,
        title,
        text: data.text ?? "",
        mode: data.mode ?? "note",
        remind_at: data.remind_at ?? null,
        notify_lead_minutes: data.notify_lead_minutes ?? null,
        folder_id: data.folder_id ?? null,
      };
      if (data.priority) payload.priority = data.priority;
      const { data: row, error } = await supabase.from("notes").insert(payload).select().single();
      if (error) throw error;
      const note = { ...(row as unknown as Note), links: [], attachments: [], subtasks: [] };
      setNotes((p) => [note, ...p]);
      return note;
    },
    [dev]
  );

  const updateNote = useCallback(async (id: string, patch: Partial<Note>) => {
    const { links, attachments, subtasks, ...rest } = patch;
    const dbPatch: any = { ...rest };
    if (subtasks !== undefined) dbPatch.subtasks = subtasks as any;
    const { data, error } = await supabase.from("notes").update(dbPatch).eq("id", id).select().single();
    if (error) throw error;
    setNotes((p) => p.map((n) => (n.id === id ? { ...n, ...(data as unknown as Note) } : n)));
  }, []);

  // Soft delete: mark with deleted_at so the note moves to Trash where it
  // can be restored or purged. Auto-purges happen elsewhere (see effect below).
  const deleteNote = useCallback(async (id: string) => {
    const stamp = new Date().toISOString();
    const { data, error } = await supabase
      .from("notes")
      .update({ deleted_at: stamp })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setNotes((p) => p.map((n) => (n.id === id ? { ...n, ...(data as unknown as Note) } : n)));
  }, []);

  const restoreNote = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from("notes")
      .update({ deleted_at: null })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setNotes((p) => p.map((n) => (n.id === id ? { ...n, ...(data as unknown as Note) } : n)));
  }, []);

  /** Permanently delete a single note (irreversible). */
  const purgeNote = useCallback(async (id: string) => {
    await supabase.from("notes").delete().eq("id", id);
    setNotes((p) => p.filter((n) => n.id !== id));
  }, []);

  /** Permanently delete every note currently in the trash for this device. */
  const emptyTrash = useCallback(async () => {
    await supabase
      .from("notes")
      .delete()
      .eq("device_id", dev)
      .not("deleted_at", "is", null);
    setNotes((p) => p.filter((n) => !n.deleted_at));
  }, [dev]);

  const addLink = useCallback(async (noteId: string, url: string) => {
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      return;
    }
    const favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
    const { data, error } = await supabase
      .from("note_links")
      .insert({ note_id: noteId, url, title: host, favicon })
      .select()
      .single();
    if (error) throw error;
    setNotes((p) =>
      p.map((n) => (n.id === noteId ? { ...n, links: [...(n.links || []), data as unknown as NoteLink] } : n))
    );
  }, []);

  const removeLink = useCallback(async (noteId: string, linkId: string) => {
    await supabase.from("note_links").delete().eq("id", linkId);
    setNotes((p) =>
      p.map((n) => (n.id === noteId ? { ...n, links: (n.links || []).filter((l) => l.id !== linkId) } : n))
    );
  }, []);

  const addAttachment = useCallback(
    async (
      noteId: string,
      attachment: {
        url: string;
        storage_path?: string;
        source: "upload" | "ai";
        prompt?: string;
        mime_type?: string;
        file_name?: string;
        size_bytes?: number;
      }
    ) => {
      const { data, error } = await supabase
        .from("note_attachments")
        .insert({
          note_id: noteId,
          url: attachment.url,
          storage_path: attachment.storage_path ?? null,
          source: attachment.source,
          prompt: attachment.prompt ?? null,
          mime_type: attachment.mime_type ?? null,
          file_name: attachment.file_name ?? null,
          size_bytes: attachment.size_bytes ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      setNotes((p) =>
        p.map((n) =>
          n.id === noteId ? { ...n, attachments: [...(n.attachments || []), data as unknown as NoteAttachment] } : n
        )
      );
    },
    []
  );

  const removeAttachment = useCallback(async (noteId: string, att: NoteAttachment) => {
    await supabase.from("note_attachments").delete().eq("id", att.id);
    if (att.storage_path) {
      await supabase.storage.from("note-media").remove([att.storage_path]);
    }
    setNotes((p) =>
      p.map((n) =>
        n.id === noteId ? { ...n, attachments: (n.attachments || []).filter((a) => a.id !== att.id) } : n
      )
    );
  }, []);

  return {
    folders,
    notes,
    loaded,
    offline,
    lastSyncedAt,
    refresh,
    createFolder,
    updateFolder,
    deleteFolder,
    createNote,
    updateNote,
    deleteNote,
    restoreNote,
    purgeNote,
    emptyTrash,
    addLink,
    removeLink,
    addAttachment,
    removeAttachment,
  };
}

// ─── upload helpers ───
export async function uploadImage(file: File, noteId: string): Promise<{ url: string; storage_path: string }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `uploads/${noteId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("note-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("note-media").getPublicUrl(path);
  return { url: data.publicUrl, storage_path: path };
}

/**
 * Upload an arbitrary file (any mime type) as a note attachment.
 * Returns enough metadata to insert into note_attachments.
 */
export async function uploadFile(
  file: File,
  noteId: string
): Promise<{ url: string; storage_path: string; mime_type: string; file_name: string; size_bytes: number }> {
  const sanitizedName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
  const ext = (sanitizedName.split(".").pop() || "bin").toLowerCase();
  const path = `uploads/${noteId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("note-media")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;
  const { data } = supabase.storage.from("note-media").getPublicUrl(path);
  return {
    url: data.publicUrl,
    storage_path: path,
    mime_type: file.type || "application/octet-stream",
    file_name: file.name,
    size_bytes: file.size,
  };
}

// ─── AI helpers ───
// Throws a typed error for paywall: code='insufficient_credits' (402) or 'wallet_blocked' (403).
class AiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function invokeAi<T>(fn: string, body: any): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  // FunctionsHttpError carries the response in `context`
  if (error) {
    let payload: any = null;
    try {
      const ctx: any = (error as any).context;
      if (ctx?.json) payload = await ctx.json();
      else if (ctx?.body) payload = JSON.parse(await ctx.text());
    } catch { /* ignore */ }
    const status: number | undefined = (error as any).context?.status;
    const code = payload?.code;
    const msg = payload?.error ?? error.message ?? "AI request failed";
    throw new AiError(msg, code, status);
  }
  if ((data as any)?.error) {
    throw new AiError((data as any).error, (data as any).code);
  }
  return data as T;
}

export async function aiAction(action: string, text: string, folders?: string[]) {
  return invokeAi<any>("note-ai", { action, text, folders });
}

export async function aiGenerateImage(prompt: string, noteId: string) {
  return invokeAi<{ url: string; storage_path: string }>("generate-image", { prompt, noteId });
}

export { AiError };
