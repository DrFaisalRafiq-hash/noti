import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, FileText, CheckSquare, CalendarClock, Folder as FolderIcon, Inbox, Trash2, LayoutGrid, Flag, List, FolderOpen, ChevronDown, Check, X, Pencil, Bell, Mic, Clock, LogOut } from "lucide-react";
import { signOut } from "@/components/LockScreen";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useStore, haptic, relativeTime, type Note } from "@/lib/notes-store";
import { useInfiniteSlice } from "@/hooks/useInfiniteSlice";
import NoteCard from "@/components/NoteCard";
import NoteListItem from "@/components/NoteListItem";
import RecentStrip from "@/components/RecentStrip";
import SwipeRow from "@/components/SwipeRow";
import Composer from "@/components/Composer";
import NoteViewer from "@/components/NoteViewer";
import NewNoteDialog from "@/components/NewNoteDialog";
import QuickNoteTab from "@/components/QuickNoteTab";
import Settings from "@/components/Settings";
import WalletPill from "@/components/WalletPill";
import TopUpHost from "@/components/TopUpHost";

import NotiLogo from "@/components/NotiLogo";
import BellMenu from "@/components/BellMenu";
import FolderMenu from "@/components/FolderMenu";
import PullToRefresh from "@/components/PullToRefresh";

import VoiceRecorder from "@/components/VoiceRecorder";
import SelectionCapture from "@/components/SelectionCapture";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNotificationsPreference } from "@/hooks/useNotificationsPreference";
import { useNotificationScheduler } from "@/hooks/useNotificationScheduler";

import { folderSwatchStyle, folderActiveStyle, FOLDER_COLORS } from "@/lib/folder-colors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import NotiWordmark from "@/components/NotiWordmark";
import { NotiMark } from "@/components/brand/NotiMark";
import DocumentsView from "@/components/DocumentsView";
import VoiceMemosView from "@/components/VoiceMemosView";
import ScriptsView from "@/components/ScriptsView";
import ArchiveScopeChips, { type ArchiveScope } from "@/components/ArchiveScopeChips";
import PinPad from "@/components/PinPad";
import {
  isUnlocked,
  loadPinProfile,
  markUnlocked,
  relock,
  savePin,
  verifyPin,
  type PinLength,
} from "@/lib/note-lock";

type ViewMode = "grid" | "list" | "folders";
type Feed = "notes" | "tasks" | "docs" | "voice" | "scripts";
const VIEW_KEY = "noti-view-mode";
const FOLDER_FILTER_KEY = "noti-folder-filter";
const FEED_KEY = "noti-home-feed";

type Filter = "all" | "note" | "task" | "reminder" | "meeting";

const filters: { key: Filter; label: string; icon: typeof FileText }[] = [
  { key: "all", label: "All", icon: LayoutGrid },
  { key: "note", label: "Notes", icon: FileText },
  { key: "task", label: "To-do", icon: CheckSquare },
  { key: "reminder", label: "Reminders", icon: Bell },
  { key: "meeting", label: "Meetings", icon: CalendarClock },
];

