import { useEffect, useState } from "react";
import {
  X,
  Download,
  ExternalLink,
  Loader2,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  File as FileIcon,
  Sparkles,
  Check,
} from "lucide-react";
import {
  classifyMime,
  formatBytes,
  getDocumentSignedUrl,
  type DocumentItem,
} from "@/lib/documents-store";
import { useDocumentsStore } from "@/lib/documents-store";
import { supabase } from "@/integrations/supabase/client";
import { handleAiError, fetchWallet } from "@/lib/wallet-store";
import { toast } from "sonner";

interface Props {
  doc: DocumentItem;
  onClose: () => void;
}

const KIND_ICON = {
  pdf: FileText,
  image: ImageIcon,
  video: Film,
  audio: Music,
  text: FileText,
  other: FileIcon,
} as const;

interface AiResult {
  summary: string;
  folder: string;
  is_new_folder: boolean;
  category: string;
  tags: string[];
  _charged_credits?: number;
}

export default function DocumentViewer({ doc, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kind = classifyMime(doc.mime_type);
  const Kind = KIND_ICON[kind];

  const { folders, createFolder, updateDocument } = useDocumentsStore();
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setError(null);
    setResult(null);
    getDocumentSignedUrl(doc.storage_path).then((u) => {
      if (!alive) return;
      if (u) setUrl(u);
      else setError("Couldn't open this document.");
    });
    return () => {
      alive = false;
    };
  }, [doc.storage_path]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function analyze() {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("document-ai", {
        body: { document_id: doc.id, folders: folders.map((f) => f.name) },
      });
      if (error) {
        if (handleAiError(error)) return;
        throw error;
      }
      if ((data as any)?.error) {
        throw new Error((data as any).error);
      }
      setResult(data as AiResult);
      fetchWallet();
      toast.success("AI analysis ready");
    } catch (e) {
      toast.error((e as Error).message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function applySuggestions() {
    if (!result || applying) return;
    setApplying(true);
    try {
      // Resolve folder: reuse existing (case-insensitive) or create new.
      let folderId: string | null = doc.folder_id;
      const target = result.folder?.trim();
      if (target) {
        const existing = folders.find(
          (f) => f.name.toLowerCase() === target.toLowerCase(),
        );
        if (existing) folderId = existing.id;
        else {
          const created = await createFolder(target);
          folderId = created.id;
        }
      }
      // Merge tags (dedupe, case-insensitive)
      const existingTags = doc.tags ?? [];
      const lower = new Set(existingTags.map((t) => t.toLowerCase()));
      const merged = [...existingTags];
      for (const t of result.tags ?? []) {
        const k = t.trim().replace(/^#/, "");
        if (!k) continue;
        if (!lower.has(k.toLowerCase())) {
          merged.push(k);
          lower.add(k.toLowerCase());
        }
      }
      // Use AI summary as caption if user has none yet.
      const caption =
        doc.caption && doc.caption.trim().length > 0 ? doc.caption : result.summary;
      await updateDocument(doc.id, {
        folder_id: folderId,
        tags: merged,
        caption,
      });
      toast.success("Applied AI suggestions");
      setResult(null);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't apply");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 safe-overlay z-[180] bg-background flex flex-col">
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b hairline bg-paper flex-shrink-0"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <div className="h-9 w-9 rounded-xl bg-sunk hairline border flex items-center justify-center flex-shrink-0">
          <Kind className="h-4 w-4 ink-soft" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="ink font-medium truncate text-sm">{doc.file_name}</p>
          <p className="text-[11px] ink-faint truncate">
            {doc.mime_type || "Unknown type"} · {formatBytes(doc.size_bytes)}
          </p>
        </div>
        <button
          type="button"
          onClick={analyze}
          disabled={analyzing}
          title="Analyze with AI (uses credits)"
          aria-label="Analyze with AI"
          className="hidden sm:inline-flex h-9 px-3 rounded-full bg-foreground text-background text-[12px] font-medium items-center gap-1.5 hover:opacity-90 transition-smooth disabled:opacity-60"
        >
          {analyzing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          {analyzing ? "Analyzing…" : "Analyze with AI"}
        </button>
        <button
          type="button"
          onClick={analyze}
          disabled={analyzing}
          title="Analyze with AI (uses credits)"
          aria-label="Analyze with AI"
          className="sm:hidden h-9 w-9 rounded-full bg-foreground text-background flex items-center justify-center disabled:opacity-60"
        >
          {analyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          )}
        </button>
        {url && (
          <>
            <a
              href={url}
              download={doc.file_name}
              className="h-9 w-9 rounded-full bg-sunk hairline border ink-soft hover:ink hover:bg-paper flex items-center justify-center transition-smooth"
              title="Download"
              aria-label="Download"
            >
              <Download className="h-4 w-4" strokeWidth={1.75} />
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 w-9 rounded-full bg-sunk hairline border ink-soft hover:ink hover:bg-paper flex items-center justify-center transition-smooth"
              title="Open in new tab"
              aria-label="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
            </a>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-9 w-9 rounded-full bg-sunk hairline border ink-soft hover:ink hover:bg-paper flex items-center justify-center transition-smooth"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </header>

      {/* AI result panel */}
      {result && (
        <div className="px-4 sm:px-6 py-3 border-b hairline bg-paper/80 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-xl bg-foreground text-background flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[11px] uppercase tracking-[0.18em] ink-faint font-medium">
                  AI summary
                </p>
                {typeof result._charged_credits === "number" && result._charged_credits > 0 && (
                  <span className="text-[10px] ink-faint">
                    · {result._charged_credits} credits used
                  </span>
                )}
              </div>
              <p className="text-sm ink leading-relaxed mt-1">{result.summary}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-foreground text-background">
                  📁 {result.folder}
                  {result.is_new_folder && " (new)"}
                </span>
                {result.category && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-sunk hairline border ink-soft">
                    {result.category}
                  </span>
                )}
                {result.tags?.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-sunk hairline border ink-faint"
                  >
                    #{t}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={applySuggestions}
                  disabled={applying}
                  className="h-9 px-3 rounded-xl bg-foreground text-background text-[12px] font-medium inline-flex items-center gap-1.5 hover:opacity-90 transition-smooth disabled:opacity-60"
                >
                  {applying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  Apply to document
                </button>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="h-9 px-3 rounded-xl ink-soft hover:ink hover:bg-sunk text-[12px] transition-smooth"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Caption + tags */}
      {(doc.caption || doc.tags?.length > 0) && (
        <div className="px-4 sm:px-6 py-3 border-b hairline bg-paper/60 flex-shrink-0">
          {doc.caption && <p className="text-sm ink leading-relaxed">{doc.caption}</p>}
          {doc.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {doc.tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-sunk hairline border ink-soft"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto bg-sunk">
        {!url && !error && (
          <div className="h-full flex items-center justify-center ink-faint">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {error && (
          <div className="h-full flex flex-col items-center justify-center gap-2 ink-faint p-6 text-center">
            <p className="text-sm">{error}</p>
          </div>
        )}
        {url && kind === "pdf" && (
          <iframe
            key={url}
            src={url}
            title={doc.file_name}
            className="w-full h-full bg-background"
          />
        )}
        {url && kind === "image" && (
          <div className="min-h-full flex items-center justify-center p-4">
            <img
              src={url}
              alt={doc.caption || doc.file_name}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}
        {url && kind === "video" && (
          <div className="min-h-full flex items-center justify-center p-4">
            <video src={url} controls className="max-w-full max-h-full" />
          </div>
        )}
        {url && kind === "audio" && (
          <div className="min-h-full flex items-center justify-center p-6">
            <audio src={url} controls className="w-full max-w-md" />
          </div>
        )}
        {url && (kind === "text" || kind === "other") && (
          <div className="min-h-full flex items-center justify-center p-6">
            <div className="max-w-sm w-full p-6 rounded-2xl bg-paper hairline border text-center">
              <Kind className="h-8 w-8 mx-auto ink-faint mb-3" strokeWidth={1.5} />
              <p className="text-sm ink font-medium truncate">{doc.file_name}</p>
              <p className="text-xs ink-faint mt-1">
                {doc.mime_type || "file"} · {formatBytes(doc.size_bytes)}
              </p>
              <p className="text-xs ink-faint mt-3">
                Inline preview isn't supported for this file type.
              </p>
              <a
                href={url}
                download={doc.file_name}
                className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-smooth"
              >
                <Download className="h-4 w-4" strokeWidth={1.75} />
                Download
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
