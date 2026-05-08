import { supabase } from "@/integrations/supabase/client";
import { deviceId } from "@/lib/notes-store";

export const MAX_RECORD_SECONDS = 60 * 60; // 1 hour cap

export interface VoiceMemo {
  id: string;
  device_id: string;
  title: string;
  url: string;
  storage_path: string;
  mime_type: string;
  duration_seconds: number;
  size_bytes: number;
  transcript: string | null;
  note_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Pick the best browser-supported audio mime type — Safari emits m4a, Chrome emits webm. */
export function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2", // Safari
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "audio/webm";
}

/** File extension that matches a mime type, used for downloads. */
export function extForMime(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(r).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** Upload an in-memory audio blob to Cloud storage. */
export async function uploadVoiceMemoBlob(blob: Blob, mime: string) {
  const ext = extForMime(mime);
  const path = `${deviceId()}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("voice-memos")
    .upload(path, blob, { contentType: mime, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("voice-memos").getPublicUrl(path);
  return { url: data.publicUrl, storage_path: path };
}

export async function listVoiceMemos(): Promise<VoiceMemo[]> {
  const { data, error } = await supabase
    .from("voice_memos")
    .select("*")
    .eq("device_id", deviceId())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as VoiceMemo[]) ?? [];
}

export async function createVoiceMemo(payload: {
  title: string;
  url: string;
  storage_path: string;
  mime_type: string;
  duration_seconds: number;
  size_bytes: number;
  note_id?: string | null;
}): Promise<VoiceMemo> {
  const { data, error } = await supabase
    .from("voice_memos")
    .insert({ ...payload, device_id: deviceId() })
    .select()
    .single();
  if (error) throw error;
  return data as VoiceMemo;
}

export async function updateVoiceMemo(id: string, patch: Partial<VoiceMemo>) {
  const { data, error } = await supabase
    .from("voice_memos")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as VoiceMemo;
}

export async function deleteVoiceMemo(memo: VoiceMemo) {
  if (memo.storage_path) {
    await supabase.storage.from("voice-memos").remove([memo.storage_path]);
  }
  const { error } = await supabase.from("voice_memos").delete().eq("id", memo.id);
  if (error) throw error;
}

/** Trigger a browser download for a public file URL. */
export async function downloadFromUrl(url: string, filename: string) {
  const resp = await fetch(url);
  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * Try the native OS share sheet (with the audio file when supported), then
 * fall back to sharing just a link. Returns true if the share dialog opened.
 */
export async function shareMemo(memo: VoiceMemo): Promise<boolean> {
  const filename = `${(memo.title || "voice-memo").replace(/[^\w\-]+/g, "_")}.${extForMime(memo.mime_type)}`;

  // Try sharing the actual audio file when the browser supports it.
  if (typeof navigator !== "undefined" && (navigator as any).canShare) {
    try {
      const resp = await fetch(memo.url);
      const blob = await resp.blob();
      const file = new File([blob], filename, { type: memo.mime_type });
      if ((navigator as any).canShare({ files: [file] })) {
        await (navigator as any).share({
          title: memo.title,
          text: `Voice memo: ${memo.title}`,
          files: [file],
        });
        return true;
      }
    } catch {
      // fall through to link share
    }
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: memo.title,
        text: `Voice memo: ${memo.title}`,
        url: memo.url,
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function emailMemo(memo: VoiceMemo) {
  const subject = encodeURIComponent(`Voice memo: ${memo.title}`);
  const body = encodeURIComponent(
    `Listen to this voice memo (${formatDuration(memo.duration_seconds)}):\n\n${memo.url}`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

export async function copyLink(url: string) {
  await navigator.clipboard.writeText(url);
}
