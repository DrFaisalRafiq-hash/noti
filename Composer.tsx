import { useEffect, useRef, useState } from "react";
import {
  CheckSquare,
  FileText,
  X,
  Calendar,
  CalendarClock,
  Mic,
  MicOff,
  Sparkles,
  Image as ImageIcon,
  Link2,
  Loader2,
  Trash2,
  Wand2,
  Folder as FolderIcon,
  Plus,
  Copy,
  Share2,
  Mail,
  MessageSquare,
  ChevronDown,
  Settings2,
  Hash,
  PenLine,
  Maximize2,
  Minimize2,
  Undo2,
  Redo2,
  Printer,
  Download,
  Paperclip,
  File as FileIcon,
} from "lucide-react";
import StylusPad, { useHasPenInput } from "@/components/StylusPad";
import RichEditor, { type RichEditorHandle } from "@/components/RichEditor";
import ScriptEditor from "@/components/ScriptEditor";
import { bodyToPlainText as toPlainTextForBrief } from "@/lib/rich-text";
import { isScriptBody, parseScript } from "@/lib/podcast-script";
import AttachmentLightbox from "@/components/AttachmentLightbox";
import ShareNoteSheet from "@/components/ShareNoteSheet";
import { formatBytes } from "@/lib/documents-store";
import { bodyToPlainText, isHtmlBody } from "@/lib/rich-text";
import { NotiBell } from "@/components/icons/NotiBell";
import {
  haptic,
  type Note,
  type NoteMode,
  type Folder,
  extractUrls,
  uploadImage,
  uploadFile,
  aiAction,
  aiGenerateImage,
} from "@/lib/notes-store";
import { useDictation } from "@/hooks/useDictation";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FOLDER_COLORS,
  folderSwatchStyle,
  folderActiveStyle,
} from "@/lib/folder-colors";
import {
  priorityForUrgency,
  pickFolderByColor,
  defaultFolderNameForColor,
} from "@/lib/priority-routing";
import { getDefaultLeadMinutes } from "@/hooks/useDefaultLeadMinutes";

interface Props {
  note: Note; // always a real note (created on open)
  folders: Folder[];
  onClose: () => void;
  onPatch: (patch: Partial<Note>) => Promise<void> | void;
  onDelete: () => void;
  onAddLink: (url: string) => Promise<void> | void;
  onRemoveLink: (linkId: string) => Promise<void> | void;
  onAddAttachment: (a: { url: string; storage_path?: string; source: "upload" | "ai"; prompt?: string; mime_type?: string; file_name?: string; size_bytes?: number }) => Promise<void> | void;
  onRemoveAttachment: (attId: string) => Promise<void> | void;
  onCreateFolder: (name: string, color?: string) => Promise<Folder>;
  onUpdateFolder?: (id: string, patch: Partial<Folder>) => Promise<void> | void;
}

