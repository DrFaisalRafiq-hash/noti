import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deviceId } from "./notes-store";

export interface DocumentFolder {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  device_id: string;
  file_name: string;
  caption: string | null;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  tags: string[];
  folder_id: string | null;
  pinned: boolean;
  archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export const DOC_BUCKET = "documents";
export const DOC_MAX_BYTES = 25 * 1024 * 1024;

export function classifyMime(mime: string): "pdf" | "image" | "video" | "audio" | "text" | "other" {
  if (!mime) return "other";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("text/") || mime === "application/json") return "text";
  return "other";
}

export function formatBytes(n: number) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

/** Get a fresh signed URL for previewing/downloading a private document. */
export async function getDocumentSignedUrl(
  storage_path: string,
  expiresIn = 60 * 60,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(DOC_BUCKET)
    .createSignedUrl(storage_path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Hook: documents + folders for the current device. */
export function useDocumentsStore() {
  const dev = deviceId();
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const [{ data: f }, { data: d }] = await Promise.all([
      supabase
        .from("document_folders")
        .select("*")
        .eq("device_id", dev)
        .order("created_at"),
      supabase
        .from("documents")
        .select("*")
        .eq("device_id", dev)
        .order("updated_at", { ascending: false }),
    ]);
    if (!aliveRef.current) return;
    setFolders((f as DocumentFolder[]) ?? []);
    setDocs((d as DocumentItem[]) ?? []);
    setLoaded(true);
  }, [dev]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createFolder = useCallback(
    async (name: string, color = "neutral") => {
      const { data, error } = await supabase
        .from("document_folders")
        .insert({ device_id: dev, name, color })
        .select()
        .single();
      if (error) throw error;
      setFolders((prev) => [...prev, data as DocumentFolder]);
      return data as DocumentFolder;
    },
    [dev],
  );

  const updateFolder = useCallback(
    async (id: string, patch: Partial<Pick<DocumentFolder, "name" | "color">>) => {
      const { data, error } = await supabase
        .from("document_folders")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      setFolders((prev) => prev.map((f) => (f.id === id ? (data as DocumentFolder) : f)));
    },
    [],
  );

  const deleteFolder = useCallback(async (id: string) => {
    const { error } = await supabase.from("document_folders").delete().eq("id", id);
    if (error) throw error;
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setDocs((prev) =>
      prev.map((d) => (d.folder_id === id ? { ...d, folder_id: null } : d)),
    );
  }, []);

  /** Upload a File to storage and insert a documents row. */
  const uploadDocument = useCallback(
    async (
      file: File,
      opts: { caption?: string; folder_id?: string | null; tags?: string[] } = {},
    ): Promise<DocumentItem> => {
      if (file.size > DOC_MAX_BYTES) {
        throw new Error(
          `File is too large (${formatBytes(file.size)}). Max is ${formatBytes(DOC_MAX_BYTES)}.`,
        );
      }
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const safeBase = `${Date.now()}-${crypto.randomUUID()}`;
      const path = `${dev}/${safeBase}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(DOC_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });
      if (upErr) throw upErr;

      const row = {
        device_id: dev,
        file_name: file.name,
        caption: opts.caption?.trim() || null,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        storage_path: path,
        tags: opts.tags ?? [],
        folder_id: opts.folder_id ?? null,
      };

      const { data, error } = await supabase
        .from("documents")
        .insert(row)
        .select()
        .single();
      if (error) {
        // Best-effort cleanup of the orphaned object
        await supabase.storage.from(DOC_BUCKET).remove([path]).catch(() => {});
        throw error;
      }
      const inserted = data as DocumentItem;
      setDocs((prev) => [inserted, ...prev]);
      return inserted;
    },
    [dev],
  );

  const updateDocument = useCallback(
    async (id: string, patch: Partial<DocumentItem>) => {
      // Optimistic
      setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
      const { data, error } = await supabase
        .from("documents")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        await refresh();
        throw error;
      }
      setDocs((prev) => prev.map((d) => (d.id === id ? (data as DocumentItem) : d)));
    },
    [refresh],
  );

  /** Soft-delete: set deleted_at. */
  const deleteDocument = useCallback(
    async (id: string) => {
      await updateDocument(id, { deleted_at: new Date().toISOString() } as Partial<DocumentItem>);
    },
    [updateDocument],
  );

  const restoreDocument = useCallback(
    async (id: string) => {
      await updateDocument(id, { deleted_at: null } as Partial<DocumentItem>);
    },
    [updateDocument],
  );

  /** Hard-delete: remove storage object + DB row. */
  const purgeDocument = useCallback(
    async (id: string) => {
      const target = docs.find((d) => d.id === id);
      if (target) {
        await supabase.storage.from(DOC_BUCKET).remove([target.storage_path]).catch(() => {});
      }
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
      setDocs((prev) => prev.filter((d) => d.id !== id));
    },
    [docs],
  );

  return {
    folders,
    docs,
    loaded,
    refresh,
    createFolder,
    updateFolder,
    deleteFolder,
    uploadDocument,
    updateDocument,
    deleteDocument,
    restoreDocument,
    purgeDocument,
  };
}
