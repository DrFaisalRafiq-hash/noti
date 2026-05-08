import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  X,
  Loader2,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  File as FileIcon,
  Pin,
  Trash2,
  Pencil,
  Tag as TagIcon,
  Folder as FolderIcon,
  Check,
} from "lucide-react";
import {
  useDocumentsStore,
  classifyMime,
  formatBytes,
  type DocumentItem,
  DOC_MAX_BYTES,
} from "@/lib/documents-store";
import { folderSwatchStyle, FOLDER_COLORS } from "@/lib/folder-colors";
import { haptic } from "@/lib/notes-store";
import SwipeRow from "@/components/SwipeRow";
import DocumentViewer from "@/components/DocumentViewer";
import ArchiveScopeChips, { type ArchiveScope } from "@/components/ArchiveScopeChips";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const KIND_ICON = {
  pdf: FileText,
  image: ImageIcon,
  video: Film,
  audio: Music,
  text: FileText,
  other: FileIcon,
} as const;

interface Props {
  /** Tags pulled from notes so the user has one shared pool to choose from. */
  knownTags: string[];
}

export default function DocumentsView({ knownTags }: Props) {
  const store = useDocumentsStore();
  const {
    folders,
    docs,
    loaded,
    createFolder,
    uploadDocument,
    updateDocument,
    deleteDocument,
    purgeDocument,
  } = store;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [pendingFolder, setPendingFolder] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [folderFilter, setFolderFilter] = useState<string | "all" | "inbox">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [archiveScope, setArchiveScope] = useState<ArchiveScope>("active");
  const [viewing, setViewing] = useState<DocumentItem | null>(null);
  const [editing, setEditing] = useState<DocumentItem | null>(null);

  // ---------- derived ----------
  const archivedCount = useMemo(
    () => docs.filter((d) => d.archived && !d.deleted_at).length,
    [docs],
  );
  const visible = useMemo(() => {
    let list = docs.filter((d) => {
      if (d.deleted_at) return false;
      if (archiveScope === "active") return !d.archived;
      if (archiveScope === "archived") return d.archived;
      return true; // all
    });
    if (folderFilter === "inbox") list = list.filter((d) => !d.folder_id);
    else if (folderFilter !== "all") list = list.filter((d) => d.folder_id === folderFilter);
    if (tagFilter) {
      list = list.filter((d) =>
        d.tags?.some((t) => t.toLowerCase() === tagFilter.toLowerCase()),
      );
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (d) =>
          d.file_name.toLowerCase().includes(q) ||
          d.caption?.toLowerCase().includes(q) ||
          d.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list.slice().sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [docs, folderFilter, tagFilter, query, archiveScope]);

  const docTags = useMemo(() => {
    const counts = new Map<string, number>();
    docs.forEach((d) => {
      if (d.deleted_at || d.archived) return;
      d.tags?.forEach((t) => {
        const k = t.trim();
        if (!k) return;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }, [docs]);

  const folderById = useMemo(() => {
    const m: Record<string, { name: string; color: string }> = {};
    folders.forEach((f) => (m[f.id] = { name: f.name, color: f.color }));
    return m;
  }, [folders]);

  // ---------- upload flow ----------
  function pickFile() {
    fileInputRef.current?.click();
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (file.size > DOC_MAX_BYTES) {
      toast.error(
        `File too large (${formatBytes(file.size)}). Max ${formatBytes(DOC_MAX_BYTES)}.`,
      );
      return;
    }
    setPendingFile(file);
    setCaption("");
    setPendingTags([]);
    setTagDraft("");
    setPendingFolder(folderFilter !== "all" && folderFilter !== "inbox" ? folderFilter : null);
  }

  function commitTag() {
    const t = tagDraft.trim().replace(/^#/, "");
    if (!t) return;
    if (pendingTags.includes(t)) {
      setTagDraft("");
      return;
    }
    setPendingTags((prev) => [...prev, t]);
    setTagDraft("");
  }

  async function handleUpload() {
    if (!pendingFile || uploading) return;
    setUploading(true);
    try {
      const tags = [...pendingTags];
      if (tagDraft.trim()) tags.push(tagDraft.trim().replace(/^#/, ""));
      await uploadDocument(pendingFile, {
        caption,
        folder_id: pendingFolder,
        tags,
      });
      haptic.success();
      toast.success("Document uploaded");
      setPendingFile(null);
    } catch (err) {
      toast.error((err as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ---------- inline rename / caption edit ----------
  const [editCaption, setEditCaption] = useState("");
  const [editTagDraft, setEditTagDraft] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editFolder, setEditFolder] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (!editing) return;
    setEditCaption(editing.caption ?? "");
    setEditTagDraft("");
    setEditTags(editing.tags ?? []);
    setEditFolder(editing.folder_id);
    setEditName(editing.file_name);
  }, [editing]);

  async function saveEdit() {
    if (!editing) return;
    const tags = [...editTags];
    if (editTagDraft.trim()) tags.push(editTagDraft.trim().replace(/^#/, ""));
    try {
      await updateDocument(editing.id, {
        caption: editCaption.trim() || null,
        tags,
        folder_id: editFolder,
        file_name: editName.trim() || editing.file_name,
      });
      toast.success("Updated");
      setEditing(null);
    } catch (err) {
      toast.error((err as Error).message || "Couldn't save");
    }
  }

  // Suggestion list = (note tags ∪ doc tags), minus already-selected
  const tagSuggestions = useMemo(() => {
    const set = new Set<string>();
    knownTags.forEach((t) => set.add(t));
    docTags.forEach(({ tag }) => set.add(tag));
    return Array.from(set);
  }, [knownTags, docTags]);

  return (
    <div>
      {/* Hidden file input (any type) */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={onFileChosen}
      />

      {/* Toolbar: search + folder filter + upload */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documents…"
          className="flex-1 min-w-[180px] h-10 px-4 rounded-2xl bg-sunk hairline border ink text-sm outline-none focus:border-primary/60 transition-smooth placeholder:ink-faint"
        />
        <button
          type="button"
          onClick={pickFile}
          className="h-10 px-4 rounded-2xl bg-foreground text-background text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 transition-smooth shadow-soft"
        >
          <Upload className="h-4 w-4" strokeWidth={1.75} />
          Upload
        </button>
      </div>

      {/* Archive scope */}
      <ArchiveScopeChips
        value={archiveScope}
        onChange={setArchiveScope}
        archivedCount={archivedCount}
        className="mb-2"
      />

      {/* Folder chip row */}
      <div className="flex gap-1.5 mb-3 items-center overflow-x-auto -mx-1 px-1 pb-1">
        <span className="text-[10px] uppercase tracking-[0.18em] ink-faint font-medium pr-1 flex-shrink-0">
          Folders
        </span>
        {(["all", "inbox"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFolderFilter(k)}
            className={cn(
              "h-8 sm:h-7 px-3 rounded-full text-[12px] sm:text-[11px] font-medium border transition-smooth flex-shrink-0",
              folderFilter === k
                ? "bg-foreground text-background border-foreground"
                : "bg-paper hairline ink-faint hover:bg-sunk",
            )}
          >
            {k === "all" ? "All" : "Inbox"}
          </button>
        ))}
        {folders.map((f) => {
          const active = folderFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFolderFilter(active ? "all" : f.id)}
              className={cn(
                "h-8 sm:h-7 px-3 rounded-full text-[12px] sm:text-[11px] font-medium border transition-smooth whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5",
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-paper hairline ink-soft hover:bg-sunk",
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={folderSwatchStyle(f.color)} />
              {f.name}
            </button>
          );
        })}
        <button
          onClick={async () => {
            const name = window.prompt("New document folder name");
            if (!name?.trim()) return;
            try {
              const f = await createFolder(name.trim());
              setFolderFilter(f.id);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
          className="h-8 sm:h-7 px-3 rounded-full text-[12px] sm:text-[11px] font-medium border border-dashed ink-faint hover:bg-sunk transition-smooth flex-shrink-0"
        >
          + New
        </button>
      </div>

      {/* Tag chip row (shared pool) */}
      {(docTags.length > 0 || knownTags.length > 0) && (
        <div className="flex gap-1.5 mb-3 items-center overflow-x-auto -mx-1 px-1 pb-1">
          <span className="text-[10px] uppercase tracking-[0.18em] ink-faint font-medium pr-1 flex-shrink-0">
            Tags
          </span>
          <button
            onClick={() => setTagFilter(null)}
            className={cn(
              "h-8 sm:h-7 px-3 rounded-full text-[12px] sm:text-[11px] font-medium border transition-smooth flex-shrink-0",
              tagFilter === null
                ? "bg-foreground text-background border-foreground"
                : "bg-paper hairline ink-faint hover:bg-sunk",
            )}
          >
            All
          </button>
          {docTags.map(({ tag, count }) => {
            const active = tagFilter === tag;
            return (
              <button
                key={tag}
                onClick={() => setTagFilter(active ? null : tag)}
                className={cn(
                  "h-8 sm:h-7 px-3 rounded-full text-[12px] sm:text-[11px] font-medium border transition-smooth whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5",
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-paper hairline ink-soft hover:bg-sunk",
                )}
              >
                <span>#{tag}</span>
                <span
                  className={cn(
                    "text-[10px] tabular-nums",
                    active ? "opacity-80" : "ink-faint",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      {!loaded ? (
        <div className="py-24 text-center ink-faint text-sm">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="py-24 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sunk hairline border mb-4">
            <FileText className="h-6 w-6 ink-faint" strokeWidth={1.5} />
          </div>
          <p className="font-display text-lg ink">No documents yet</p>
          <p className="text-sm ink-faint mt-1">
            Upload a PDF, image, or any file to keep it in Noti.
          </p>
          <button
            type="button"
            onClick={pickFile}
            className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-smooth"
          >
            <Upload className="h-4 w-4" strokeWidth={1.75} />
            Upload your first document
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((d) => {
            const kind = classifyMime(d.mime_type);
            const Kind = KIND_ICON[kind];
            const folder = d.folder_id ? folderById[d.folder_id] : null;
            return (
              <SwipeRow
                key={d.id}
                pinned={d.pinned}
                archived={d.archived}
                onPinToggle={() => {
                  haptic.success();
                  updateDocument(d.id, { pinned: !d.pinned });
                  toast(d.pinned ? "Unpinned" : "Pinned to top");
                }}
                onArchiveToggle={() => {
                  haptic.success();
                  updateDocument(d.id, { archived: !d.archived });
                  toast(d.archived ? "Restored" : "Archived");
                }}
                onDelete={() => {
                  haptic.success();
                  deleteDocument(d.id);
                  toast("Deleted");
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    haptic.light();
                    setViewing(d);
                  }}
                  className="text-left w-full p-4 rounded-2xl bg-paper hairline border hover:bg-sunk transition-smooth shadow-soft flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-sunk hairline border flex items-center justify-center flex-shrink-0">
                      <Kind className="h-5 w-5 ink-soft" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium ink truncate">{d.file_name}</p>
                      <p className="text-[11px] ink-faint mt-0.5">
                        {formatBytes(d.size_bytes)} · {kind.toUpperCase()}
                      </p>
                    </div>
                    {d.pinned && (
                      <Pin className="h-3.5 w-3.5 ink-faint flex-shrink-0" strokeWidth={1.75} />
                    )}
                  </div>
                  {d.caption && (
                    <p className="text-[13px] ink-soft leading-relaxed line-clamp-3">
                      {d.caption}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {folder && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-sunk hairline border ink-faint">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={folderSwatchStyle(folder.color)}
                        />
                        {folder.name}
                      </span>
                    )}
                    {d.tags?.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-sunk hairline border ink-faint"
                      >
                        #{t}
                      </span>
                    ))}
                    {d.tags && d.tags.length > 4 && (
                      <span className="text-[10px] ink-faint">+{d.tags.length - 4}</span>
                    )}
                    <span className="ml-auto inline-flex items-center gap-2">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(d);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            setEditing(d);
                          }
                        }}
                        className="h-7 w-7 rounded-lg ink-faint hover:ink hover:bg-paper flex items-center justify-center transition-smooth"
                        aria-label="Edit details"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </span>
                    </span>
                  </div>
                </button>
              </SwipeRow>
            );
          })}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={!!pendingFile} onOpenChange={(o) => !o && setPendingFile(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New document</DialogTitle>
          </DialogHeader>
          {pendingFile && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-sunk hairline border">
                <FileIcon className="h-5 w-5 ink-soft mt-0.5" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm ink font-medium truncate">{pendingFile.name}</p>
                  <p className="text-[11px] ink-faint mt-0.5">
                    {pendingFile.type || "unknown"} · {formatBytes(pendingFile.size)}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-[0.18em] ink-faint font-medium">
                  Caption
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                  placeholder="Add a short description…"
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-paper hairline border ink text-sm outline-none focus:border-primary/60 transition-smooth resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-[0.18em] ink-faint font-medium flex items-center gap-1.5">
                  <FolderIcon className="h-3 w-3" /> Folder
                </label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPendingFolder(null)}
                    className={cn(
                      "h-7 px-3 rounded-full text-[11px] border transition-smooth",
                      !pendingFolder
                        ? "bg-foreground text-background border-foreground"
                        : "bg-paper hairline ink-faint hover:bg-sunk",
                    )}
                  >
                    Inbox
                  </button>
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPendingFolder(f.id)}
                      className={cn(
                        "h-7 px-3 rounded-full text-[11px] border transition-smooth inline-flex items-center gap-1.5",
                        pendingFolder === f.id
                          ? "bg-foreground text-background border-foreground"
                          : "bg-paper hairline ink-soft hover:bg-sunk",
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={folderSwatchStyle(f.color)}
                      />
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-[0.18em] ink-faint font-medium flex items-center gap-1.5">
                  <TagIcon className="h-3 w-3" /> Tags
                </label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {pendingTags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full bg-foreground text-background text-[11px]"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() =>
                          setPendingTags((prev) => prev.filter((x) => x !== t))
                        }
                        className="h-4 w-4 rounded-full hover:bg-background/20 inline-flex items-center justify-center"
                        aria-label={`Remove ${t}`}
                      >
                        <X className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        commitTag();
                      } else if (e.key === "Backspace" && !tagDraft && pendingTags.length) {
                        setPendingTags((prev) => prev.slice(0, -1));
                      }
                    }}
                    placeholder="Add tag…"
                    className="h-7 px-2 min-w-[100px] flex-1 bg-transparent border-b border-dashed border-foreground/20 text-sm ink outline-none"
                  />
                </div>
                {tagSuggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tagSuggestions
                      .filter((t) => !pendingTags.includes(t))
                      .slice(0, 8)
                      .map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            setPendingTags((prev) =>
                              prev.includes(t) ? prev : [...prev, t],
                            )
                          }
                          className="text-[10px] px-2 py-0.5 rounded-full bg-sunk hairline border ink-faint hover:ink transition-smooth"
                        >
                          #{t}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setPendingFile(null)}
              disabled={uploading}
              className="h-10 px-4 rounded-xl ink-soft hover:ink hover:bg-sunk text-sm transition-smooth disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="h-10 px-4 rounded-xl bg-foreground text-background text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 transition-smooth disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" strokeWidth={1.75} />
              )}
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit document</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-[0.18em] ink-faint font-medium">
                  Name
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl bg-paper hairline border ink text-sm outline-none focus:border-primary/60 transition-smooth"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.18em] ink-faint font-medium">
                  Caption
                </label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-paper hairline border ink text-sm outline-none focus:border-primary/60 transition-smooth resize-none"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.18em] ink-faint font-medium flex items-center gap-1.5">
                  <FolderIcon className="h-3 w-3" /> Folder
                </label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditFolder(null)}
                    className={cn(
                      "h-7 px-3 rounded-full text-[11px] border transition-smooth",
                      !editFolder
                        ? "bg-foreground text-background border-foreground"
                        : "bg-paper hairline ink-faint hover:bg-sunk",
                    )}
                  >
                    Inbox
                  </button>
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setEditFolder(f.id)}
                      className={cn(
                        "h-7 px-3 rounded-full text-[11px] border transition-smooth inline-flex items-center gap-1.5",
                        editFolder === f.id
                          ? "bg-foreground text-background border-foreground"
                          : "bg-paper hairline ink-soft hover:bg-sunk",
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={folderSwatchStyle(f.color)}
                      />
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.18em] ink-faint font-medium flex items-center gap-1.5">
                  <TagIcon className="h-3 w-3" /> Tags
                </label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {editTags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full bg-foreground text-background text-[11px]"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() =>
                          setEditTags((prev) => prev.filter((x) => x !== t))
                        }
                        className="h-4 w-4 rounded-full hover:bg-background/20 inline-flex items-center justify-center"
                        aria-label={`Remove ${t}`}
                      >
                        <X className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={editTagDraft}
                    onChange={(e) => setEditTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const t = editTagDraft.trim().replace(/^#/, "");
                        if (!t) return;
                        if (!editTags.includes(t)) setEditTags((prev) => [...prev, t]);
                        setEditTagDraft("");
                      } else if (
                        e.key === "Backspace" &&
                        !editTagDraft &&
                        editTags.length
                      ) {
                        setEditTags((prev) => prev.slice(0, -1));
                      }
                    }}
                    placeholder="Add tag…"
                    className="h-7 px-2 min-w-[100px] flex-1 bg-transparent border-b border-dashed border-foreground/20 text-sm ink outline-none"
                  />
                </div>
                {tagSuggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tagSuggestions
                      .filter((t) => !editTags.includes(t))
                      .slice(0, 8)
                      .map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            setEditTags((prev) =>
                              prev.includes(t) ? prev : [...prev, t],
                            )
                          }
                          className="text-[10px] px-2 py-0.5 rounded-full bg-sunk hairline border ink-faint hover:ink transition-smooth"
                        >
                          #{t}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!editing) return;
                  if (!confirm("Delete this document permanently?")) return;
                  try {
                    await purgeDocument(editing.id);
                    toast.success("Document deleted");
                    setEditing(null);
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
                className="text-[12px] text-destructive hover:underline inline-flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete permanently
              </button>
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-10 px-4 rounded-xl ink-soft hover:ink hover:bg-sunk text-sm transition-smooth"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              className="h-10 px-4 rounded-xl bg-foreground text-background text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 transition-smooth"
            >
              <Check className="h-4 w-4" strokeWidth={1.75} /> Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewing && <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