const modeMeta: Record<NoteMode, { label: string; icon: typeof FileText }> = {
  note: { label: "Note", icon: FileText },
  task: { label: "To-do", icon: CheckSquare },
  reminder: { label: "Reminder", icon: NotiBell },
  meeting: { label: "Meeting", icon: CalendarClock },
  script: { label: "Script", icon: Mic },
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function defaultDateTime(offsetHours = 1) {
  const d = new Date(Date.now() + offsetHours * 3600000);
  d.setSeconds(0, 0);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export default function Composer({
  note,
  folders,
  onClose,
  onPatch,
  onDelete,
  onAddLink,
  onRemoveLink,
  onAddAttachment,
  onRemoveAttachment,
  onCreateFolder,
  onUpdateFolder,
}: Props) {
  // Treat the "Untitled" sentinel created by the Skip flow as empty so the
  // auto-title path engages on save.
  const viewportHeight = useViewportHeight();
  const [title, setTitle] = useState(
    note.title && note.title !== "Untitled" ? note.title : ""
  );
  const [text, setText] = useState(note.text);
  const [mode, setMode] = useState<NoteMode>(note.mode);
  const [folderId, setFolderIdRaw] = useState<string | null>(note.folder_id);
  // True while `folderId` was set by the urgency auto-router. A user picking a
  // folder manually flips this off; clearing back to Inbox flips it on again
  // so the router may re-route on the next mode/date change.
  const [autoMapped, setAutoMapped] = useState<boolean>(!note.folder_id);
  const setFolderId = (id: string | null, opts?: { auto?: boolean }) => {
    setFolderIdRaw(id);
    setAutoMapped(opts?.auto ?? false);
  };
  const [tags, setTags] = useState<string[]>(note.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  const init = note.remind_at ? new Date(note.remind_at) : null;
  const def = defaultDateTime(1);
  const [date, setDate] = useState(
    init ? `${init.getFullYear()}-${pad(init.getMonth() + 1)}-${pad(init.getDate())}` : def.date
  );
  const [time, setTime] = useState(
    init ? `${pad(init.getHours())}:${pad(init.getMinutes())}` : def.time
  );

  // Heads-up lead time. New notes inherit the global default from Settings;
  // existing notes keep whatever was previously saved (including 0/null = off).
  const [notifyLeadMinutes, setNotifyLeadMinutes] = useState<number | null>(() => {
    if (note.id) return note.notify_lead_minutes ?? null;
    return getDefaultLeadMinutes();
  });

  const ref = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<RichEditorHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const anyFileRef = useRef<HTMLInputElement>(null);
  const dict = useDictation();
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgBusy, setImgBusy] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  // (AI tools moved into the bottom-toolbar sheet — no inline collapse needed)
  const [showImgGen, setShowImgGen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState<string>("amber");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  // Stylus / pen ink mode. Off by default; the toggle only appears on
  // pen-capable devices (or once a pen pointer event has been seen).
  const hasPen = useHasPenInput();
  const [stylusOpen, setStylusOpen] = useState(false);
  const [penFreehand, setPenFreehand] = useState<boolean>(() => {
    try { return localStorage.getItem("noti.penFreehand") === "1"; } catch { return false; }
  });
  // Progressive disclosure — keep the writing surface clean. Each section
  // collapses behind its own header until the user opens it.
  const [openSection, setOpenSection] = useState<
    null | "mode" | "folder" | "tags" | "photos" | "links" | "share" | "ai"
  >(null);
  // Top-bar share icon — opens a quick share sheet with the current draft body.
  const [headerShareOpen, setHeaderShareOpen] = useState(false);
  // (toggleSection helper removed — toolbar now opens sheets directly)
  // Focus mode — hides the top bar and bottom toolbar so only the title and
  // body remain. A small floating pill lets the user exit. Persisted across
  // composer opens so writers stay in the zone.
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    try { return localStorage.getItem("noti.focusMode") === "1"; } catch { return false; }
  });
  const toggleFocus = () => {
    setFocusMode((v) => {
      const next = !v;
      try { localStorage.setItem("noti.focusMode", next ? "1" : "0"); } catch {}
      haptic.light();
      // Closing any open sheet keeps the screen truly empty when entering focus.
      if (next) setOpenSection(null);
      return next;
    });
  };

  const addTag = (raw: string) => {
    const cleaned = raw.trim().replace(/^#+/, "").toLowerCase();
    if (!cleaned) return;
    setTags((prev) => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
    setTagInput("");
  };
  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));
  const dragCounter = useRef(0);

  // ---- Undo / redo history for title + body --------------------------------
  // We snapshot the current { title, text } whenever the user pauses typing
  // (debounced ~400ms) so undo jumps back in chunks rather than character by
  // character — closer to native iOS/macOS undo behavior than per-keystroke.
  type EditSnap = { title: string; text: string };
  const history = useRef<EditSnap[]>([{ title, text }]);
  const historyIndex = useRef(0);
  // Set true while applying an undo/redo so the debounced pusher doesn't
  // record the programmatic state change as a brand-new history entry.
  const applyingHistory = useRef(false);
  const [historyTick, setHistoryTick] = useState(0); // forces re-render for button enabled state

  useEffect(() => {
    if (applyingHistory.current) {
      applyingHistory.current = false;
      return;
    }
    const t = setTimeout(() => {
      const cur = history.current[historyIndex.current];
      if (cur && cur.title === title && cur.text === text) return;
      // Drop any "redo" tail when the user types after undoing.
      const trimmed = history.current.slice(0, historyIndex.current + 1);
      trimmed.push({ title, text });
      // Cap memory: keep the most recent 100 snapshots.
      const capped = trimmed.length > 100 ? trimmed.slice(trimmed.length - 100) : trimmed;
      history.current = capped;
      historyIndex.current = capped.length - 1;
      setHistoryTick((x) => x + 1);
    }, 400);
    return () => clearTimeout(t);
  }, [title, text]);

  const canUndo = historyIndex.current > 0;
  const canRedo = historyIndex.current < history.current.length - 1;

  const applySnap = (snap: EditSnap) => {
    applyingHistory.current = true;
    setTitle(snap.title);
    setText(snap.text);
  };
  const undo = () => {
    if (!canUndo) return;
    historyIndex.current -= 1;
    applySnap(history.current[historyIndex.current]);
    setHistoryTick((x) => x + 1);
    haptic.light();
  };
  const redo = () => {
    if (!canRedo) return;
    historyIndex.current += 1;
    applySnap(history.current[historyIndex.current]);
    setHistoryTick((x) => x + 1);
    haptic.light();
  };

  // Keyboard shortcuts: ⌘/Ctrl+Z, ⌘/Ctrl+Shift+Z (or Ctrl+Y on Windows).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyTick]);

  // ---- Restore-on-close snapshot -------------------------------------------
  // Snapshot the note as it was when the composer opened. If the user closes
  // and we silently persist a draft (or auto-title), we surface a toast with
  // an "Undo" action that rewinds the note back to this exact state — and
  // hard-deletes the row if it was a fresh blank draft to begin with.
  const openSnapshot = useRef<{
    title: string;
    text: string;
    mode: NoteMode;
    folder_id: string | null;
    tags: string[];
    remind_at: string | null;
    notify_lead_minutes: number | null;
    wasFreshDraft: boolean;
  }>({
    title: note.title ?? "",
    text: note.text ?? "",
    mode: note.mode,
    folder_id: note.folder_id,
    tags: note.tags ?? [],
    remind_at: note.remind_at ?? null,
    notify_lead_minutes: note.notify_lead_minutes ?? null,
    wasFreshDraft: (note as any).__freshDraft === true,
  });


  // ---- Urgency → priority folder auto-routing -----------------------------
  // When the user picks "to do" / "remind" / "meeting" (or changes the due
  // time), map the urgency to a priority color and drop the note into a
  // matching folder. Only runs while the folder is auto-mapped, so a manual
  // pick is never overwritten.
  const routingBusy = useRef(false);
  useEffect(() => {
    if (!autoMapped) return;
    if (mode === "note" || mode === "script") return; // no urgency routing
    if (routingBusy.current) return;

    const remindAtIso =
      (mode === "reminder" || mode === "meeting") && date && time
        ? new Date(`${date}T${time}`).toISOString()
        : null;
    const targetColor = priorityForUrgency(mode as any, remindAtIso);
    if (!targetColor) return;

    const existing = pickFolderByColor(folders, targetColor);
    // If the current auto-mapped folder already matches the target color,
    // there's nothing to do — avoid useless reshuffling between buckets of
    // the same priority.
    if (folderId && folders.find((f) => f.id === folderId)?.color === targetColor) return;

    if (existing) {
      setFolderIdRaw(existing.id);
      // keep autoMapped = true so future urgency changes still re-route
      return;
    }

    // No folder of that color yet — create one with a sensible default name.
    routingBusy.current = true;
    (async () => {
      try {
        const created = await onCreateFolder(defaultFolderNameForColor(targetColor), targetColor);
        setFolderIdRaw(created.id);
      } catch {
        // creation failed (offline, etc.) — silently leave folder unset; the
        // user can still pick one manually.
      } finally {
        routingBusy.current = false;
      }
    })();
    // We intentionally do NOT depend on `folderId` here: we only react to
    // urgency *inputs* changing, not to our own writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, date, time, autoMapped, folders]);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.setSelectionRange(text.length, text.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-grow the textarea up to ~60vh as content grows (typed, dictated, or
  // pasted). Past that, internal scrolling kicks in so the sheet itself
  // doesn't balloon off-screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const max = Math.floor((typeof window !== "undefined" ? window.innerHeight : 800) * 0.78);
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [text, dict.interim, dict.listening, stylusOpen]);

  // Live dictation: commit final speech into the rich editor (which handles
  // line breaks naturally as new paragraphs).
  useEffect(() => {
    if (dict.finalText) {
      const piece = (dict.finalText ?? "").trim();
      if (piece) editorRef.current?.append(" " + piece);
      dict.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dict.finalText]);

  // Derive a quick fallback title from the body — used when AI is unavailable.
  const deriveTitle = (body: string): string => {
    const cleaned = body.replace(/\s+/g, " ").trim();
    if (!cleaned) return "Untitled";
    // Prefer the first sentence-like fragment, capped to ~60 chars / 8 words.
    const firstChunk = cleaned.split(/[.!?\n]/)[0] ?? cleaned;
    const words = firstChunk.split(" ").slice(0, 8).join(" ");
    return words.length > 60 ? words.slice(0, 60).trimEnd() + "…" : words;
  };

  const handleSave = async () => {
    let trimmedTitle = title.trim();
    const trimmedText = text.trim();
    // Plain-text version of the body, used wherever AI / titling needs prose
    // rather than HTML markup. `deriveTitle` and similar helpers operate on
    // human-readable text, not tags.
    const plainBody = bodyToPlainText(trimmedText).trim();

    // No title AND no body → refuse (don't save blank notes).
    if (!trimmedTitle && !plainBody) {
      toast.error("Add a title or some content first");
      return;
    }

    // No title but has content → auto-title via AI, with a local fallback.
    if (!trimmedTitle) {
      setSavingTitle(true);
      try {
        const r = await aiAction("title", plainBody);
        const generated = (r?.result || "")
          .toString()
          .replace(/^["'`]+|["'`]+$/g, "")
          .replace(/[.!?\s]+$/g, "")
          .split("\n")[0]
          .trim();
        trimmedTitle = generated || deriveTitle(plainBody);
      } catch {
        trimmedTitle = deriveTitle(plainBody);
      } finally {
        setSavingTitle(false);
      }
      setTitle(trimmedTitle);
      toast.success(`Auto-titled “${trimmedTitle}”`);
    }

    haptic.success();
    const patch: Partial<Note> = {
      title: trimmedTitle,
      text: trimmedText,
      mode,
      folder_id: folderId,
      tags,
    };
    if ((mode === "reminder" || mode === "meeting") && date && time) {
      patch.remind_at = new Date(`${date}T${time}`).toISOString();
      patch.fired = false;
      patch.notify_lead_minutes = notifyLeadMinutes;
    } else {
      patch.remind_at = null;
      patch.notify_lead_minutes = null;
    }
    await onPatch(patch);
    onClose();
  };

  /**
   * Close handler used by the X button and backdrop. Instead of dropping work,
   * we silently save whatever the user typed as a draft. Rules:
   *  - If the note is a freshly created blank draft AND nothing was added
   *    (no title beyond placeholder, no body, no tags, no attachments, no
   *    links) → delete the placeholder so the list isn't littered.
   *  - Otherwise persist the current state and close. The Draft pill in the
   *    header already signals "no real title yet"; we auto-derive one so the
   *    note stays visible in lists.
   */
  const handleClose = async () => {
    const trimmedTitle = title.trim();
    const trimmedText = text.trim();
    // For HTML bodies, "<p></p>" should not count as content.
    const plainBody = bodyToPlainText(trimmedText).trim();
    const isFreshDraft = (note as any).__freshDraft === true;
    const placeholderTitles = new Set(["Untitled", "Untitled draft", ""]);
    const hasMeaningfulTitle = !!trimmedTitle && !placeholderTitles.has(trimmedTitle);
    const hasContent =
      hasMeaningfulTitle ||
      !!plainBody ||
      tags.length > 0 ||
      (note.attachments?.length ?? 0) > 0 ||
      (note.links?.length ?? 0) > 0;

    if (isFreshDraft && !hasContent) {
      // Nothing entered — quietly remove the placeholder row.
      onDelete();
      onClose();
      return;
    }

    if (!hasContent) {
      onClose();
      return;
    }

    // Persist as draft. Keep an existing real title; otherwise derive one
    // from the body so the note remains scannable in lists.
    const finalTitle = hasMeaningfulTitle
      ? trimmedTitle
      : plainBody
        ? deriveTitle(plainBody)
        : "Untitled draft";
    const patch: Partial<Note> = {
      title: finalTitle,
      text: trimmedText,
      mode,
      folder_id: folderId,
      tags,
    };
    if ((mode === "reminder" || mode === "meeting") && date && time) {
      patch.remind_at = new Date(`${date}T${time}`).toISOString();
      patch.fired = false;
      patch.notify_lead_minutes = notifyLeadMinutes;
    }
    try {
      await onPatch(patch);
      // Surface an Undo action so an accidental close doesn't permanently
      // mutate the note. For a brand-new draft, Undo deletes the row outright;
      // for an existing note, it rewinds to the pre-edit snapshot.
      const snap = openSnapshot.current;
      const noteId = note.id;
      toast.success(
        isFreshDraft && !hasMeaningfulTitle ? "Saved as draft" : "Draft saved",
        {
          duration: 8000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                if (snap.wasFreshDraft) {
                  onDelete();
                  toast("Draft discarded");
                  return;
                }
                await onPatch({
                  title: snap.title,
                  text: snap.text,
                  mode: snap.mode,
                  folder_id: snap.folder_id,
                  tags: snap.tags,
                  remind_at: snap.remind_at,
                  notify_lead_minutes: snap.notify_lead_minutes,
                  fired: snap.remind_at ? false : undefined,
                });
                toast("Reverted");
              } catch {
                toast.error("Couldn't undo");
              }
            },
          },
        }
      );
      void noteId;
    } catch {
      // Swallow — the user's primary intent was to close.
    }
    onClose();
  };

  const runAi = async (action: string) => {
    if (!text.trim()) {
      toast.error("Add some text first.");
      return;
    }
    // The body is HTML when the rich editor is in use; AI prompts work best
    // with plain text, so flatten before sending.
    const plain = bodyToPlainText(text);
    setAiBusy(action);
    try {
      if (action === "categorize") {
        const folderNames = folders.map((f) => f.name);
        const r = await aiAction("categorize", plain, folderNames);
        let fid = folderId;
        if (r?.folder) {
          const existing = folders.find((f) => f.name.toLowerCase() === String(r.folder).toLowerCase());
          if (existing) fid = existing.id;
          else {
            const created = await onCreateFolder(String(r.folder));
            fid = created.id;
          }
          setFolderId(fid);
        }
        const aiTags = Array.isArray(r?.tags) ? (r.tags as string[]) : [];
        setTags(aiTags);
        await onPatch({
          folder_id: fid,
          category: r?.category || null,
          tags: aiTags,
        });
        toast.success(`Filed in “${r.folder}”`);
      } else {
        const r = await aiAction(action, plain);
        if (r?.result) {
          setText(r.result);
          // Mirror the change into the rich editor so the body visibly updates.
          editorRef.current?.setContent(r.result);
          toast.success("Done");
        }
      }
    } catch (e: any) {
      const { handleAiError } = await import("@/lib/wallet-store");
      if (!handleAiError(e)) toast.error(e?.message || "AI request failed");
    } finally {
      setAiBusy(null);
    }
  };

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files);
    if (!arr.length) return;
    for (const f of arr) {
      try {
        if (f.type.startsWith("image/")) {
          const { url, storage_path } = await uploadImage(f, note.id);
          await onAddAttachment({
            url,
            storage_path,
            source: "upload",
            mime_type: f.type,
            file_name: f.name,
            size_bytes: f.size,
          });
        } else {
          const meta = await uploadFile(f, note.id);
          await onAddAttachment({ ...meta, source: "upload" });
        }
      } catch (e: any) {
        toast.error(e?.message || `Upload failed: ${f.name}`);
      }
    }
  };

  const handleGenerateImage = async () => {
    if (!imgPrompt.trim()) return;
    setImgBusy(true);
    try {
      const { url, storage_path } = await aiGenerateImage(imgPrompt, note.id);
      await onAddAttachment({ url, storage_path, source: "ai", prompt: imgPrompt });
      setImgPrompt("");
      setShowImgGen(false);
      toast.success("Image generated");
    } catch (e: any) {
      const { handleAiError } = await import("@/lib/wallet-store");
      if (!handleAiError(e)) toast.error(e?.message || "Image generation failed");
    } finally {
      setImgBusy(false);
    }
  };

  const handleAddLinkInput = async () => {
    const raw = linkInput.trim();
    if (!raw) return;
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      new URL(normalized);
      await onAddLink(normalized);
      setLinkInput("");
    } catch {
      toast.error("Not a valid URL");
    }
  };

  // Auto-detect URLs in text and offer to attach
  const detectedUrls = extractUrls(text).filter(
    (u) => !(note.links || []).some((l) => l.url === u)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center animate-fade-in"
      onClick={handleClose}
    >
      <div
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          height: viewportHeight ? `${viewportHeight}px` : "100%",
        }}
        className={cn(
          "relative w-full h-full bg-paper shadow-lift animate-sheet-up flex flex-col transition-smooth rounded-none",
          // True edge-to-edge fullscreen on all viewports (mobile, iPad, desktop)
          // so the editor uses every pixel and the keyboard never covers it.
          dragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
        onClick={(e) => e.stopPropagation()}
        onDragEnter={(e) => {
          if (!Array.from(e.dataTransfer.types).includes("Files")) return;
          e.preventDefault();
          dragCounter.current += 1;
          setDragOver(true);
        }}
        onDragOver={(e) => {
          if (!Array.from(e.dataTransfer.types).includes("Files")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          if (!Array.from(e.dataTransfer.types).includes("Files")) return;
          e.preventDefault();
          dragCounter.current -= 1;
          if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setDragOver(false);
          }
        }}
        onDrop={(e) => {
          if (!Array.from(e.dataTransfer.types).includes("Files")) return;
          e.preventDefault();
          dragCounter.current = 0;
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        {dragOver && (
          <div className="hidden sm:flex pointer-events-none absolute inset-0 z-10 items-center justify-center bg-foreground/5 backdrop-blur-[2px] rounded-2xl animate-fade-in">
            <div className="bg-paper hairline border rounded-2xl px-5 py-4 shadow-lift flex items-center gap-3">
              <ImageIcon className="h-5 w-5 text-primary" />
              <span className="font-display text-sm ink">Drop files to attach</span>
            </div>
          </div>
        )}
        <div className="sm:hidden pt-2 pb-1 flex justify-center flex-shrink-0">
          <div className="h-1 w-10 rounded-full bg-foreground/15" />
        </div>

        {/* Apple Notes-style ultra-minimal top bar — just close + Done.
            No "Edit" label, no Draft pill in chrome (the pill moves to the
            title placeholder area below). Maximizes writing surface. */}
        {!focusMode && (
          <div className="flex items-center justify-between px-3 pt-2 pb-2 flex-shrink-0">
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-secondary transition-smooth" aria-label="Close (saves draft)">
              <X className="h-5 w-5 ink-soft" />
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-2 rounded-full hover:bg-secondary transition-smooth disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Undo"
                title="Undo (⌘Z)"
              >
                <Undo2 className="h-[18px] w-[18px] ink-soft" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-2 rounded-full hover:bg-secondary transition-smooth disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Redo"
                title="Redo (⇧⌘Z)"
              >
                <Redo2 className="h-[18px] w-[18px] ink-soft" />
              </button>
              <button
                onClick={() => setHeaderShareOpen(true)}
                className="p-2 rounded-full hover:bg-secondary transition-smooth"
                aria-label="Share note"
                title="Share"
              >
                <Share2 className="h-[18px] w-[18px] ink-soft" />
              </button>
              <button
                onClick={toggleFocus}
                className="p-2 rounded-full hover:bg-secondary transition-smooth"
                aria-label="Enter focus mode"
                title="Focus mode"
              >
                <Maximize2 className="h-[18px] w-[18px] ink-soft" />
              </button>
              <button
                onClick={handleSave}
                disabled={savingTitle}
                className="px-4 py-1.5 rounded-full text-sm font-semibold text-primary hover:bg-secondary transition-smooth disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {savingTitle && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {savingTitle ? "Titling…" : "Done"}
              </button>
            </div>
          </div>
        )}

        {focusMode && (
          <button
            type="button"
            onClick={toggleFocus}
            aria-label="Exit focus mode"
            title="Exit focus mode"
            className="absolute z-20 top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-paper/90 hairline border ink-soft text-[11px] font-medium hover:bg-sunk transition-smooth shadow-soft"
            style={{ marginTop: "env(safe-area-inset-top)" }}
          >
            <Minimize2 className="h-3.5 w-3.5" />
            Exit focus
          </button>
        )}

        <div className="overflow-y-auto px-5 pt-1 pb-3 space-y-3 flex-1">
          {/* Title — borderless, flows into body like Apple Notes */}
          <div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              maxLength={120}
              className="w-full bg-transparent outline-none font-display text-2xl font-semibold ink placeholder:ink-faint"
            />
            {!title.trim() && bodyToPlainText(text).trim() && (
              <p className="text-[10px] ink-faint mt-0.5 inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                We'll auto-title on Done.
              </p>
            )}
          </div>

          {mode === "script" ? (
            <ScriptEditor
              initial={note.text ?? ""}
              sourceText={
                isScriptBody(note.text) ? undefined : toPlainTextForBrief(note.text || "")
              }
              onChange={(next) => setText(next)}
              historyKey={`note:${note.id}`}
            />
          ) : (
          <>
          {/* Rich-text editor + dictation + stylus */}
          <div className="relative">
            {stylusOpen ? (
              <StylusPad
                height={Math.max(320, Math.min(560, (typeof window !== "undefined" ? window.innerHeight : 800) * 0.45))}
                acceptAnyPointer={penFreehand}
                onClose={() => setStylusOpen(false)}
                onConvert={(recognised) => {
                  if (recognised) editorRef.current?.append(" " + recognised);
                  setStylusOpen(false);
                  toast.success("Handwriting added to note");
                }}
              />
            ) : (
              <RichEditor
                ref={editorRef}
                initial={note.text ?? ""}
                placeholder={dict.listening ? "Listening…" : "Start writing…"}
                interim={dict.listening ? dict.interim : undefined}
                hideToolbar={focusMode}
                onChange={(html) => setText(html)}
                className="pr-20"
              />
            )}
            {/* Always-mounted hidden file inputs — must exist regardless of
                which side panel (photos / tags / etc.) is open, otherwise the
                quick-attach paperclip below has no target to click. */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
            />
            <input
              ref={anyFileRef}
              type="file"
              multiple
              hidden
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
            />
            {/* Quick attach (paperclip) — bottom-left of editor area. */}
            {!stylusOpen && !dict.listening && (
              <button
                type="button"
                onClick={() => { haptic.light(); anyFileRef.current?.click(); }}
                title="Attach file"
                aria-label="Attach file"
                className="absolute bottom-1 left-0 h-9 w-9 rounded-full inline-flex items-center justify-center bg-paper hairline border ink-soft hover:bg-sunk transition-smooth shadow-soft"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            )}
            {/* Stylus toggle — only shown on pen-capable devices, or always when
                in stylus mode so the user can dismiss it. */}
            {(hasPen || stylusOpen) && !dict.listening && (
              <button
                type="button"
                onClick={() => {
                  haptic.light();
                  setStylusOpen((s) => !s);
                }}
                aria-pressed={stylusOpen}
                title={stylusOpen ? "Switch back to keyboard" : "Write with stylus"}
                className={cn(
                  "absolute top-1 right-0 h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-[11px] font-medium border hairline transition-smooth",
                  stylusOpen
                    ? "bg-foreground text-background border-foreground"
                    : "bg-paper ink-soft hover:bg-sunk",
                )}
              >
                <PenLine className="h-3.5 w-3.5" />
                {stylusOpen ? "Keyboard" : "Stylus"}
              </button>
            )}
            {/* Dictation mic — prominent floating control */}
            {!stylusOpen && (
              <button
                onClick={() => {
                  if (!dict.supported) return;
                  haptic.medium();
                  if (dict.listening) dict.stop();
                  else dict.start();
                }}
                disabled={!dict.supported}
                aria-label={dict.listening ? "Stop dictation" : "Start dictation"}
                aria-pressed={dict.listening}
                title={dict.supported ? (dict.listening ? "Stop dictation" : "Dictate") : "Dictation not supported in this browser"}
                className={cn(
                  "absolute bottom-1 right-0 h-14 w-14 rounded-full flex items-center justify-center transition-all shadow-soft border-2",
                  dict.listening
                    ? "bg-destructive text-destructive-foreground border-destructive scale-110 animate-pulse-ring"
                    : dict.supported
                    ? "bg-foreground text-background border-foreground hover:scale-105 hover:shadow-lg"
                    : "bg-sunk text-muted-foreground border-border opacity-50 cursor-not-allowed"
                )}
              >
                {dict.listening ? <MicOff className="h-6 w-6" strokeWidth={2.25} /> : <Mic className="h-6 w-6" strokeWidth={2.25} />}
                {/* Live "REC" dot */}
                {dict.listening && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-background border-2 border-destructive animate-pulse" />
                )}
              </button>
            )}
            {/* Helper label below the mic on idle */}
            {!stylusOpen && !dict.listening && dict.supported && !text && (
              <span className="absolute bottom-[-1.25rem] right-1 text-[10px] uppercase tracking-[0.18em] ink-faint pointer-events-none">
                Tap to dictate
              </span>
            )}
            {!stylusOpen && dict.listening && (
              <span className="absolute bottom-[-1.25rem] right-1 text-[10px] uppercase tracking-[0.18em] text-destructive font-semibold pointer-events-none">
                Listening…
              </span>
            )}
          </div>
          </>
          )}
          {/* Inline attachment previews — visible immediately as files upload,
              with per-item remove buttons so users can drop attachments before
              saving. Tapping the section pill still opens a richer manager. */}
          {(note.attachments?.length ?? 0) > 0 && (
            <div className="mt-3 space-y-2 animate-fade-in">
              {(() => {
                const all = note.attachments ?? [];
                const images = all.filter((a) => !a.mime_type || a.mime_type.startsWith("image/"));
                const files = all.filter((a) => a.mime_type && !a.mime_type.startsWith("image/"));
                return (
                  <>
                    {images.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {images.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              haptic.light();
                              setLightboxId(a.id);
                            }}
                            className="relative group/inline aspect-square rounded-xl overflow-hidden bg-sunk hairline border cursor-zoom-in text-left"
                            aria-label="Open image"
                          >
                            <img
                              src={a.url}
                              alt={a.prompt || a.file_name || ""}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            {a.source === "ai" && (
                              <span className="absolute top-1 left-1 text-[9px] uppercase tracking-wide font-bold bg-foreground/70 text-background px-1.5 py-0.5 rounded backdrop-blur-sm">
                                AI
                              </span>
                            )}
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => { e.stopPropagation(); haptic.light(); onRemoveAttachment(a.id); }}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); haptic.light(); onRemoveAttachment(a.id); } }}
                              aria-label="Remove attachment"
                              title="Remove"
                              className="absolute top-1 right-1 h-7 w-7 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover/inline:opacity-100 transition-smooth cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {files.length > 0 && (
                      <div className="space-y-1.5">
                        {files.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sunk hairline border group/inlinef"
                          >
                            <FileIcon className="h-4 w-4 ink-faint flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm ink truncate">{a.file_name || "File"}</div>
                              <div className="text-[10px] ink-faint truncate">
                                {formatBytes(a.size_bytes ?? 0)}{a.mime_type ? ` · ${a.mime_type}` : ""}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => { haptic.light(); onRemoveAttachment(a.id); }}
                              aria-label="Remove attachment"
                              title="Remove"
                              className="h-7 w-7 rounded-md hairline border ink-faint hover:bg-paper hover:text-destructive flex items-center justify-center transition-smooth opacity-100 sm:opacity-0 sm:group-hover/inlinef:opacity-100"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          {/* Optional toggle: allow finger / mouse drawing inside stylus mode. */}
          {stylusOpen && (
            <label className="flex items-center gap-2 text-[11px] ink-faint -mt-1">
              <input
                type="checkbox"
                checked={penFreehand}
                onChange={(e) => {
                  setPenFreehand(e.target.checked);
                  try { localStorage.setItem("noti.penFreehand", e.target.checked ? "1" : "0"); } catch {}
                }}
                className="h-3.5 w-3.5"
              />
              Allow finger / mouse drawing too
            </label>
          )}
          {dict.error && (
            <p className="text-xs text-destructive -mt-2">{dict.error}</p>
          )}

        </div>

        {/* — — — Pinned bottom toolbar — — —
            Apple-Notes-style: stays at the bottom of the screen so the writing
            surface gets the rest. Includes AI tools, mode, folder, tags,
            photos, links, share, and delete. Tapping any icon opens a focused
            bottom-sheet. */}
        <div
          className={cn(
            "flex-shrink-0 border-t hairline bg-paper/95 backdrop-blur-sm px-3 pt-2 transition-all",
            focusMode && "hidden"
          )}
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
        >
          <OptionsToolbar
            mode={mode}
            modeMeta={modeMeta}
            folderName={folderId ? folders.find((f) => f.id === folderId)?.name ?? "Inbox" : "Inbox"}
            folderColor={folderId ? folders.find((f) => f.id === folderId)?.color : null}
            tagCount={tags.length}
            photoCount={note.attachments?.length ?? 0}
            linkCount={note.links?.length ?? 0}
            hasReminder={(mode === "reminder" || mode === "meeting") && !!date && !!time}
            onOpen={(s) => {
              haptic.light();
              setOpenSection(s);
            }}
            onDelete={() => {
              haptic.medium();
              onDelete();
              onClose();
            }}
          />
        </div>

        {/* Bottom-sheet for whichever option the user opened. Single sheet,
            single backdrop — keeps the composer chrome quiet. */}
        {openSection && (
          <OptionSheet
            title={
              openSection === "ai" ? "AI tools"
              : openSection === "mode" ? "Treat as"
              : openSection === "folder" ? "Folder"
              : openSection === "tags" ? "Tags"
              : openSection === "photos" ? "Photos"
              : openSection === "links" ? "Links"
              : "Share"
            }
            onClose={() => setOpenSection(null)}
          >
            {openSection === "ai" && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { k: "expand", l: "Expand" },
                  { k: "summarize", l: "Summarize" },
                  { k: "rewrite_concise", l: "Make concise" },
                  { k: "rewrite_formal", l: "Make formal" },
                  { k: "rewrite_casual", l: "Make casual" },
                  { k: "categorize", l: "Auto-file" },
                ].map((b) => (
                  <button
                    key={b.k}
                    disabled={!!aiBusy}
                    onClick={async () => { await runAi(b.k); setOpenSection(null); }}
                    className="inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium bg-sunk hairline border ink hover:bg-secondary transition-smooth disabled:opacity-50"
                  >
                    {aiBusy === b.k ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {b.l}
                  </button>
                ))}
              </div>
            )}
            {openSection === "mode" && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(modeMeta) as NoteMode[]).map((m) => {
                    const Icon = modeMeta[m].icon;
                    const active = mode === m;
                    return (
                      <button
                        key={m}
                        onClick={() => { haptic.light(); setMode(m); }}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-smooth",
                          active
                            ? "bg-foreground text-background border-foreground"
                            : "bg-paper hairline ink-soft hover:bg-sunk"
                        )}
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                        <span className="text-[11px] font-medium">{modeMeta[m].label}</span>
                      </button>
                    );
                  })}
                </div>

                {(mode === "reminder" || mode === "meeting") && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.14em] ink-faint mb-1.5 font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {mode === "meeting" ? "Meeting date" : "Date"}
                        </div>
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full bg-sunk hairline border rounded-xl px-3 py-2.5 ink outline-none focus:border-primary transition-smooth"
                        />
                      </label>
                      <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.14em] ink-faint mb-1.5 font-medium">Time</div>
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className="w-full bg-sunk hairline border rounded-xl px-3 py-2.5 ink outline-none focus:border-primary transition-smooth"
                        />
                      </label>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] ink-faint mb-1.5 font-medium flex items-center gap-1">
                        <NotiBell size={12} /> Heads-up
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { v: null, label: "Off" },
                          { v: 10, label: "10 min" },
                          { v: 30, label: "30 min" },
                        ] as const).map(({ v, label }) => {
                          const active = (notifyLeadMinutes ?? null) === v;
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => { haptic.light(); setNotifyLeadMinutes(v); }}
                              aria-pressed={active}
                              className={cn(
                                "px-3 py-2 rounded-xl text-[12px] font-medium border transition-smooth",
                                active
                                  ? "bg-foreground text-background border-foreground"
                                  : "bg-paper hairline ink-soft hover:bg-sunk"
                              )}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {openSection === "folder" && (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap items-center">
                  <button
                    onClick={() => setFolderId(null, { auto: true })}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-smooth",
                      folderId === null
                        ? "bg-foreground text-background border-foreground"
                        : "bg-paper hairline ink-soft hover:bg-sunk"
                    )}
                  >
                    Inbox
                  </button>
                  {folders.map((f) => {
                    const active = folderId === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFolderId(f.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-smooth",
                          !active && "bg-paper hairline ink-soft hover:bg-sunk"
                        )}
                        style={active ? folderActiveStyle(f.color) : undefined}
                      >
                        <span className="h-2 w-2 rounded-full" style={folderSwatchStyle(f.color)} />
                        {f.name}
                      </button>
                    );
                  })}
                  {showNewFolder ? (
                    <div className="flex items-center gap-2 bg-sunk hairline border rounded-full pl-2 pr-1 py-0.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={folderSwatchStyle(newFolderColor)} />
                      <input
                        autoFocus
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && newFolderName.trim()) {
                            const created = await onCreateFolder(newFolderName.trim(), newFolderColor);
                            setFolderId(created.id);
                            setNewFolderName("");
                            setShowNewFolder(false);
                          } else if (e.key === "Escape") {
                            setNewFolderName("");
                            setShowNewFolder(false);
                          }
                        }}
                        placeholder="Folder name"
                        className="bg-transparent text-xs ink outline-none w-28"
                      />
                      <div className="flex items-center gap-1 pl-1 border-l hairline">
                        {FOLDER_COLORS.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setNewFolderColor(c.id)}
                            title={c.label}
                            className={cn(
                              "h-4 w-4 rounded-full transition-smooth",
                              newFolderColor === c.id ? "ring-2 ring-offset-1 ring-offset-paper ring-foreground/40 scale-110" : "opacity-70 hover:opacity-100"
                            )}
                            style={folderSwatchStyle(c.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewFolder(true)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-paper hairline border ink-faint hover:bg-sunk transition-smooth flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> New
                    </button>
                  )}
                </div>
                {folderId && onUpdateFolder && (() => {
                  const f = folders.find((x) => x.id === folderId);
                  if (!f) return null;
                  return (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] uppercase tracking-[0.14em] ink-faint font-medium">Flag</span>
                      {FOLDER_COLORS.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => onUpdateFolder(f.id, { color: c.id })}
                          title={c.label}
                          className={cn(
                            "h-5 w-5 rounded-full transition-smooth",
                            f.color === c.id ? "ring-2 ring-offset-1 ring-offset-paper ring-foreground/40 scale-110" : "opacity-70 hover:opacity-100"
                          )}
                          style={folderSwatchStyle(c.id)}
                        />
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {openSection === "tags" && (
              <div className="space-y-3">
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-full bg-sunk hairline border ink-soft">
                        <span>#{t}</span>
                        <button type="button" onClick={() => removeTag(t)} aria-label={`Remove tag ${t}`} className="ink-faint hover:ink">
                          <X className="h-3 w-3" strokeWidth={2} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag(tagInput);
                      } else if (e.key === "Backspace" && !tagInput && tags.length) {
                        removeTag(tags[tags.length - 1]);
                      }
                    }}
                    placeholder="Add a tag and press Enter"
                    className="flex-1 bg-paper hairline border rounded-xl px-3 py-2 text-[13px] ink outline-none focus:border-primary/60 transition-smooth placeholder:ink-faint"
                  />
                  <button
                    type="button"
                    onClick={() => addTag(tagInput)}
                    disabled={!tagInput.trim()}
                    className="px-3 py-2 rounded-xl bg-foreground text-background text-[12px] font-medium disabled:opacity-40 transition-smooth"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {openSection === "photos" && (() => {
              const all = note.attachments ?? [];
              const images = all.filter((a) => !a.mime_type || a.mime_type.startsWith("image/"));
              const files = all.filter((a) => a.mime_type && !a.mime_type.startsWith("image/"));
              return (
              <div>
                <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
                  <button onClick={() => fileRef.current?.click()} className="font-medium ink-soft hover:ink transition-smooth">
                    Upload photo
                  </button>
                  <span className="ink-faint">·</span>
                  <button onClick={() => anyFileRef.current?.click()} className="font-medium ink-soft hover:ink transition-smooth inline-flex items-center gap-1">
                    <Paperclip className="h-3 w-3" /> Attach file
                  </button>
                  <span className="ink-faint">·</span>
                  <button onClick={() => setShowImgGen((s) => !s)} className="font-medium ink-soft hover:ink transition-smooth">
                    Generate with AI
                  </button>
                </div>
                {/* File inputs are rendered once at the composer root (below)
                    so the paperclip quick-attach button works even when the
                    photos section isn't open. */}
                {showImgGen && (
                  <div className="mb-3 flex gap-2 animate-fade-in">
                    <input
                      value={imgPrompt}
                      onChange={(e) => setImgPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleGenerateImage()}
                      placeholder="Describe the image…"
                      className="flex-1 bg-sunk hairline border rounded-xl px-3 py-2 text-sm ink outline-none focus:border-primary"
                    />
                    <button
                      onClick={handleGenerateImage}
                      disabled={imgBusy || !imgPrompt.trim()}
                      className="px-3 py-2 rounded-xl bg-foreground text-background text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {imgBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Generate
                    </button>
                  </div>
                )}
                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {images.map((a) => (
                      <div key={a.id} className="relative group/img aspect-square rounded-xl overflow-hidden bg-sunk hairline border">
                        <img src={a.url} alt={a.prompt || ""} className="w-full h-full object-cover" loading="lazy" />
                        {a.source === "ai" && (
                          <span className="absolute top-1 left-1 text-[9px] uppercase tracking-wide font-bold bg-foreground/70 text-background px-1.5 py-0.5 rounded backdrop-blur-sm">AI</span>
                        )}
                        <a
                          href={a.url}
                          download={a.file_name || undefined}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-1 right-1 h-6 w-6 rounded-full bg-foreground/70 text-background flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover/img:opacity-100 transition-smooth"
                          title="Download"
                        >
                          <Download className="h-3 w-3" />
                        </a>
                        <button
                          onClick={() => onRemoveAttachment(a.id)}
                          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-foreground/70 text-background flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover/img:opacity-100 transition-smooth"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {files.length > 0 && (
                  <div className="space-y-1.5">
                    {files.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sunk hairline border group/file">
                        <FileIcon className="h-4 w-4 ink-faint flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm ink truncate">{a.file_name || "File"}</div>
                          <div className="text-[10px] ink-faint">{formatBytes(a.size_bytes ?? 0)}{a.mime_type ? ` · ${a.mime_type}` : ""}</div>
                        </div>
                        <a
                          href={a.url}
                          download={a.file_name || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="h-7 w-7 rounded-md hairline border ink-faint hover:bg-paper hover:ink flex items-center justify-center transition-smooth"
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button onClick={() => onRemoveAttachment(a.id)} className="opacity-100 sm:opacity-0 sm:group-hover/file:opacity-100 transition-smooth">
                          <X className="h-4 w-4 ink-faint hover:text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {all.length === 0 && (
                  <p className="text-xs ink-faint">No attachments yet. Upload photos, attach any file, or generate an image with AI.</p>
                )}
              </div>
              );
            })()}

            {openSection === "links" && (
              <div>
                <div className="flex gap-2 mb-2">
                  <input
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddLinkInput()}
                    placeholder="Paste a URL…"
                    className="flex-1 bg-sunk hairline border rounded-xl px-3 py-2 text-sm ink outline-none focus:border-primary"
                  />
                  <button onClick={handleAddLinkInput} disabled={!linkInput.trim()} className="px-3 py-2 rounded-xl bg-foreground text-background text-sm font-medium disabled:opacity-50">
                    Add
                  </button>
                </div>
                {detectedUrls.length > 0 && (
                  <div className="mb-2 text-xs ink-faint">
                    Detected:{" "}
                    {detectedUrls.map((u) => (
                      <button key={u} onClick={() => onAddLink(u)} className="underline hover:ink-soft mr-2">
                        + {new URL(u).hostname}
                      </button>
                    ))}
                  </div>
                )}
                <div className="space-y-1.5">
                  {(note.links || []).map((l) => (
                    <div key={l.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sunk hairline border group/link">
                      {l.favicon && <img src={l.favicon} alt="" className="h-4 w-4 rounded-sm flex-shrink-0" />}
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm ink truncate hover:underline">
                        {l.title || l.url}
                      </a>
                      <button onClick={() => onRemoveLink(l.id)} className="opacity-100 sm:opacity-0 sm:group-hover/link:opacity-100 transition-smooth">
                        <X className="h-4 w-4 ink-faint hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                  {(note.links?.length ?? 0) === 0 && (
                    <p className="text-xs ink-faint">No links yet. Paste any URL to come back to it later.</p>
                  )}
                </div>
              </div>
            )}

            {openSection === "share" && (() => {
              const plain = bodyToPlainText(text).trim();
              const bodyIsHtml = isHtmlBody(text);
              const buildShareText = () => {
                const lines = [plain];
                if ((mode === "reminder" || mode === "meeting") && date && time) {
                  const when = new Date(`${date}T${time}`);
                  lines.push("");
                  lines.push(`${mode === "meeting" ? "Meeting" : "Reminder"}: ${when.toLocaleString()}`);
                }
                const links = note.links || [];
                if (links.length) {
                  lines.push("");
                  links.forEach((l) => lines.push(l.url));
                }
                return lines.join("\n");
              };
              const shareText = buildShareText();
              const subject = (title.trim() || plain.split("\n")[0] || "Note").slice(0, 80);
              const safeFile = subject.replace(/[^\w\s.-]+/g, "").replace(/\s+/g, "_").slice(0, 60) || "note";
              const downloadBlob = (content: string, mime: string, ext: string) => {
                try {
                  const blob = new Blob([content], { type: mime });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${safeFile}.${ext}`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                  haptic.success();
                  toast.success(`Exported .${ext}`);
                } catch { toast.error("Export failed"); }
              };
              const copyAll = async () => {
                try {
                  await navigator.clipboard.writeText(shareText);
                  haptic.success();
                  toast.success("Copied note");
                } catch { toast.error("Could not copy"); }
              };
              const sms = () => { window.location.href = `sms:?&body=${encodeURIComponent(shareText)}`; };
              const email = () => { window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`; };
              const share = async () => {
                if (navigator.share) {
                  try { await navigator.share({ title: subject, text: shareText }); } catch { /* cancel */ }
                } else copyAll();
              };
              const exportTxt = () => downloadBlob(shareText, "text/plain;charset=utf-8", "txt");
              const exportMd = () => {
                // For HTML bodies, fall back to plain text representation (already
                // includes • bullets and [x]/[ ] task markers from bodyToPlainText).
                const md = bodyIsHtml ? shareText : shareText;
                downloadBlob(md, "text/markdown;charset=utf-8", "md");
              };
              const print = () => {
                try {
                  const w = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
                  if (!w) { toast.error("Pop-up blocked"); return; }
                  const bodyHtml = bodyIsHtml
                    ? text
                    : `<pre style="white-space:pre-wrap;font-family:inherit;margin:0;">${shareText.replace(/[&<>]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c] as string))}</pre>`;
                  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${subject.replace(/</g, "&lt;")}</title><style>
                    body{font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111;max-width:720px;margin:32px auto;padding:0 24px;}
                    h1{font-size:22px;margin:0 0 16px;}
                    ul,ol{padding-left:1.4em;}
                    blockquote{border-left:3px solid #ccc;margin:0;padding-left:12px;color:#555;}
                    code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f4f4f4;padding:2px 4px;border-radius:4px;}
                    .meta{color:#666;font-size:12px;margin-bottom:20px;}
                  </style></head><body>
                    <h1>${subject.replace(/</g, "&lt;")}</h1>
                    <div class="meta">${new Date().toLocaleString()}</div>
                    ${bodyHtml}
                  </body></html>`);
                  w.document.close();
                  w.focus();
                  setTimeout(() => { try { w.print(); } catch {} }, 250);
                } catch { toast.error("Print failed"); }
              };
              const Btn = ({ onClick, icon: Icon, label }: any) => (
                <button onClick={onClick} className="flex-1 min-w-[80px] flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-sunk hairline border ink-soft hover:bg-secondary transition-smooth">
                  <Icon className="h-4 w-4" />
                  <span className="text-[11px] font-medium">{label}</span>
                </button>
              );
              return (
                <div className="flex gap-2 flex-wrap">
                  <Btn onClick={copyAll} icon={Copy} label="Copy all" />
                  <Btn onClick={print} icon={Printer} label="Print" />
                  <Btn onClick={exportTxt} icon={Download} label="Export .txt" />
                  <Btn onClick={exportMd} icon={Download} label="Export .md" />
                  <Btn onClick={sms} icon={MessageSquare} label="Text" />
                  <Btn onClick={email} icon={Mail} label="Email" />
                  {typeof navigator !== "undefined" && (navigator as any).share && (
                    <Btn onClick={share} icon={Share2} label="Share" />
                  )}
                </div>
              );
            })()}
          </OptionSheet>
        )}
      </div>
      <ShareNoteSheet
        open={headerShareOpen}
        onClose={() => setHeaderShareOpen(false)}
        note={note}
        bodyOverride={text}
        titleOverride={title}
      />
      {lightboxId && (() => {
        const imgs = (note.attachments ?? []).filter((a) => !a.mime_type || a.mime_type.startsWith("image/"));
        if (!imgs.some((i) => i.id === lightboxId)) return null;
        return (
          <AttachmentLightbox
            images={imgs}
            startId={lightboxId}
            onClose={() => setLightboxId(null)}
          />
        );
      })()}
    </div>
  );
}

/**
 * Compact icon-only toolbar that replaces the old stacked Options sections.
 * Each button opens a focused bottom sheet via `onOpen(key)`. Active items
 * show a small accent dot so the user knows what's set without expanding.
 */
function OptionsToolbar({
  mode,
  modeMeta,
  folderName,
  folderColor,
  tagCount,
  photoCount,
  linkCount,
  hasReminder,
  onOpen,
  onDelete,
}: {
  mode: NoteMode;
  modeMeta: Record<NoteMode, { label: string; icon: React.ComponentType<any> }>;
  folderName: string;
  folderColor: string | null | undefined;
  tagCount: number;
  photoCount: number;
  linkCount: number;
  hasReminder: boolean;
  onOpen: (s: "mode" | "folder" | "tags" | "photos" | "links" | "share" | "ai") => void;
  onDelete: () => void;
}) {
  const ModeIcon = modeMeta[mode].icon;
  const items: {
    key: "mode" | "folder" | "tags" | "photos" | "links" | "share" | "ai";
    icon: React.ComponentType<any>;
    label: string;
    badge?: React.ReactNode;
    active?: boolean;
  }[] = [
    { key: "ai", icon: Sparkles, label: "AI tools" },
    {
      key: "mode",
      icon: ModeIcon,
      label: modeMeta[mode].label,
      active: hasReminder || mode !== "note",
    },
    {
      key: "folder",
      icon: FolderIcon,
      label: folderName,
      badge: folderColor ? (
        <span className="h-1.5 w-1.5 rounded-full" style={folderSwatchStyle(folderColor)} />
      ) : null,
      active: !!folderColor,
    },
    { key: "tags", icon: Hash, label: "Tags", badge: tagCount > 0 ? tagCount : null, active: tagCount > 0 },
    { key: "photos", icon: ImageIcon, label: "Photos", badge: photoCount > 0 ? photoCount : null, active: photoCount > 0 },
    { key: "links", icon: Link2, label: "Links", badge: linkCount > 0 ? linkCount : null, active: linkCount > 0 },
    { key: "share", icon: Share2, label: "Share" },
  ];
  return (
    <div className="pt-2 mt-1 border-t hairline">
      <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-hide">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onOpen(it.key)}
              aria-label={it.label}
              title={it.label}
              className={cn(
                "relative flex-shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-full border hairline transition-smooth",
                it.active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-paper ink-soft hover:bg-sunk"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {it.badge != null && (
                <span className={cn(
                  "absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-semibold inline-flex items-center justify-center",
                  typeof it.badge === "number"
                    ? "bg-foreground text-background border border-paper"
                    : "border border-paper bg-sunk"
                )}>
                  {it.badge}
                </span>
              )}
            </button>
          );
        })}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete note"
          title="Delete note"
          className="flex-shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-full border hairline ink-faint hover:bg-destructive/10 hover:text-destructive transition-smooth"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

/**
 * Lightweight bottom sheet used by the OptionsToolbar. Slides up from the
 * bottom on mobile, centers on desktop. Closes on backdrop tap or the X.
 */
function OptionSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg max-h-[80dvh] bg-paper hairline border sm:rounded-2xl rounded-t-3xl shadow-lift flex flex-col animate-sheet-up sm:animate-slide-up"
      >
        <div className="sm:hidden pt-2 pb-1 flex justify-center flex-shrink-0">
          <div className="h-1 w-10 rounded-full bg-foreground/15" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b hairline flex-shrink-0">
          <span className="font-display text-base ink">{title}</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 -mr-2 rounded-full ink-soft hover:bg-sunk inline-flex items-center justify-center transition-smooth"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto px-5 py-4"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