export default function Index() {
  const store = useStore();
  const {
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
  } = store;

  const [reloadKey, setReloadKey] = useState(0);

  // Schedule local notifications for reminders/meetings when the user has
  // turned them on in Settings.
  const { enabled: notificationsEnabled } = useNotificationsPreference();
  useNotificationScheduler(notes, notificationsEnabled);

  const [filter, setFilter] = useState<Filter>("all");
  const [folderFilter, setFolderFilterState] = useState<string | "inbox" | "all">(() => {
    if (typeof window === "undefined") return "all";
    const saved = localStorage.getItem(FOLDER_FILTER_KEY);
    return saved ?? "all";
  });
  const setFolderFilter = (f: string | "inbox" | "all") => {
    setFolderFilterState(f);
    try {
      localStorage.setItem(FOLDER_FILTER_KEY, f);
    } catch {}
  };
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortByFlag, setSortByFlag] = useState(false);
  const [priorityExpanded, setPriorityExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [archiveScope, setArchiveScope] = useState<ArchiveScope>("active");
  const [editing, setEditing] = useState<Note | null>(null);
  const [viewing, setViewing] = useState<Note | null>(null);

  // ─── PIN lock state ───
  // Cached PIN profile (whether user has set a PIN, and chosen length).
  // Refreshed on demand after savePin/clearPin.
  const [pinProfile, setPinProfile] = useState<{ hasPin: boolean; pinLength: PinLength | null } | null>(null);
  // Note we want to view but is locked; we prompt for PIN, then open it.
  const [pendingUnlock, setPendingUnlock] = useState<Note | null>(null);
  // Note we want to LOCK but the user has no PIN yet — show setup first,
  // then complete the lock in onSetupComplete.
  const [pendingLock, setPendingLock] = useState<Note | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupLength, setSetupLength] = useState<PinLength>(4);

  useEffect(() => {
    let alive = true;
    loadPinProfile()
      .then((p) => {
        if (!alive || !p) return;
        setPinProfile({ hasPin: p.hasPin, pinLength: p.pinLength });
      })
      .catch(() => { /* ignore */ });
    return () => {
      alive = false;
    };
  }, []);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [feed, setFeedState] = useState<Feed>(() => {
    if (typeof window === "undefined") return "notes";
    const saved = localStorage.getItem(FEED_KEY);
    if (saved === "docs" || saved === "tasks" || saved === "notes" || saved === "voice" || saved === "scripts") return saved;
    return "notes";
  });
  const setFeed = (f: Feed) => {
    haptic.light();
    setFeedState(f);
    try { localStorage.setItem(FEED_KEY, f); } catch {}
  };
  const [draftOpen, setDraftOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  // Persist task-tab filters so they survive folder switches, tab changes,
  // and reloads. Stored in localStorage; reads are guarded for SSR/safety.
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<"all" | "low" | "medium" | "high">(() => {
    try {
      const v = localStorage.getItem("noti.taskPriorityFilter");
      return v === "low" || v === "medium" || v === "high" || v === "all" ? v : "all";
    } catch { return "all"; }
  });
  const [taskSortByPriority, setTaskSortByPriority] = useState<boolean>(() => {
    try { return localStorage.getItem("noti.taskSortByPriority") === "1"; } catch { return false; }
  });
  const [taskQuery, setTaskQuery] = useState<string>(() => {
    try { return localStorage.getItem("noti.taskQuery") ?? ""; } catch { return ""; }
  });
  // Multi-select tag filtering for tasks. Tasks must include ALL selected
  // tags (AND logic) to appear. Persisted as a JSON array; legacy single-tag
  // value (`noti.taskTagFilter`) is migrated on first load.
  const [taskTagFilters, setTaskTagFilters] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("noti.taskTagFilters");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((t) => typeof t === "string");
      }
      const legacy = localStorage.getItem("noti.taskTagFilter");
      return legacy ? [legacy] : [];
    } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem("noti.taskPriorityFilter", taskPriorityFilter); } catch {} }, [taskPriorityFilter]);
  useEffect(() => { try { localStorage.setItem("noti.taskSortByPriority", taskSortByPriority ? "1" : "0"); } catch {} }, [taskSortByPriority]);
  useEffect(() => { try { localStorage.setItem("noti.taskQuery", taskQuery); } catch {} }, [taskQuery]);
  useEffect(() => {
    try {
      localStorage.setItem("noti.taskTagFilters", JSON.stringify(taskTagFilters));
      localStorage.removeItem("noti.taskTagFilter");
    } catch {}
  }, [taskTagFilters]);
  const toggleTaskTag = (tag: string) => {
    setTaskTagFilters((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  // The query typed inside the folder drawer. We use it to highlight matching
  // notes inside the currently-selected folder so users can see why a folder
  // matched their drawer search. Persisted so the filter survives drawer
  // close, navigation, and full reloads.
  const DRAWER_QUERY_KEY = "noti-folder-drawer-query";
  const [drawerQuery, setDrawerQueryState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(DRAWER_QUERY_KEY) ?? "";
  });
  const setDrawerQuery = (q: string) => {
    setDrawerQueryState(q);
    try {
      if (q) localStorage.setItem(DRAWER_QUERY_KEY, q);
      else localStorage.removeItem(DRAWER_QUERY_KEY);
    } catch {}
  };

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY) as ViewMode | null;
    if (saved === "grid" || saved === "list" || saved === "folders") setViewMode(saved);
  }, []);
  const setView = (m: ViewMode) => {
    haptic.light();
    setViewMode(m);
    localStorage.setItem(VIEW_KEY, m);
  };

  // Once folders load, drop any persisted folder filter that no longer exists.
  useEffect(() => {
    if (!loaded) return;
    if (folderFilter === "all" || folderFilter === "inbox") return;
    if (!folders.some((f) => f.id === folderFilter)) {
      setFolderFilter("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, folders]);

  const folderById = useMemo(() => {
    const m: Record<string, { color: string; name: string }> = {};
    folders.forEach((f) => (m[f.id] = { color: f.color, name: f.name }));
    return m;
  }, [folders]);

  const visible = useMemo(() => {
    // Scripts live in their own top-level feed — never surface them in the
    // Notes feed (even under the "All" chip), so the two areas stay distinct.
    let list = notes.filter((n) => {
      if (n.deleted_at || n.mode === "script") return false;
      if (archiveScope === "active") return !n.archived;
      if (archiveScope === "archived") return n.archived;
      return true;
    });
    if (filter !== "all") list = list.filter((n) => n.mode === filter);
    if (folderFilter === "inbox") list = list.filter((n) => !n.folder_id);
    else if (folderFilter !== "all") list = list.filter((n) => n.folder_id === folderFilter);
    if (colorFilter) {
      list = list.filter((n) => n.folder_id && folderById[n.folder_id]?.color === colorFilter);
    }
    if (tagFilter) {
      list = list.filter((n) => n.tags?.some((t) => t.toLowerCase() === tagFilter.toLowerCase()));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (n) =>
          n.title?.toLowerCase().includes(q) ||
          n.text.toLowerCase().includes(q) ||
          n.category?.toLowerCase().includes(q) ||
          n.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    const colorOrder = Object.fromEntries(FOLDER_COLORS.map((c, i) => [c.id, i])) as Record<string, number>;
    return list.slice().sort((a, b) => {
      // Pinned always rise to the top
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      const aDone = a.done || ((a.mode === "reminder" || a.mode === "meeting") && a.fired);
      const bDone = b.done || ((b.mode === "reminder" || b.mode === "meeting") && b.fired);
      if (aDone !== bDone) return aDone ? 1 : -1;
      if (sortByFlag) {
        const ac = a.folder_id ? folderById[a.folder_id]?.color : null;
        const bc = b.folder_id ? folderById[b.folder_id]?.color : null;
        const ai = ac ? colorOrder[ac] ?? 99 : 100;
        const bi = bc ? colorOrder[bc] ?? 99 : 100;
        if (ai !== bi) return ai - bi;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [notes, filter, folderFilter, colorFilter, tagFilter, sortByFlag, query, folderById, archiveScope]);

  // Counts of currently-archived items, by feed, used to badge the
  // archive-scope chip so users know there's something to find.
  const archivedCounts = useMemo(() => {
    let notesA = 0, tasksA = 0, scriptsA = 0;
    for (const n of notes) {
      if (n.deleted_at || !n.archived) continue;
      if (n.mode === "script") scriptsA++;
      else {
        notesA++;
        if (n.mode === "task") tasksA++;
      }
    }
    return { notes: notesA, tasks: tasksA, scripts: scriptsA };
  }, [notes]);

  const counts = useMemo(() => {
    // Scripts live in their own feed, so the Notes-feed counts ignore them.
    const live = notes.filter((n) => !n.deleted_at && n.mode !== "script");
    return {
      all: live.length,
      note: live.filter((n) => n.mode === "note").length,
      task: live.filter((n) => n.mode === "task" && !n.done).length,
      reminder: live.filter((n) => n.mode === "reminder" && !n.fired).length,
      meeting: live.filter((n) => n.mode === "meeting" && !n.fired).length,
      trash: notes.filter((n) => !!n.deleted_at).length,
    };
  }, [notes]);

  const folderCounts = useMemo(() => {
    const m: Record<string, number> = { inbox: 0 };
    folders.forEach((f) => (m[f.id] = 0));
    notes.forEach((n) => {
      if (n.deleted_at) return;
      if (!n.folder_id) m.inbox++;
      else if (m[n.folder_id] !== undefined) m[n.folder_id]++;
    });
    return m;
  }, [folders, notes]);

  // All unique tags across active notes — drives the tag filter chip row.
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    notes.forEach((n) => {
      if (n.deleted_at || n.archived) return;
      n.tags?.forEach((t) => {
        const key = t.trim();
        if (!key) return;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }, [notes]);

  // Notes that match the drawer search inside the active folder. We only
  // light these up when (a) the user is searching in the drawer and (b) they
  // have actually narrowed to a single folder/inbox — otherwise the highlight
  // would be noisy and meaningless.
  const drawerHighlightIds = useMemo(() => {
    const q = drawerQuery.trim().toLowerCase();
    if (!q) return new Set<string>();
    if (folderFilter === "all") return new Set<string>();
    const ids = new Set<string>();
    notes.forEach((n) => {
      if (n.deleted_at || n.archived) return;
      if (folderFilter === "inbox" ? n.folder_id : n.folder_id !== folderFilter) return;
      const hit =
        n.title?.toLowerCase().includes(q) ||
        n.text.toLowerCase().includes(q) ||
        n.category?.toLowerCase().includes(q) ||
        n.tags?.some((t) => t.toLowerCase().includes(q));
      if (hit) ids.add(n.id);
    });
    return ids;
  }, [notes, drawerQuery, folderFilter]);

  // Most-recent active notes for the splash strip — independent of current filters
  const recent = useMemo(
    () =>
      notes
        .filter((n) => !n.archived && !n.done && !n.deleted_at)
        .slice()
        .sort((a, b) => {
          if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        })
        .slice(0, 6),
    [notes]
  );

  // Notes grouped by folder for Folders view
  const groupedByFolder = useMemo(() => {
    const groups: { id: string; name: string; color: string; notes: Note[] }[] = [];
    const inboxNotes = visible.filter((n) => !n.folder_id);
    if (inboxNotes.length) groups.push({ id: "inbox", name: "Inbox", color: "neutral", notes: inboxNotes });
    folders.forEach((f) => {
      const fns = visible.filter((n) => n.folder_id === f.id);
      if (fns.length) groups.push({ id: f.id, name: f.name, color: f.color, notes: fns });
    });
    return groups;
  }, [visible, folders]);

  // Infinite scroll — slice the filtered list, grow as the sentinel is reached.
  const sliceKey = `${viewMode}|${filter}|${folderFilter}|${colorFilter}|${tagFilter}|${sortByFlag}|${query}|${archiveScope}|${reloadKey}`;
  const { visible: pagedVisible, hasMore, sentinelRef, total, shown } = useInfiniteSlice(visible, {
    pageSize: 24,
    resetKey: sliceKey,
  });

  // The "+" button opens a fullscreen blank composer immediately. We create
  // a placeholder draft note in the database so the composer can patch into
  // it, then on close the composer either persists the draft (if anything
  // was entered) or removes the empty placeholder. This removes the friction
  // of being forced to type a title up front.
  const handleNew = async () => {
    haptic.medium();
    const folder_id = folderFilter !== "all" && folderFilter !== "inbox" ? folderFilter : null;
    try {
      const note = await createNote({ title: "Untitled draft", folder_id });
      // Mark as a fresh draft so the composer knows it can safely auto-discard
      // when the user closes without adding anything.
      setEditing({ ...note, __freshDraft: true } as any);
    } catch {
      // Fallback to the legacy title-first dialog if direct creation fails.
      setDraftOpen(true);
    }
  };

  const createFromDraft = async (title: string) => {
    const folder_id = folderFilter !== "all" && folderFilter !== "inbox" ? folderFilter : null;
    const note = await createNote({ title, folder_id });
    setEditing(note);
  };

  const editingFresh = editing ? notes.find((n) => n.id === editing.id) || editing : null;
  const viewingFresh = viewing ? notes.find((n) => n.id === viewing.id) || viewing : null;
  const viewingFolder = viewingFresh?.folder_id
    ? folders.find((f) => f.id === viewingFresh.folder_id) ?? null
    : null;

  // Siblings for swipe-navigation inside the viewer: use the currently-visible
  // (filtered + sorted) list so swipe respects the user's active folder/filter.
  const viewingSiblingIndex = viewingFresh
    ? visible.findIndex((n) => n.id === viewingFresh.id)
    : -1;
  const viewingPrev =
    viewingSiblingIndex > 0 ? visible[viewingSiblingIndex - 1] : null;
  const viewingNext =
    viewingSiblingIndex >= 0 && viewingSiblingIndex < visible.length - 1
      ? visible[viewingSiblingIndex + 1]
      : null;
  const openView = (n: Note) => {
    haptic.light();
    if (n.locked && !isUnlocked(n.id)) {
      setPendingUnlock(n);
      return;
    }
    setViewing(n);
  };

  /** Duplicate a note's content as a brand-new draft. */
  const handleDuplicate = async (n: Note) => {
    try {
      const baseTitle = (n.title || "Untitled").trim();
      const newTitle = baseTitle.endsWith("(copy)") ? baseTitle : `${baseTitle} (copy)`;
      const created = await createNote({
        title: newTitle,
        text: n.text,
        mode: n.mode,
        folder_id: n.folder_id,
        priority: n.priority,
      });
      // Carry tags over (createNote doesn't accept tags directly, so patch).
      if (n.tags?.length) {
        await updateNote(created.id, { tags: n.tags });
      }
      haptic.success();
      toast("Duplicated");
    } catch {
      toast.error("Couldn't duplicate");
    }
  };

  /** Open the composer in reminder mode so the user can pick a time. */
  const handleSetReminder = async (n: Note) => {
    if (n.mode !== "reminder" && n.mode !== "meeting") {
      try { await updateNote(n.id, { mode: "reminder" }); } catch {}
    }
    haptic.medium();
    setEditing({ ...n, mode: "reminder" } as Note);
  };

  /** Lock or unlock the currently-viewed note. Sets up a PIN first if needed. */
  const handleToggleLock = (n: Note) => {
    if (n.locked) {
      // Already locked → unlocking removes the lock; PIN was already verified to view.
      updateNote(n.id, { locked: false });
      relock(n.id);
      toast("Lock removed");
      return;
    }
    // Locking a note. If no PIN set, run setup first.
    if (!pinProfile?.hasPin) {
      setPendingLock(n);
      setSetupLength(4);
      setSetupOpen(true);
      return;
    }
    updateNote(n.id, { locked: true });
    // Mark as unlocked for this session so the viewer doesn't immediately re-lock it.
    markUnlocked(n.id);
    toast("Note locked");
  };

  /** Build the long-press action list for a note row. Order matches the
   *  visual hierarchy: open → status toggles → reminder/duplicate → archive
   *  → destructive. Falsy entries are filtered by RowActionSheet so we can
   *  use `cond && {…}` to drop irrelevant actions per row. */
  const buildRowActions = (n: Note) => [
    // ─── Quick shortcuts (rendered as a 4-up icon grid at the top) ───
    {
      id: "complete",
      label: n.done ? "Mark as not done" : "Mark complete",
      quickLabel: n.done ? "Reopen" : "Complete",
      icon: CheckSquare,
      quick: true,
      active: n.done,
      onSelect: () => {
        haptic.success();
        updateNote(n.id, { done: !n.done });
        toast(n.done ? "Reopened" : "Completed");
      },
    },
    {
      id: "pin",
      label: n.pinned ? "Unpin" : "Pin to top",
      quickLabel: n.pinned ? "Unpin" : "Pin",
      icon: Flag,
      quick: true,
      active: n.pinned,
      onSelect: () => {
        haptic.success();
        updateNote(n.id, { pinned: !n.pinned });
        toast(n.pinned ? "Unpinned" : "Pinned to top");
      },
    },
    {
      id: "remind",
      label: "Set reminder",
      quickLabel: "Remind",
      icon: Bell,
      quick: true,
      onSelect: () => handleSetReminder(n),
    },
    {
      id: "delete",
      label: "Delete",
      quickLabel: "Delete",
      description: "Moves to trash",
      icon: Trash2,
      destructive: true,
      quick: true,
      onSelect: () => {
        haptic.success();
        deleteNote(n.id);
        toast("Deleted");
      },
    },

    // ─── Full list (shown below the grid) ───
    {
      id: "open",
      label: "Open",
      icon: FileText,
      onSelect: () => openView(n),
    },
    {
      id: "duplicate",
      label: "Duplicate",
      icon: FileText,
      onSelect: () => handleDuplicate(n),
    },
    {
      id: "lock",
      label: n.locked ? "Remove lock" : "Lock note",
      icon: n.locked ? FolderOpen : FolderIcon,
      onSelect: () => handleToggleLock(n),
    },
    {
      id: "archive",
      label: n.archived ? "Restore from archive" : "Archive",
      icon: Inbox,
      onSelect: () => {
        haptic.success();
        updateNote(n.id, { archived: !n.archived });
        toast(n.archived ? "Restored" : "Archived");
      },
    },
  ];

  const handleRefresh = async () => {
    await refresh();
    setReloadKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Surface the freshly-loaded count in the indicator pill.
    const count = notes.filter((n) => !n.deleted_at).length;
    return `${count} ${count === 1 ? "note" : "notes"} synced`;
  };

  return (
    <div className="min-h-dvh bg-background">
      <SelectionCapture createNote={createNote} />
      <PullToRefresh onRefresh={handleRefresh}>
      <div
        className="mx-auto max-w-6xl px-5 sm:px-8"
        style={{
          paddingBottom: "calc(8rem + env(safe-area-inset-bottom))",
        }}
      >
        {/* Header — pushed below iOS status bar / dynamic island */}
        <header
          className="relative pb-6"
          style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
        >
          {/* Sign-out moved into the action row, next to the AI wallet pill,
              with a secondary AlertDialog confirmation. See below. */}

          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] ink-faint font-medium">
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <NotiMark className="h-9 w-9 sm:h-11 sm:w-11 ink dark:text-white" />
                <NotiWordmark as="h1" size="xl" className="ink" />
              </div>
            </div>
            <div className="flex items-center gap-3 self-center">
              <div className="text-right hidden sm:block">
                <div className="font-display text-2xl ink leading-none">{counts.all}</div>
                <div className="text-[11px] uppercase tracking-[0.18em] ink-faint mt-1">notes</div>
              </div>
              {/* Bell — notifications center with quick actions. Click opens
                  a popover listing upcoming/overdue reminders; each row has
                  Done / Snooze / Reschedule / Open / Dismiss. */}
              <BellMenu
                notes={notes}
                reminderCount={counts.reminder}
                onOpenNote={(n) => openView(n)}
                onUpdateNote={(id, patch) => updateNote(id, patch)}
                onDeleteNote={(id) => deleteNote(id)}
                onSeeAll={() => setFilter("reminder")}
              />
              <FolderMenu
                folders={folders}
                folderCounts={folderCounts}
                folderFilter={folderFilter}
                totalCount={counts.all}
                trashedNotes={notes.filter((n) => !!n.deleted_at)}
                onSelect={setFolderFilter}
                onCreate={(name, color) => createFolder(name, color)}
                onUpdate={(id, patch) => updateFolder(id, patch)}
                onDelete={async (id) => {
                  await deleteFolder(id);
                  if (folderFilter === id) setFolderFilter("all");
                }}
                onRestoreNote={(id) => restoreNote(id)}
                onPurgeNote={(id) => purgeNote(id)}
                onEmptyTrash={() => emptyTrash()}
                drawerQuery={drawerQuery}
                onDrawerQueryChange={setDrawerQuery}
              />
              {/* Share moved to Settings as a banner */}
              <WalletPill />
              {/* Sign out — paired next to the AI wallet so the two account-level
                  controls live together. Confirms with an AlertDialog so a
                  stray tap can't kick the user back to the lock screen. */}
              <button
                type="button"
                aria-label="Sign out"
                title="Sign out"
                onClick={() => { haptic.light(); setSignOutConfirmOpen(true); }}
                className="relative z-[60] inline-flex h-12 sm:h-10 w-12 sm:w-10 items-center justify-center rounded-full bg-paper hairline border ink-soft hover:bg-sunk active:scale-95 transition-smooth shadow-soft"
              >
                <LogOut size={16} strokeWidth={1.75} />
              </button>
              <Settings />
              <TopUpHost />
              {/* Support moved to Settings → Support section */}
            </div>
          </div>
        </header>

        <AlertDialog open={signOutConfirmOpen} onOpenChange={setSignOutConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out of Noti?</AlertDialogTitle>
              <AlertDialogDescription>
                You'll be returned to the lock screen. Your notes stay safe and synced — sign back in any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay signed in</AlertDialogCancel>
              <AlertDialogAction onClick={() => { haptic.success(); signOut(); }}>
                Sign out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Offline banner — shown when the last refresh failed (no network
            or backend unreachable). Cached notes remain browsable. */}
        {offline && (
          <div className="mb-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-sunk hairline border">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2 w-2 rounded-full bg-foreground/50 animate-pulse flex-shrink-0" />
              <p className="text-[13px] ink-soft truncate">
                Offline — showing cached notes
                {lastSyncedAt && (
                  <span className="ink-faint"> · synced {relativeTime(lastSyncedAt)} ago</span>
                )}
              </p>
            </div>
            <button
              onClick={() => refresh()}
              className="text-[12px] font-medium ink hover:underline flex-shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Notes / Docs segmented toggle */}
        <div className="mb-4 flex justify-center">
          <div
            role="tablist"
            aria-label="Feed"
            className="inline-flex p-1 rounded-2xl bg-sunk hairline border"
          >
            {([
              { id: "notes" as Feed, label: "Notes" },
              { id: "tasks" as Feed, label: "Tasks" },
              { id: "scripts" as Feed, label: "Scripts" },
              { id: "docs" as Feed, label: "Docs" },
              { id: "voice" as Feed, label: "Voice" },
            ]).map((opt) => {
              const active = feed === opt.id;
              return (
                <button
                  key={opt.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFeed(opt.id)}
                  className={cn(
                    "h-9 px-5 rounded-xl text-[13px] font-medium transition-smooth",
                    active
                      ? "bg-paper ink shadow-soft"
                      : "ink-soft hover:ink",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {feed === "voice" ? (
          <VoiceMemosView />
        ) : feed === "docs" ? (
          <DocumentsView knownTags={allTags.map((t) => t.tag)} />
        ) : feed === "scripts" ? (
          <ScriptsView
            notes={notes}
            folderById={folderById}
            onOpen={(n) => setEditing(n)}
            onCreate={async () => {
              const folder_id = folderFilter !== "all" && folderFilter !== "inbox" ? folderFilter : null;
              try {
                const note = await createNote({ title: "Untitled script", mode: "script", folder_id });
                setEditing({ ...note, __freshDraft: true } as any);
              } catch {
                toast.error("Couldn't create script");
              }
            }}
            onArchiveToggle={(n) => updateNote(n.id, { archived: !n.archived })}
            onDelete={(n) => deleteNote(n.id)}
            archiveScope={archiveScope}
            onArchiveScopeChange={setArchiveScope}
            archivedCount={archivedCounts.scripts}
          />
        ) : feed === "tasks" ? (
          (() => {
            const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
            const baseTasks = notes.filter((n) => {
              if (n.mode !== "task" || n.deleted_at) return false;
              if (archiveScope === "active") return !n.archived;
              if (archiveScope === "archived") return n.archived;
              return true;
            });

            // Collect tags from all tasks (so chips remain stable regardless of search/priority).
            const tagCounts = new Map<string, number>();
            for (const n of baseTasks) {
              for (const t of n.tags ?? []) {
                if (!t) continue;
                tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
              }
            }
            const allTags = Array.from(tagCounts.entries())
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
              .map(([t]) => t);

            const q = taskQuery.trim().toLowerCase();
            const matchesQuery = (n: Note) => {
              if (!q) return true;
              if ((n.title ?? "").toLowerCase().includes(q)) return true;
              if ((n.text ?? "").toLowerCase().includes(q)) return true;
              if ((n.tags ?? []).some((t) => t.toLowerCase().includes(q))) return true;
              if (Array.isArray(n.subtasks) && n.subtasks.some((s: any) => (s?.text ?? "").toLowerCase().includes(q))) return true;
              return false;
            };

            const allTasks = baseTasks
              .filter((n) => taskPriorityFilter === "all" || (n.priority ?? "medium") === taskPriorityFilter)
              .filter((n) => taskTagFilters.length === 0 || taskTagFilters.every((t) => (n.tags ?? []).includes(t)))
              .filter(matchesQuery)
              .slice()
              .sort((a, b) => {
                if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
                if (taskSortByPriority) {
                  const ar = priorityRank[a.priority ?? "medium"] ?? 1;
                  const br = priorityRank[b.priority ?? "medium"] ?? 1;
                  if (ar !== br) return ar - br;
                }
                return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
              });
            const open = allTasks.filter((t) => !t.done);
            const done = allTasks.filter((t) => t.done);

            const priorityStyles: Record<string, string> = {
              high: "bg-rose-500",
              medium: "bg-amber-500",
              low: "bg-emerald-500",
            };

            const renderTaskRow = (n: Note) => (
              <SwipeRow
                key={n.id}
                pinned={n.pinned}
                archived={n.archived}
                done={n.done}
                onComplete={() => {
                  haptic.success();
                  updateNote(n.id, { done: !n.done });
                  toast(n.done ? "Reopened" : "Completed");
                }}
                onSetReminder={() => handleSetReminder(n)}
                onDuplicate={() => handleDuplicate(n)}
                onPinToggle={() => {
                  haptic.success();
                  updateNote(n.id, { pinned: !n.pinned });
                  toast(n.pinned ? "Unpinned" : "Pinned to top");
                }}
                onArchiveToggle={() => {
                  haptic.success();
                  updateNote(n.id, { archived: !n.archived });
                  toast(n.archived ? "Restored" : "Archived");
                }}
                onDelete={() => {
                  haptic.success();
                  deleteNote(n.id);
                  toast("Deleted");
                }}
                actions={buildRowActions(n)}
                actionsTitle={n.title || "Untitled note"}
                actionsSubtitle={relativeTime(n.updated_at)}
              >
                <div className="relative">
                  <span
                    aria-hidden
                    title={`Priority: ${n.priority ?? "medium"}`}
                    className={cn(
                      "absolute left-1.5 top-1/2 -translate-y-1/2 z-10 h-2 w-2 rounded-full",
                      priorityStyles[n.priority ?? "medium"]
                    )}
                  />
                  <NoteListItem
                    note={n}
                    folder={n.folder_id ? folderById[n.folder_id] : null}
                    onOpen={() => openView(n)}
                    onToggleDone={() => updateNote(n.id, { done: !n.done })}
                  />
                </div>
              </SwipeRow>
            );

            const priorityChips: { id: "all" | "low" | "medium" | "high"; label: string; dot?: string }[] = [
              { id: "all", label: "All" },
              { id: "high", label: "High", dot: "bg-rose-500" },
              { id: "medium", label: "Med", dot: "bg-amber-500" },
              { id: "low", label: "Low", dot: "bg-emerald-500" },
            ];

            return (
              <div className="space-y-8">
                <QuickAddTask
                  onAdd={async (title, priority, remindAt) => {
                    const folder_id =
                      folderFilter !== "all" && folderFilter !== "inbox" ? folderFilter : null;
                    await createNote({ title, mode: "task", folder_id, priority, remind_at: remindAt });
                    haptic.success();
                  }}
                />

                <ArchiveScopeChips
                  value={archiveScope}
                  onChange={setArchiveScope}
                  archivedCount={archivedCounts.tasks}
                  className="-mt-4"
                />

                {/* Search */}
                <div className="-mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ink-faint" strokeWidth={1.75} />
                    <input
                      value={taskQuery}
                      onChange={(e) => setTaskQuery(e.target.value)}
                      placeholder="Search tasks, tags, subtasks…"
                      aria-label="Search tasks"
                      className="w-full h-10 pl-9 pr-9 rounded-full bg-paper hairline border text-sm ink placeholder:ink-faint focus:outline-none focus:ring-2 focus:ring-foreground/10"
                    />
                    {taskQuery && (
                      <button
                        onClick={() => {
                          haptic.light();
                          setTaskQuery("");
                        }}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-sunk ink-faint"
                      >
                        <X className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Tag filter */}
                {allTags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap -mt-4">
                    <span className="text-[10px] uppercase tracking-[0.18em] ink-faint font-medium pr-1">
                      Tags
                    </span>
                    <button
                      onClick={() => {
                        haptic.light();
                        setTaskTagFilters([]);
                      }}
                      className={cn(
                        "h-8 px-3 rounded-full text-[12px] font-medium border transition-smooth",
                        taskTagFilters.length === 0
                          ? "bg-foreground text-background border-foreground"
                          : "bg-paper hairline ink-soft hover:bg-sunk"
                      )}
                    >
                      All
                    </button>
                    {allTags.map((tag) => {
                      const active = taskTagFilters.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            haptic.light();
                            toggleTaskTag(tag);
                          }}
                          aria-pressed={active}
                          className={cn(
                            "h-8 px-3 rounded-full text-[12px] font-medium border transition-smooth inline-flex items-center gap-1",
                            active
                              ? "bg-foreground text-background border-foreground"
                              : "bg-paper hairline ink-soft hover:bg-sunk"
                          )}
                        >
                          <span className="opacity-60">#</span>{tag}
                          <span className="ml-1 text-[10px] opacity-60 tabular-nums">{tagCounts.get(tag)}</span>
                        </button>
                      );
                    })}
                    {taskTagFilters.length > 1 && (
                      <span className="text-[10px] uppercase tracking-[0.18em] ink-faint font-medium pl-1">
                        matches all {taskTagFilters.length}
                      </span>
                    )}
                  </div>
                )}

                {/* Priority filter + sort */}
                <div className="flex items-center gap-2 flex-wrap -mt-4">
                  <span className="text-[10px] uppercase tracking-[0.18em] ink-faint font-medium pr-1">
                    Priority
                  </span>
                  {priorityChips.map((p) => {
                    const active = taskPriorityFilter === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          haptic.light();
                          setTaskPriorityFilter(p.id);
                        }}
                        className={cn(
                          "h-8 px-3 rounded-full text-[12px] font-medium border transition-smooth inline-flex items-center gap-1.5",
                          active
                            ? "bg-foreground text-background border-foreground"
                            : "bg-paper hairline ink-soft hover:bg-sunk"
                        )}
                      >
                        {p.dot && <span className={cn("h-2 w-2 rounded-full", p.dot)} />}
                        {p.label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => {
                      haptic.light();
                      setTaskSortByPriority((v) => !v);
                    }}
                    title="Sort by priority"
                    className={cn(
                      "ml-auto h-8 px-3 rounded-full text-[11px] uppercase tracking-[0.12em] font-semibold border transition-smooth",
                      taskSortByPriority
                        ? "bg-foreground text-background border-foreground"
                        : "bg-paper hairline ink-faint hover:bg-sunk"
                    )}
                  >
                    Sort by priority
                  </button>
                </div>

                <section>
                  <div className="flex items-baseline justify-between mb-3 px-1">
                    <h3 className="font-display text-lg ink">Open</h3>
                    <span className="text-[11px] uppercase tracking-[0.18em] ink-faint tabular-nums">
                      {open.length}
                    </span>
                  </div>
                  {open.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl bg-sunk hairline border">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-paper hairline border mb-3">
                        <CheckSquare className="h-5 w-5 ink-faint" strokeWidth={1.5} />
                      </div>
                      <p className="font-display text-base ink">
                        {taskQuery || taskTagFilters.length > 0 || taskPriorityFilter !== "all" ? "No matches" : "All clear"}
                      </p>
                      <p className="text-sm ink-faint mt-1">
                        {taskQuery || taskTagFilters.length > 0 || taskPriorityFilter !== "all"
                          ? "Try clearing search or filters."
                          : "Type a task above and press Enter."}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">{open.map(renderTaskRow)}</div>
                  )}
                </section>

                <section>
                  <div className="flex items-baseline justify-between mb-3 px-1">
                    <h3 className="font-display text-lg ink">Completed</h3>
                    <span className="text-[11px] uppercase tracking-[0.18em] ink-faint tabular-nums">
                      {done.length}
                    </span>
                  </div>
                  {done.length === 0 ? (
                    <p className="text-sm ink-faint px-1">Nothing completed yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">{done.map(renderTaskRow)}</div>
                  )}
                </section>
              </div>
            );
          })()
        ) : (
        <>

        {/* Search collapses to a magnifying-glass button; expands on tap.
            View toggle hides while search is engaged. */}
        {(() => {
          const expanded = searchFocused || query.length > 0;
          return (
            <div className="flex items-center gap-2 mb-4">
              {/* Collapsed search button */}
              <button
                type="button"
                onClick={() => {
                  haptic.light();
                  setSearchFocused(true);
                  // Defer focus until the input is rendered/visible
                  requestAnimationFrame(() => searchInputRef.current?.focus());
                }}
                aria-label="Open search"
                title="Search"
                tabIndex={expanded ? -1 : 0}
                className={cn(
                  "h-12 w-12 sm:h-10 sm:w-10 rounded-full bg-sunk hairline border ink-soft hover:bg-paper hover:ink flex items-center justify-center transition-all duration-300 ease-out flex-shrink-0",
                  expanded
                    ? "max-w-0 w-0 h-0 opacity-0 border-0 pointer-events-none overflow-hidden"
                    : "opacity-100"
                )}
              >
                <Search className="h-5 w-5 sm:h-4 sm:w-4" strokeWidth={1.75} />
              </button>

              {/* Expanded search field */}
              <div
                className={cn(
                  "relative overflow-hidden transition-all duration-300 ease-out",
                  expanded ? "flex-1 opacity-100" : "max-w-0 w-0 opacity-0 pointer-events-none"
                )}
                aria-hidden={!expanded}
              >
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-4 sm:w-4 ink-faint pointer-events-none" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setQuery("");
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  tabIndex={expanded ? 0 : -1}
                  placeholder="Search notes, tags, categories…"
                  className="w-full bg-sunk hairline border rounded-2xl pl-12 sm:pl-11 pr-12 py-3.5 sm:py-3 text-[16px] sm:text-[15px] ink outline-none focus:border-primary/60 transition-smooth placeholder:ink-faint"
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery("");
                    setSearchFocused(false);
                    searchInputRef.current?.blur();
                  }}
                  aria-label={query.length > 0 ? "Clear search" : "Close search"}
                  title={query.length > 0 ? "Clear" : "Close"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full hairline border bg-paper ink-soft hover:ink flex items-center justify-center transition-smooth"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>

              {/* Spacer pushes view-toggle to the right when collapsed */}
              {!expanded && <div className="flex-1" />}

              {/* View toggle */}
              <div
                className={cn(
                  "flex gap-1 p-1 bg-sunk hairline border rounded-2xl flex-shrink-0 overflow-hidden transition-all duration-300 ease-out",
                  expanded
                    ? "max-w-0 opacity-0 -mr-2 p-0 border-0 pointer-events-none"
                    : "max-w-[200px] opacity-100"
                )}
                aria-hidden={expanded}
              >
                {([
                  { id: "grid" as ViewMode, Icon: LayoutGrid, label: "Grid" },
                  { id: "list" as ViewMode, Icon: List, label: "List" },
                  { id: "folders" as ViewMode, Icon: FolderOpen, label: "Folders" },
                ]).map(({ id, Icon, label }) => {
                  const active = viewMode === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setView(id)}
                      aria-label={`${label} view`}
                      title={`${label} view`}
                      tabIndex={expanded ? -1 : 0}
                      className={cn(
                        "h-11 w-11 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center transition-smooth",
                        active ? "bg-paper ink shadow-soft" : "ink-soft hover:ink"
                      )}
                    >
                      <Icon className="h-5 w-5 sm:h-4 sm:w-4" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Archive scope */}
        <ArchiveScopeChips
          value={archiveScope}
          onChange={setArchiveScope}
          archivedCount={archivedCounts.notes}
          className="mb-1"
        />

        {/* Mode filters — icon pills */}
        <div className="flex gap-2 mb-3 overflow-x-auto overflow-y-visible -mx-1 px-1 pt-2 pb-2">
          {filters.map((f) => {
            const active = filter === f.key;
            const count = counts[f.key];
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => {
                  haptic.light();
                  setFilter(f.key);
                }}
                aria-label={f.label}
                title={f.label}
                className={cn(
                  "relative flex items-center justify-center h-12 w-12 sm:h-10 sm:w-10 rounded-full transition-smooth border flex-shrink-0",
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-paper hairline ink-soft hover:bg-sunk"
                )}
              >
                <Icon
                  className={cn(
                    // Bell glyph reads heavier than peers (FileText, CheckSquare)
                    // because of its solid clapper + dome — shave it down a hair
                    // so it sits at the same optical weight in the pill row.
                    f.key === "reminder"
                      ? "h-[18px] w-[18px] sm:h-[14px] sm:w-[14px]"
                      : "h-5 w-5 sm:h-4 sm:w-4",
                  )}
                  strokeWidth={f.key === "reminder" ? 1.6 : 1.75}
                />
                {count > 0 && (
                  <span
                    className={cn(
                      "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold tabular-nums flex items-center justify-center border",
                      active
                        ? "bg-background text-foreground border-foreground"
                        : "bg-foreground text-background border-paper"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Priority filter — collapsed by default to a single flag button to
            keep the home screen calm. Tap the flag to expand the chip row;
            when a priority is active we show just that one chip alongside so
            the user always sees what's filtered. */}
        {(() => {
          const activeColor = colorFilter
            ? FOLDER_COLORS.find((c) => c.id === colorFilter) ?? null
            : null;
          const expanded = priorityExpanded || (sortByFlag && !activeColor);
          return (
            <div className="flex gap-2 mb-3 items-center -mx-1 px-1 py-2 overflow-x-auto">
              <button
                onClick={() => {
                  haptic.light();
                  setPriorityExpanded((v) => !v);
                }}
                aria-label={expanded ? "Hide priority filter" : "Show priority filter"}
                aria-expanded={expanded}
                title="Priority filter"
                className={cn(
                  "h-11 w-11 sm:h-9 sm:w-9 rounded-full flex items-center justify-center border transition-smooth flex-shrink-0",
                  activeColor || sortByFlag
                    ? "bg-foreground text-background border-foreground"
                    : "bg-paper hairline ink-soft hover:bg-sunk"
                )}
              >
                <Flag className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={1.75} />
              </button>

              {/* Collapsed: show the active priority chip (if any) so context
                  is always visible without expanding the row. */}
              {!expanded && activeColor && (
                <button
                  onClick={() => setColorFilter(null)}
                  title={`Clear ${activeColor.label} filter`}
                  aria-label={`Clear ${activeColor.label} filter`}
                  className="h-9 sm:h-7 pl-2 pr-2.5 rounded-full text-[12px] sm:text-[11px] font-medium border bg-foreground text-background border-foreground transition-smooth inline-flex items-center gap-1.5 animate-fade-in"
                >
                  <span className="h-3 w-3 rounded-full" style={folderSwatchStyle(activeColor.id)} />
                  <X className="h-3 w-3" strokeWidth={2} />
                </button>
              )}

              {expanded && (
                <div className="flex gap-1 sm:gap-1.5 items-center animate-fade-in min-w-0">
                  <button
                    onClick={() => setSortByFlag((s) => !s)}
                    aria-label="Sort by priority"
                    title="Sort by priority"
                    className={cn(
                      "h-8 sm:h-7 px-2 sm:px-2.5 rounded-full text-[10px] uppercase tracking-[0.12em] font-semibold border transition-smooth flex-shrink-0",
                      sortByFlag
                        ? "bg-foreground text-background border-foreground"
                        : "bg-paper hairline ink-faint hover:bg-sunk"
                    )}
                  >
                    Sort
                  </button>
                  <button
                    onClick={() => setColorFilter(null)}
                    title="All priorities"
                    className={cn(
                      "h-8 w-8 sm:h-7 sm:w-7 rounded-full text-[10px] font-medium border transition-smooth flex-shrink-0 inline-flex items-center justify-center",
                      colorFilter === null
                        ? "bg-foreground text-background border-foreground"
                        : "bg-paper hairline ink-faint hover:bg-sunk"
                    )}
                  >
                    All
                  </button>
                  {FOLDER_COLORS.map((c) => {
                    const active = colorFilter === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setColorFilter(active ? null : c.id)}
                        title={c.label}
                        aria-label={`Filter by ${c.label}`}
                        aria-pressed={active}
                        className={cn(
                          "h-8 w-8 sm:h-7 sm:w-7 rounded-full flex items-center justify-center transition-smooth flex-shrink-0 border",
                          active
                            ? "border-foreground ring-2 ring-foreground/30 scale-110"
                            : "border-transparent hover:bg-sunk"
                        )}
                      >
                        <span className="h-3.5 w-3.5 rounded-full" style={folderSwatchStyle(c.id)} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Tag filter chip row — only shown when tags exist. Filters the list
            without ever exposing tags in the composer header. */}
        {allTags.length > 0 && (
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
                  : "bg-paper hairline ink-faint hover:bg-sunk"
              )}
            >
              All
            </button>
            {allTags.map(({ tag, count }) => {
              const active = tagFilter === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setTagFilter(active ? null : tag)}
                  className={cn(
                    "h-8 sm:h-7 px-3 rounded-full text-[12px] sm:text-[11px] font-medium border transition-smooth whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-paper hairline ink-soft hover:bg-sunk"
                  )}
                >
                  <span>#{tag}</span>
                  <span className={cn("text-[10px] tabular-nums", active ? "opacity-80" : "ink-faint")}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Folder navigation lives in the side menu (top-right) to keep the home screen calm. */}

        {/* List */}
        {!loaded ? (
          <div className="py-24 text-center ink-faint text-sm">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="py-24 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sunk hairline border mb-4">
              <FileText className="h-6 w-6 ink-faint" strokeWidth={1.5} />
            </div>
            <p className="font-display text-lg ink">A blank page</p>
            <p className="text-sm ink-faint mt-1">
              {query ? "Nothing matches that search." : "Capture a thought — turn it into anything later."}
            </p>
          </div>
        ) : (
          (() => {
            const renderSwipe = (n: Note, child: React.ReactNode) => (
              <SwipeRow
                key={n.id}
                pinned={n.pinned}
                archived={n.archived}
                done={n.done}
                onComplete={() => {
                  haptic.success();
                  updateNote(n.id, { done: !n.done });
                  toast(n.done ? "Reopened" : "Completed");
                }}
                onSetReminder={() => handleSetReminder(n)}
                onDuplicate={() => handleDuplicate(n)}
                onPinToggle={() => {
                  haptic.success();
                  updateNote(n.id, { pinned: !n.pinned });
                  toast(n.pinned ? "Unpinned" : "Pinned to top");
                }}
                onArchiveToggle={() => {
                  haptic.success();
                  updateNote(n.id, { archived: !n.archived });
                  toast(n.archived ? "Restored" : "Archived");
                }}
                onDelete={() => {
                  haptic.success();
                  deleteNote(n.id);
                  toast("Deleted");
                }}
                actions={buildRowActions(n)}
                actionsTitle={n.title || "Untitled note"}
                actionsSubtitle={relativeTime(n.updated_at)}
              >
                {child}
              </SwipeRow>
            );

            const renderCard = (n: Note) =>
              renderSwipe(
                n,
                <NoteCard
                  note={n}
                  folder={n.folder_id ? folderById[n.folder_id] : null}
                  highlight={drawerHighlightIds.has(n.id)}
                  onOpen={() => openView(n)}
                  onToggleDone={() => updateNote(n.id, { done: !n.done })}
                />
              );

            const renderRow = (n: Note) =>
              renderSwipe(
                n,
                <NoteListItem
                  note={n}
                  folder={n.folder_id ? folderById[n.folder_id] : null}
                  highlight={drawerHighlightIds.has(n.id)}
                  onOpen={() => openView(n)}
                  onToggleDone={() => updateNote(n.id, { done: !n.done })}
                />
              );

            // Re-group the paged slice for the Folders view so infinite
            // scroll progressively reveals more notes across folders.
            const pagedGroups = (() => {
              if (viewMode !== "folders") return [];
              const m = new Map<string, Note[]>();
              pagedVisible.forEach((n) => {
                const key = n.folder_id ?? "inbox";
                if (!m.has(key)) m.set(key, []);
                m.get(key)!.push(n);
              });
              return groupedByFolder
                .map((g) => ({ ...g, notes: m.get(g.id) ?? [] }))
                .filter((g) => g.notes.length);
            })();

            const body =
              viewMode === "list" ? (
                <div className="flex flex-col gap-2">{pagedVisible.map(renderRow)}</div>
              ) : viewMode === "folders" ? (
                <div className="space-y-8">
                  {pagedGroups.map((g) => (
                    <section key={g.id}>
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <span className="h-3 w-3 rounded-full" style={folderSwatchStyle(g.color)} />
                        <h3 className="font-display text-lg ink">{g.name}</h3>
                        <span className="text-[11px] ink-faint">{g.notes.length}</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {g.notes.map(renderCard)}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pagedVisible.map(renderCard)}
                </div>
              );

            return (
              <>
                {body}
                {/* Infinite-scroll sentinel + status */}
                <div ref={sentinelRef} className="h-12" aria-hidden />
                <div className="text-center text-[11px] ink-faint pt-2 pb-6">
                  {hasMore ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      Loading more… ({shown} of {total})
                    </span>
                  ) : total > 24 ? (
                    `End of list — ${total} notes`
                  ) : null}
                </div>
              </>
            );
          })()
        )}
        </>
        )}
      </div>
      </PullToRefresh>

      <div
        className="fixed right-6 sm:right-10 flex items-center gap-3"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={() => {
            haptic.light();
            setVoiceOpen(true);
          }}
          aria-label="Voice memo"
          title="Voice memo"
          className="h-12 w-12 sm:h-11 sm:w-11 rounded-full bg-paper hairline border ink-soft shadow-lift flex items-center justify-center transition-smooth hover:bg-sunk active:scale-95"
        >
          <Mic className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <button
          onClick={handleNew}
          className="h-16 w-16 sm:h-14 sm:w-14 rounded-full bg-foreground text-background shadow-lift flex items-center justify-center transition-smooth hover:scale-105 active:scale-95"
          aria-label="New note"
        >
          <Plus className="h-7 w-7 sm:h-6 sm:w-6" strokeWidth={2} />
        </button>
      </div>

      {editingFresh && (
        <Composer
          note={editingFresh}
          folders={folders}
          onClose={() => {
            // Discard the row entirely if the user opened a "Skip" draft
            // and never added a real title or content — keeps the DB clean.
            const fresh = notes.find((n) => n.id === editingFresh.id);
            if (
              fresh &&
              !fresh.deleted_at &&
              (fresh.title === "Untitled" || !fresh.title?.trim()) &&
              !fresh.text?.trim() &&
              !fresh.links?.length &&
              !fresh.attachments?.length
            ) {
              purgeNote(fresh.id);
            }
            setEditing(null);
          }}
          onPatch={(patch) => updateNote(editingFresh.id, patch)}
          onDelete={() => deleteNote(editingFresh.id)}
          onAddLink={(url) => addLink(editingFresh.id, url)}
          onRemoveLink={(linkId) => removeLink(editingFresh.id, linkId)}
          onAddAttachment={(a) => addAttachment(editingFresh.id, a)}
          onRemoveAttachment={(attId) => {
            const att = editingFresh.attachments?.find((x) => x.id === attId);
            if (att) return removeAttachment(editingFresh.id, att);
          }}
          onCreateFolder={(name, color) => createFolder(name, color)}
          onUpdateFolder={(id, patch) => updateFolder(id, patch)}
        />
      )}

      {viewingFresh && !editingFresh && (
        <NoteViewer
          // Re-mount when the active note changes so the viewer's internal
          // state (view mode, scroll position, drag offset) resets cleanly.
          key={viewingFresh.id}
          note={viewingFresh}
          folder={viewingFolder}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewingFresh);
            setViewing(null);
          }}
          onDelete={() => {
            deleteNote(viewingFresh.id);
            setViewing(null);
            toast("Deleted");
          }}
          onToggleDone={() => updateNote(viewingFresh.id, { done: !viewingFresh.done })}
          onTogglePin={() => {
            updateNote(viewingFresh.id, { pinned: !viewingFresh.pinned });
            toast(viewingFresh.pinned ? "Unpinned" : "Pinned to top");
          }}
          onToggleArchive={() => {
            updateNote(viewingFresh.id, { archived: !viewingFresh.archived });
            toast(viewingFresh.archived ? "Restored" : "Archived");
          }}
          onToggleLock={() => handleToggleLock(viewingFresh)}
          onUpdateSubtasks={(next) => updateNote(viewingFresh.id, { subtasks: next })}
          onUpdatePriority={(next) => updateNote(viewingFresh.id, { priority: next })}
          onUpdateRemind={(nextIso) =>
            updateNote(viewingFresh.id, { remind_at: nextIso, fired: false })
          }
          hasPrev={!!viewingPrev}
          hasNext={!!viewingNext}
          onNavigate={(dir) => {
            const target = dir === "prev" ? viewingPrev : viewingNext;
            if (!target) return;
            // Skip locked notes that haven't been unlocked this session — show
            // the PIN prompt instead so the lock contract isn't bypassed.
            if (target.locked && !isUnlocked(target.id)) {
              setPendingUnlock(target);
              return;
            }
            setViewing(target);
          }}
        />
      )}

      {/* Unlock prompt: shown when user taps a locked note. */}
      <PinPad
        open={!!pendingUnlock && !!pinProfile?.hasPin}
        title="Enter PIN"
        subtitle="This note is locked. Enter your PIN to view it."
        length={(pinProfile?.pinLength ?? 4) as 4 | 6}
        onCancel={() => setPendingUnlock(null)}
        onSubmit={async (pin) => {
          const ok = await verifyPin(pin);
          if (!ok) return false;
          if (pendingUnlock) {
            markUnlocked(pendingUnlock.id);
            setViewing(pendingUnlock);
            setPendingUnlock(null);
          }
        }}
      />

      {/* PIN setup: first-time creation when locking a note without a PIN. */}
      <PinPad
        open={setupOpen}
        title={`Choose a ${setupLength}-digit PIN`}
        subtitle="Used to unlock any note you protect with a lock."
        length={setupLength}
        onCancel={() => {
          setSetupOpen(false);
          setPendingLock(null);
        }}
        onSubmit={async (pin) => {
          await savePin(pin);
          setPinProfile({ hasPin: true, pinLength: pin.length as PinLength });
          if (pendingLock) {
            await updateNote(pendingLock.id, { locked: true });
            markUnlocked(pendingLock.id);
            toast("Note locked");
          }
          setPendingLock(null);
          setSetupOpen(false);
        }}
        footer={
          <button
            type="button"
            onClick={() => setSetupLength((l) => (l === 4 ? 6 : 4))}
            className="w-full text-center text-[12px] ink-soft hover:ink transition-colors"
          >
            Use {setupLength === 4 ? "6" : "4"} digits instead
          </button>
        }
      />

      <NewNoteDialog
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        onCreate={createFromDraft}
      />

      {/* Bottom-left quick-draft tab — drag up to summon a minimal composer.
          Saves a draft note the user can refine (or run AI on) later. */}
      <QuickNoteTab
        onCreate={async (title, body, extras) => {
          const folder_id =
            folderFilter !== "all" && folderFilter !== "inbox" ? folderFilter : null;
          await createNote({
            title,
            text: body,
            folder_id,
            mode: extras?.mode ?? "note",
            remind_at: extras?.remind_at ?? null,
          });
        }}
      />

      {/* Voice memo — opens inline as a bottom sheet so it feels like part
          of the home screen rather than a hard route change. */}
      <Sheet open={voiceOpen} onOpenChange={setVoiceOpen}>
        <SheetContent
          side="bottom"
          className="p-0 bg-paper hairline border-t rounded-t-3xl max-h-[92dvh] flex flex-col [&>button]:hidden"
          style={{
            paddingTop: 0,
            paddingBottom: 0,
          }}
        >
          <div className="pt-2 pb-1 flex justify-center flex-shrink-0">
            <div className="h-1 w-10 rounded-full bg-foreground/15" />
          </div>
          <SheetHeader className="px-5 pt-2 pb-3 flex-shrink-0 flex-row items-center justify-between gap-3 space-y-0">
            <SheetTitle className="text-[11px] uppercase tracking-[0.22em] ink-faint font-medium text-left">
              Voice memo
            </SheetTitle>
            <div className="flex items-center gap-2">
              <a
                href="/memos"
                onClick={() => setVoiceOpen(false)}
                className="text-[11px] uppercase tracking-[0.18em] ink-faint hover:ink transition-smooth"
              >
                All memos
              </a>
              <SheetClose
                aria-label="Close voice memo"
                className="rounded-full bg-sunk hairline border px-3.5 py-1.5 text-xs font-medium ink-soft hover:bg-paper transition-smooth"
              >
                Done
              </SheetClose>
            </div>
          </SheetHeader>
          <div
            className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5"
            style={{
              paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {voiceOpen && (
              <VoiceRecorder
                variant="full"
                onSaved={() => {
                  setVoiceOpen(false);
                  toast.success("Memo saved");
                }}
                onClose={() => setVoiceOpen(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function QuickAddTask({
  onAdd,
}: {
  onAdd: (
    title: string,
    priority: "low" | "medium" | "high",
    remindAt: string | null
  ) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [showDue, setShowDue] = useState(false);
  const [dueDate, setDueDate] = useState(""); // YYYY-MM-DD
  const [dueTime, setDueTime] = useState("09:00");

  const buildIso = (): string | null => {
    if (!dueDate) return null;
    const [y, m, d] = dueDate.split("-").map((v) => parseInt(v, 10));
    const [hh, mm] = (dueTime || "09:00").split(":").map((v) => parseInt(v, 10));
    const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  };

  const submit = async () => {
    const title = value.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await onAdd(title, priority, buildIso());
      setValue("");
      setDueDate("");
      setDueTime("09:00");
      setShowDue(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not add task");
    } finally {
      setBusy(false);
    }
  };
  const dotClass =
    priority === "high" ? "bg-rose-500" : priority === "low" ? "bg-emerald-500" : "bg-amber-500";
  const cyclePriority = () => {
    haptic.light();
    setPriority((p) => (p === "medium" ? "high" : p === "high" ? "low" : "medium"));
  };
  return (
    <div className="rounded-2xl bg-paper hairline border px-3 py-2 shadow-soft space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={cyclePriority}
          className="h-8 w-8 rounded-full hairline border bg-sunk flex items-center justify-center transition-smooth hover:bg-paper"
          aria-label={`Priority: ${priority}. Click to change.`}
          title={`Priority: ${priority}`}
        >
          <span className={cn("h-2.5 w-2.5 rounded-full", dotClass)} />
        </button>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Add a task and press Enter…"
          className="flex-1 bg-transparent outline-none text-[15px] ink placeholder:ink-faint py-2"
          aria-label="Quick add task"
        />
        <button
          type="button"
          onClick={() => {
            haptic.light();
            setShowDue((v) => !v);
          }}
          aria-label="Set due date"
          title={dueDate ? `Due ${dueDate} ${dueTime}` : "Set due date"}
          className={cn(
            "h-8 w-8 rounded-full hairline border flex items-center justify-center transition-smooth",
            dueDate || showDue ? "bg-foreground text-background border-foreground" : "bg-sunk ink-soft hover:bg-paper"
          )}
        >
          <Clock className="h-4 w-4" strokeWidth={1.75} />
        </button>
        {value.trim() && (
          <button
            onClick={submit}
            disabled={busy}
            className="h-9 px-3 rounded-xl bg-foreground text-background text-[12px] font-medium transition-smooth hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            Add
          </button>
        )}
      </div>

      {showDue && (
        <div className="flex items-center gap-2 flex-wrap pl-10">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-8 px-2 rounded-lg bg-sunk hairline border text-[12px] ink focus:outline-none focus:ring-2 focus:ring-foreground/10"
            aria-label="Due date"
          />
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            disabled={!dueDate}
            className="h-8 px-2 rounded-lg bg-sunk hairline border text-[12px] ink disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-foreground/10"
            aria-label="Due time"
          />
          {dueDate && (
            <button
              type="button"
              onClick={() => {
                haptic.light();
                setDueDate("");
              }}
              className="h-8 px-2 rounded-lg text-[11px] uppercase tracking-[0.12em] font-medium ink-faint hairline border bg-sunk hover:bg-paper"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
