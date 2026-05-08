import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import NotiMark from "@/components/brand/NotiMark";
import NotiWordmark from "@/components/NotiWordmark";
import {
  useStudioRecorder,
  type StudioMode,
} from "@/hooks/useStudioRecorder";
import { parseScript, type PodcastScript, type ScriptSegment } from "@/lib/podcast-script";
import {
  formatDuration,
  uploadVoiceMemoBlob,
  createVoiceMemo,
  extForMime,
} from "@/lib/voice-memos";
import { loadPodcastSettings } from "@/lib/podcast-settings";
import { cn } from "@/lib/utils";

interface ScriptNoteOption {
  id: string;
  title: string;
  script: PodcastScript;
}

interface SegmentTake {
  blob: Blob;
  mime: string;
  seconds: number;
  mode: StudioMode;
  url: string;
  recordedAt: number;
}

export default function PodcastStudio() {
  const [userId, setUserId] = useState<string | null>(null);
  const [scripts, setScripts] = useState<ScriptNoteOption[]>([]);
  const [scriptId, setScriptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPublishingSetup, setHasPublishingSetup] = useState(false);

  const [mode, setMode] = useState<StudioMode>("cleaned");
  const [segIdx, setSegIdx] = useState(0);
  // takes keyed by segment id
  const takesRef = useRef<Record<string, SegmentTake[]>>({});
  const [, forceTakeUpdate] = useState(0);
  const bumpTakes = () => forceTakeUpdate((n) => n + 1);

  const rec = useStudioRecorder({ mode });

  // Load auth + scripts + settings
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      if (!alive) return;
      setUserId(uid);
      try {
        // Pull recent notes; filter to script-flagged ones in JS (avoids FTS).
        const { data: notes } = await supabase
          .from("notes")
          .select("id,title,text,mode,updated_at")
          .order("updated_at", { ascending: false })
          .limit(200);
        const opts: ScriptNoteOption[] = [];
        for (const n of notes ?? []) {
          const script = parseScript((n as { text?: string }).text);
          if (!script || script.kind === "screenplay") continue;
          opts.push({
            id: (n as { id: string }).id,
            title:
              ((n as { title?: string | null }).title?.trim() ||
                script.brief.topic ||
                "Untitled podcast") + "",
            script,
          });
        }
        if (!alive) return;
        setScripts(opts);
        if (opts.length && !scriptId) setScriptId(opts[0].id);

        if (uid) {
          const settings = await loadPodcastSettings(uid);
          if (alive) setHasPublishingSetup(!!(settings?.api_key && settings?.show_id));
        }
      } catch (err) {
        console.error("studio bootstrap", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeScript = useMemo(
    () => scripts.find((s) => s.id === scriptId) ?? null,
    [scripts, scriptId],
  );

  const segments = useMemo<ScriptSegment[]>(() => {
    if (!activeScript) return [];
    return activeScript.script.segments.filter(
      (s) => s.kind === "dialogue" || s.kind === "section",
    );
  }, [activeScript]);

  // Reset segment index when switching scripts
  useEffect(() => {
    setSegIdx(0);
  }, [scriptId]);

  const currentSeg = segments[segIdx] ?? null;
  const currentTakes = currentSeg ? takesRef.current[currentSeg.id] ?? [] : [];

  // When recorder finishes, capture into the current segment's takes
  useEffect(() => {
    if (!rec.result || !currentSeg) return;
    const url = URL.createObjectURL(rec.result.blob);
    const take: SegmentTake = {
      blob: rec.result.blob,
      mime: rec.result.mime,
      seconds: rec.result.seconds,
      mode,
      url,
      recordedAt: Date.now(),
    };
    const list = takesRef.current[currentSeg.id] ?? [];
    takesRef.current = { ...takesRef.current, [currentSeg.id]: [...list, take] };
    bumpTakes();
    rec.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.result]);

  // Cleanup blob URLs on unmount
  useEffect(
    () => () => {
      Object.values(takesRef.current)
        .flat()
        .forEach((t) => URL.revokeObjectURL(t.url));
    },
    [],
  );

  const totalTakes = Object.values(takesRef.current).flat().length;
  const totalSeconds = Object.values(takesRef.current)
    .flat()
    .reduce((acc, t) => acc + t.seconds, 0);

  const masterTitle = activeScript?.title ?? "Episode";

  const exportMaster = async (action: "download" | "save") => {
    // Build a single Blob = concatenated takes in script order.
    if (!activeScript) {
      toast.error("Pick a script first");
      return;
    }
    const ordered: SegmentTake[] = [];
    for (const seg of segments) {
      const list = takesRef.current[seg.id] ?? [];
      if (!list.length) continue;
      // Use latest take per segment.
      ordered.push(list[list.length - 1]);
    }
    if (!ordered.length) {
      toast.error("Record at least one take first");
      return;
    }
    // Group by mime; if all same we can simply concat blobs (works for most webm/ogg/mp4 streams).
    const mime = ordered[0].mime;
    const allSameMime = ordered.every((t) => t.mime === mime);
    if (!allSameMime) {
      toast.error("Takes have mixed formats — re-record any older takes to merge");
      return;
    }
    const master = new Blob(
      ordered.map((t) => t.blob),
      { type: mime },
    );
    const seconds = ordered.reduce((a, t) => a + t.seconds, 0);

    if (action === "download") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(master);
      a.download = `${slugify(masterTitle)}.${extForMime(mime)}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast.success("Episode downloaded");
      return;
    }

    // Save as a Voice Memo so it lives alongside other recordings.
    try {
      const { url, storage_path } = await uploadVoiceMemoBlob(master, mime);
      const memo = await createVoiceMemo({
        title: masterTitle,
        url,
        storage_path,
        mime_type: mime,
        duration_seconds: seconds,
        size_bytes: master.size,
      });
      toast.success("Saved to Voice Memos");
      return memo;
    } catch (err) {
      toast.error((err as Error).message || "Couldn't save episode");
    }
  };

  const publishEpisode = async () => {
    if (!hasPublishingSetup) {
      toast.error("Add your RSS.com key in Settings → Podcast publishing first");
      return;
    }
    const memo = await exportMaster("save");
    if (!memo) return;
    const description = scriptDescription(activeScript?.script);
    const { data, error } = await supabase.functions.invoke(
      "publish-episode-rsscom",
      {
        body: {
          voice_memo_id: memo.id,
          title: masterTitle,
          description,
          script_note_id: activeScript?.id,
        },
      },
    );
    if (error) {
      toast.error(error.message || "Publish failed");
      return;
    }
    if ((data as { ok?: boolean })?.ok) {
      toast.success("Published to RSS.com");
    } else {
      toast.error((data as { error?: string })?.error || "Publish failed");
    }
  };

  if (!userId && !loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <h1 className="font-display text-2xl ink mb-2">Sign in to use Studio</h1>
          <p className="ink-soft text-sm mb-4">
            The Podcast Studio records against your saved scripts and saves takes to your account.
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-foreground text-background text-sm font-medium"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="hairline border-b sticky top-0 z-10 bg-background/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 text-sm ink-soft hover:ink transition-smooth"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <Link to="/" className="ml-1 inline-flex items-center gap-2 ink">
            <NotiMark className="h-5 w-5" />
            <NotiWordmark size="sm" />
          </Link>
          <span className="text-xs ink-faint hidden sm:inline">/ Studio</span>
          <div className="ml-auto flex items-center gap-2">
            <ModeToggle mode={mode} setMode={setMode} disabled={rec.recording} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar: scripts + segments */}
        <aside className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider ink-faint mb-1">
              Episode script
            </label>
            {loading ? (
              <div className="text-sm ink-faint flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : scripts.length === 0 ? (
              <div className="rounded-xl hairline border bg-paper p-4 text-sm ink-soft">
                No scripts yet.{" "}
                <Link to="/script" className="underline ink">
                  Open the Script Maker
                </Link>{" "}
                to create one, then return here.
              </div>
            ) : (
              <select
                value={scriptId ?? ""}
                onChange={(e) => setScriptId(e.target.value)}
                className="w-full h-10 rounded-lg bg-sunk hairline border px-3 text-sm ink"
              >
                {scripts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {segments.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="block text-[11px] uppercase tracking-wider ink-faint">
                  Segments
                </span>
                <span className="text-[10px] ink-faint">
                  {segIdx + 1} / {segments.length}
                </span>
              </div>
              <ul className="rounded-xl hairline border bg-paper overflow-hidden">
                {segments.map((seg, i) => {
                  const takes = takesRef.current[seg.id] ?? [];
                  const recorded = takes.length > 0;
                  const isActive = i === segIdx;
                  return (
                    <li key={seg.id}>
                      <button
                        onClick={() => setSegIdx(i)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-smooth",
                          isActive ? "bg-sunk ink" : "ink-soft hover:bg-sunk/60",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full flex-shrink-0",
                            recorded ? "bg-primary" : "bg-foreground/20",
                          )}
                        />
                        <span className="flex-1 truncate">
                          {seg.kind === "section"
                            ? `§ ${seg.label || "Section"}`
                            : `${seg.label || "Line"} — ${seg.text.slice(0, 30)}${
                                seg.text.length > 30 ? "…" : ""
                              }`}
                        </span>
                        {recorded && (
                          <span className="text-[10px] ink-faint">{takes.length}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="rounded-xl hairline border bg-paper p-3 text-xs ink-soft space-y-1">
            <div className="flex items-center justify-between">
              <span>Total takes</span>
              <span className="ink tabular-nums">{totalTakes}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Master length</span>
              <span className="ink tabular-nums">{formatDuration(totalSeconds)}</span>
            </div>
          </div>
        </aside>

        {/* Main recorder column */}
        <section className="space-y-4">
          {currentSeg ? (
            <div className="rounded-2xl hairline border bg-paper p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-[0.18em] ink-faint">
                  {currentSeg.kind === "section" ? "Section" : currentSeg.label || "Line"}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] ink-faint">
                  <span className={cn("h-1.5 w-1.5 rounded-full",
                    rec.recording ? (rec.paused ? "bg-amber-500" : "bg-destructive animate-pulse") : "bg-foreground/20",
                  )} />
                  {rec.recording ? (rec.paused ? "Paused" : "LIVE") : "Standby"}
                </span>
              </div>
              <p className="font-display text-xl ink leading-snug whitespace-pre-wrap">
                {currentSeg.text}
              </p>
              {currentSeg.durationSec ? (
                <p className="mt-2 text-[11px] ink-faint">
                  Suggested length: {formatDuration(currentSeg.durationSec)}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl hairline border bg-paper p-8 text-center ink-soft">
              Pick a script to start recording.
            </div>
          )}

          {/* Meter + transport */}
          <div className="rounded-2xl hairline border bg-paper p-5 space-y-4">
            <VuMeter level={rec.level} peak={rec.peak} />
            <Scope samples={rec.waveform} live={rec.recording && !rec.paused} />

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setSegIdx((i) => Math.max(0, i - 1))}
                disabled={segIdx === 0 || rec.recording}
                className="h-10 w-10 rounded-full bg-sunk ink hairline border flex items-center justify-center disabled:opacity-40"
                aria-label="Previous segment"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {!rec.recording && (
                <button
                  onClick={() => rec.start()}
                  disabled={!rec.supported || !currentSeg}
                  className="h-16 w-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lift active:scale-95 transition-smooth disabled:opacity-50"
                  aria-label="Start recording"
                >
                  <Mic className="h-7 w-7" strokeWidth={2} />
                </button>
              )}
              {rec.recording && (
                <>
                  {rec.paused ? (
                    <button
                      onClick={rec.resume}
                      className="h-12 w-12 rounded-full bg-foreground text-background flex items-center justify-center"
                      aria-label="Resume"
                    >
                      <Play className="h-5 w-5" />
                    </button>
                  ) : (
                    <button
                      onClick={rec.pause}
                      className="h-12 w-12 rounded-full bg-sunk ink hairline border flex items-center justify-center"
                      aria-label="Pause"
                    >
                      <Pause className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={rec.stop}
                    className="h-16 w-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lift"
                    aria-label="Stop recording"
                  >
                    <Square className="h-6 w-6 fill-current" />
                  </button>
                </>
              )}

              <button
                onClick={() => setSegIdx((i) => Math.min(segments.length - 1, i + 1))}
                disabled={segIdx >= segments.length - 1 || rec.recording}
                className="h-10 w-10 rounded-full bg-sunk ink hairline border flex items-center justify-center disabled:opacity-40"
                aria-label="Next segment"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-center font-display tabular-nums">
              <span className="text-3xl ink">{formatDuration(rec.seconds)}</span>
            </div>

            {rec.error && (
              <p className="text-xs text-destructive text-center">{rec.error}</p>
            )}
          </div>

          {/* Takes for current segment */}
          {currentSeg && currentTakes.length > 0 && (
            <div className="rounded-2xl hairline border bg-paper p-4 space-y-2">
              <h4 className="text-[11px] uppercase tracking-wider ink-faint">
                Takes for this segment
              </h4>
              {currentTakes.map((t, i) => (
                <TakeRow
                  key={t.recordedAt}
                  take={t}
                  index={i + 1}
                  isLatest={i === currentTakes.length - 1}
                  onDelete={() => {
                    URL.revokeObjectURL(t.url);
                    takesRef.current = {
                      ...takesRef.current,
                      [currentSeg.id]: currentTakes.filter((_, j) => j !== i),
                    };
                    bumpTakes();
                  }}
                />
              ))}
            </div>
          )}

          {/* Master export */}
          <div className="rounded-2xl hairline border bg-paper p-4 flex flex-wrap items-center gap-2">
            <div className="text-xs ink-soft mr-auto">
              <span className="ink font-medium">Master:</span>{" "}
              latest take of every recorded segment, in script order.
            </div>
            <button
              onClick={() => exportMaster("download")}
              className="h-9 px-3 rounded-lg bg-sunk ink hairline border text-sm inline-flex items-center gap-1.5"
            >
              <Save className="h-4 w-4" /> Download
            </button>
            <button
              onClick={() => exportMaster("save")}
              className="h-9 px-3 rounded-lg bg-sunk ink hairline border text-sm inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" /> Save to memos
            </button>
            <button
              onClick={publishEpisode}
              disabled={!hasPublishingSetup}
              className={cn(
                "h-9 px-3 rounded-lg text-sm inline-flex items-center gap-1.5",
                hasPublishingSetup
                  ? "bg-foreground text-background"
                  : "bg-sunk ink-faint hairline border cursor-not-allowed",
              )}
              title={
                hasPublishingSetup
                  ? "Publish to RSS.com"
                  : "Add RSS.com key in Settings first"
              }
            >
              <Upload className="h-4 w-4" /> Publish to RSS.com
            </button>
          </div>

          {!hasPublishingSetup && (
            <p className="text-[11px] ink-faint text-center">
              <SettingsIcon className="inline h-3 w-3 mr-1" />
              Add your RSS.com API key in <Link to="/app" className="underline ink">Settings</Link>{" "}
              → Podcast publishing to enable one-click publish.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

// ─────────────────────── Sub-components ───────────────────────

function ModeToggle({
  mode,
  setMode,
  disabled,
}: {
  mode: StudioMode;
  setMode: (m: StudioMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-full bg-sunk hairline border p-0.5 text-[11px]">
      {(["raw", "cleaned"] as StudioMode[]).map((m) => (
        <button
          key={m}
          disabled={disabled}
          onClick={() => setMode(m)}
          className={cn(
            "px-2.5 py-1 rounded-full uppercase tracking-wider transition-smooth disabled:opacity-50",
            mode === m ? "bg-foreground text-background" : "ink-soft",
          )}
          title={
            m === "raw"
              ? "Raw 48kHz mono — no DSP. Truest signal."
              : "Cleaned voice — browser noise suppression on."
          }
        >
          {m === "raw" ? "Raw 48k" : "Cleaned"}
        </button>
      ))}
    </div>
  );
}

function VuMeter({ level, peak }: { level: number; peak: number }) {
  const segments = 24;
  return (
    <div className="flex items-center gap-1 h-3">
      {Array.from({ length: segments }).map((_, i) => {
        const t = (i + 1) / segments;
        const lit = level >= t - 0.02;
        const isPeak = peak >= t - 0.02 && peak < t + 1 / segments;
        const danger = t > 0.85;
        return (
          <span
            key={i}
            className={cn(
              "flex-1 h-full rounded-sm transition-[opacity] duration-75",
              lit
                ? danger
                  ? "bg-destructive"
                  : t > 0.65
                  ? "bg-amber-500"
                  : "bg-primary"
                : "bg-foreground/10",
              isPeak && !lit && "bg-foreground/40",
            )}
          />
        );
      })}
    </div>
  );
}

function Scope({ samples, live }: { samples: number[]; live: boolean }) {
  return (
    <div className="relative h-24 w-full overflow-hidden rounded-lg bg-sunk hairline border">
      <div className="absolute inset-0 flex items-center justify-between gap-[1px] px-1">
        {samples.map((v, i) => {
          const h = Math.max(0.04, v) * 100;
          return (
            <span
              key={i}
              className={cn(
                "flex-1 rounded-full transition-[height] duration-75",
                live ? "bg-foreground" : "bg-foreground/30",
              )}
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>
      <span className="absolute left-0 right-0 top-1/2 h-px bg-foreground/5" />
    </div>
  );
}

function TakeRow({
  take,
  index,
  isLatest,
  onDelete,
}: {
  take: SegmentTake;
  index: number;
  isLatest: boolean;
  onDelete: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => {
          if (!audioRef.current) return;
          if (playing) audioRef.current.pause();
          else audioRef.current.play();
        }}
        className="h-8 w-8 rounded-full bg-sunk ink hairline border flex items-center justify-center"
        aria-label={playing ? "Pause take" : "Play take"}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      <span className="ink-soft tabular-nums">Take {index}</span>
      <span className="ink-faint text-xs">{formatDuration(take.seconds)}</span>
      <span className="text-[10px] uppercase tracking-wider ink-faint">{take.mode}</span>
      {isLatest && (
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary">
          <CheckCircle2 className="h-3 w-3" /> Master
        </span>
      )}
      <button
        onClick={onDelete}
        className="h-8 w-8 rounded-full hover:bg-sunk text-foreground/60 hover:text-destructive flex items-center justify-center"
        aria-label="Delete take"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <audio
        ref={audioRef}
        src={take.url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        preload="metadata"
        className="hidden"
      />
    </div>
  );
}

function scriptDescription(script: PodcastScript | null | undefined): string {
  if (!script) return "";
  const parts: string[] = [];
  if (script.brief.topic) parts.push(script.brief.topic);
  if (script.brief.talkingPoints?.length) {
    parts.push("");
    parts.push("In this episode:");
    for (const p of script.brief.talkingPoints) parts.push(`• ${p}`);
  }
  return parts.join("\n").slice(0, 4000);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "episode";
}
