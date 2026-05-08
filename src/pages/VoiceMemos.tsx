import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Share2,
  Mail,
  Link2,
  Download,
  Trash2,
  Mic,
  Pencil,
  Check,
} from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";
import {
  copyLink,
  deleteVoiceMemo,
  downloadFromUrl,
  emailMemo,
  extForMime,
  formatDuration,
  listVoiceMemos,
  shareMemo,
  updateVoiceMemo,
  type VoiceMemo,
} from "@/lib/voice-memos";
import { toast } from "sonner";
import { relativeTime } from "@/lib/notes-store";
import { cn } from "@/lib/utils";

export default function VoiceMemos() {
  const [memos, setMemos] = useState<VoiceMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecorder, setShowRecorder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const refresh = useCallback(async () => {
    try {
      setMemos(await listVoiceMemos());
    } catch (e: any) {
      toast.error(e?.message || "Couldn't load memos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleShare = async (memo: VoiceMemo) => {
    const ok = await shareMemo(memo);
    if (!ok) {
      await copyLink(memo.url);
      toast.success("Link copied to clipboard");
    }
  };

  const handleCopyLink = async (memo: VoiceMemo) => {
    await copyLink(memo.url);
    toast.success("Link copied");
  };

  const handleDownload = async (memo: VoiceMemo) => {
    const ext = extForMime(memo.mime_type);
    const safe = (memo.title || "voice-memo").replace(/[^\w\-]+/g, "_");
    await downloadFromUrl(memo.url, `${safe}.${ext}`);
  };

  const handleDelete = async (memo: VoiceMemo) => {
    if (!confirm(`Delete "${memo.title}"? This cannot be undone.`)) return;
    try {
      await deleteVoiceMemo(memo);
      setMemos((p) => p.filter((m) => m.id !== memo.id));
      toast.success("Memo deleted");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  const startRename = (memo: VoiceMemo) => {
    setEditingId(memo.id);
    setEditingTitle(memo.title);
  };
  const commitRename = async (memo: VoiceMemo) => {
    const next = editingTitle.trim();
    if (!next || next === memo.title) {
      setEditingId(null);
      return;
    }
    try {
      await updateVoiceMemo(memo.id, { title: next });
      setMemos((p) => p.map((m) => (m.id === memo.id ? { ...m, title: next } : m)));
    } catch (e: any) {
      toast.error(e?.message || "Rename failed");
    } finally {
      setEditingId(null);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <div
        className="mx-auto max-w-3xl px-5 sm:px-8"
        style={{
          paddingBottom: "calc(8rem + env(safe-area-inset-bottom))",
        }}
      >
        <header
          className="pb-6 flex items-center justify-between gap-4"
          style={{ paddingTop: "calc(2.5rem + env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="h-10 w-10 rounded-full bg-sunk hairline border ink-soft hover:ink flex items-center justify-center"
              aria-label="Back to notes"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
            </Link>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] ink-faint font-medium">Audio</p>
              <h1 className="font-display text-3xl sm:text-4xl font-medium ink tracking-tight">
                Voice memos
              </h1>
            </div>
          </div>
          <button
            onClick={() => setShowRecorder((s) => !s)}
            className={cn(
              "h-12 px-5 rounded-full text-sm font-medium inline-flex items-center gap-2 active:scale-95 transition-smooth",
              showRecorder
                ? "bg-secondary ink"
                : "bg-foreground text-background"
            )}
          >
            <Mic className="h-4 w-4" />
            {showRecorder ? "Close" : "Record"}
          </button>
        </header>

        {showRecorder && (
          <div className="mb-6 animate-fade-in">
            <VoiceRecorder
              variant="full"
              onSaved={(memo) => {
                setMemos((p) => [memo, ...p]);
                setShowRecorder(false);
              }}
              onClose={() => setShowRecorder(false)}
            />
          </div>
        )}

        {loading ? (
          <p className="text-sm ink-faint">Loading…</p>
        ) : memos.length === 0 ? (
          <div className="mt-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-sunk hairline border flex items-center justify-center mb-4">
              <Mic className="h-7 w-7 ink-faint" strokeWidth={1.5} />
            </div>
            <p className="font-display text-lg ink mb-1">No memos yet</p>
            <p className="text-sm ink-faint max-w-xs mx-auto">
              Tap Record to capture up to 1 hour of audio. Save to the cloud, download, or share.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {memos.map((memo) => (
              <li
                key={memo.id}
                className="bg-paper hairline border rounded-2xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {editingId === memo.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => commitRename(memo)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(memo);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="flex-1 bg-transparent outline-none ink font-display text-base border-b hairline border-foreground/20"
                        />
                        <button
                          onClick={() => commitRename(memo)}
                          className="p-1.5 rounded-full hover:bg-secondary"
                          aria-label="Save title"
                        >
                          <Check className="h-4 w-4 ink-soft" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startRename(memo)}
                        className="text-left group inline-flex items-center gap-1.5 max-w-full"
                      >
                        <span className="font-display text-base ink truncate">{memo.title}</span>
                        <Pencil className="h-3 w-3 ink-faint opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </button>
                    )}
                    <p className="text-[11px] ink-faint mt-0.5">
                      {formatDuration(memo.duration_seconds)} · {relativeTime(memo.created_at)}
                    </p>
                  </div>
                </div>

                <audio controls preload="none" src={memo.url} className="w-full" />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleShare(memo)}
                    className="h-9 px-3 rounded-full bg-foreground text-background text-xs font-medium inline-flex items-center gap-1.5 active:scale-95"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>
                  <button
                    onClick={() => handleCopyLink(memo)}
                    className="h-9 px-3 rounded-full bg-secondary ink text-xs font-medium inline-flex items-center gap-1.5 active:scale-95"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Copy link
                  </button>
                  <button
                    onClick={() => emailMemo(memo)}
                    className="h-9 px-3 rounded-full bg-secondary ink text-xs font-medium inline-flex items-center gap-1.5 active:scale-95"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </button>
                  <button
                    onClick={() => handleDownload(memo)}
                    className="h-9 px-3 rounded-full bg-secondary ink text-xs font-medium inline-flex items-center gap-1.5 active:scale-95"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                  <button
                    onClick={() => handleDelete(memo)}
                    className="h-9 px-3 rounded-full text-destructive text-xs font-medium inline-flex items-center gap-1.5 active:scale-95 ml-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
