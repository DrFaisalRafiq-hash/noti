import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Download, FileText, Film, Mic2, Pause, Play, Square } from "lucide-react";
import { useStudioRecorder } from "@/hooks/useStudioRecorder";
import { extForMime, formatDuration } from "@/lib/voice-memos";

interface Palette {
  bg: string;
  paper: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  line: string;
  accent: string;
  olive: string;
}

interface Props {
  palette: Palette;
}

type DemoTab = "podcast" | "screenplay";

const PODCAST_LINES: { who: string; line: string }[] = [
  { who: "HOST", line: "Welcome back. Today we're talking about the one productivity trick that actually works — and it isn't a calendar." },
  { who: "HOST", line: "Stay with me, because by the end of this episode you'll have a 30-second exercise you can do tomorrow morning." },
  { who: "(beat)", line: "" },
  { who: "HOST", line: "Let's get into it." },
];

const SCRIPT_LINES: { kind: "slug" | "action" | "char" | "dialogue" | "paren"; text: string }[] = [
  { kind: "slug", text: "INT. SMALL APARTMENT — NIGHT" },
  { kind: "action", text: "MAYA, 28, sits cross-legged on the floor, surrounded by sticky notes. Her phone buzzes — a single notification." },
  { kind: "char", text: "MAYA" },
  { kind: "paren", text: "(reading)" },
  { kind: "dialogue", text: "\"Don't forget why you started.\"" },
  { kind: "action", text: "She exhales. Picks up the pen. Writes." },
];

export default function LandingShowcase({ palette }: Props) {
  const [tab, setTab] = useState<DemoTab>("podcast");

  return (
    <section
      id="showcase"
      className="border-t py-24"
      style={{ borderColor: palette.line }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: `${palette.olive}26`,
              color: palette.ink,
              border: `1px solid ${palette.olive}55`,
            }}
          >
            <Mic2 size={12} /> New · Podcast & screenplay maker
          </span>
          <h2
            className="font-display mt-6 text-4xl font-semibold tracking-tight md:text-5xl"
            style={{ letterSpacing: "-0.02em" }}
          >
            Write a podcast.
            <br />
            Record it. Ship it.
          </h2>
          <p className="mt-4 text-lg" style={{ color: palette.inkSoft }}>
            Noti is also a writing room. Draft your next episode or short film in
            a quiet, format-aware editor — then record it in the browser and push
            it to your podcast feed without leaving the app.
          </p>
        </div>

        {/* Tab switch */}
        <div className="mt-10 flex justify-center">
          <div
            className="inline-flex rounded-full p-1 text-sm"
            style={{
              background: palette.paper,
              border: `1px solid ${palette.line}`,
            }}
          >
            {(
              [
                { id: "podcast", label: "Podcast script", icon: Mic2 },
                { id: "screenplay", label: "Movie script", icon: Film },
              ] as { id: DemoTab; label: string; icon: typeof Mic2 }[]
            ).map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 transition"
                  style={
                    active
                      ? { background: palette.ink, color: palette.bg }
                      : { color: palette.inkSoft }
                  }
                >
                  <t.icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Two-column demo */}
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          {/* Editor preview */}
          <div
            className="rounded-2xl p-6 shadow-sm"
            style={{
              background: palette.paper,
              border: `1px solid ${palette.line}`,
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span
                className="text-[10px] uppercase tracking-[0.18em]"
                style={{ color: palette.inkFaint }}
              >
                {tab === "podcast" ? "Episode 042 — Draft" : "Untitled — pg. 1"}
              </span>
              <span
                className="text-[10px] uppercase tracking-[0.18em]"
                style={{ color: palette.inkFaint }}
              >
                {tab === "podcast" ? "Hook · Intro · Body · Outro" : "Screenplay format"}
              </span>
            </div>
            {tab === "podcast" ? (
              <PodcastDemo palette={palette} />
            ) : (
              <ScreenplayDemo palette={palette} />
            )}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link
                to="/script"
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                style={{ background: palette.ink, color: palette.bg }}
              >
                Try the script maker <ArrowRight size={14} />
              </Link>
              <span
                className="text-xs"
                style={{ color: palette.inkFaint }}
              >
                Templates · PDF + .txt export · No account required
              </span>
            </div>
          </div>

          {/* Studio recorder demo */}
          <StudioDemo palette={palette} />
        </div>
      </div>
    </section>
  );
}

function PodcastDemo({ palette }: { palette: Palette }) {
  return (
    <div className="space-y-4">
      <div>
        <span
          className="block text-[10px] uppercase tracking-[0.18em]"
          style={{ color: palette.inkFaint }}
        >
          §  Hook
        </span>
        <p
          className="font-display mt-1 text-lg leading-snug"
          style={{ color: palette.ink }}
        >
          The 30-second productivity trick that doesn't involve a calendar.
        </p>
      </div>
      <div className="space-y-2">
        {PODCAST_LINES.map((l, i) => (
          <div key={i}>
            {l.who && (
              <span
                className="font-display text-[11px] uppercase tracking-[0.22em]"
                style={{ color: palette.accent }}
              >
                {l.who}
              </span>
            )}
            {l.line && (
              <p className="text-sm leading-relaxed mt-0.5" style={{ color: palette.inkSoft }}>
                {l.line}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenplayDemo({ palette }: { palette: Palette }) {
  return (
    <div className="font-mono text-[13px] leading-relaxed space-y-1.5" style={{ color: palette.inkSoft }}>
      {SCRIPT_LINES.map((l, i) => {
        if (l.kind === "slug")
          return (
            <p key={i} className="uppercase tracking-wider" style={{ color: palette.ink }}>
              {l.text}
            </p>
          );
        if (l.kind === "action") return <p key={i}>{l.text}</p>;
        if (l.kind === "char")
          return (
            <p key={i} className="text-center uppercase mt-3" style={{ color: palette.ink }}>
              {l.text}
            </p>
          );
        if (l.kind === "paren")
          return (
            <p key={i} className="text-center" style={{ color: palette.inkFaint }}>
              {l.text}
            </p>
          );
        return (
          <p key={i} className="text-center max-w-md mx-auto">
            {l.text}
          </p>
        );
      })}
    </div>
  );
}

function StudioDemo({ palette }: { palette: Palette }) {
  const MAX = 30;
  const [mode, setMode] = useState<"raw" | "cleaned">("cleaned");
  const rec = useStudioRecorder({ mode, maxSeconds: MAX });
  const audioUrlRef = useRef<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!rec.result) return;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(rec.result.blob);
    audioUrlRef.current = url;
    setAudioUrl(url);
    return () => {
      // cleanup on unmount handled below
    };
  }, [rec.result]);

  useEffect(
    () => () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [],
  );

  const download = () => {
    if (!rec.result) return;
    const a = document.createElement("a");
    a.href = audioUrl!;
    a.download = `noti-studio-demo.${extForMime(rec.result.mime)}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const reset = () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setAudioUrl(null);
    rec.reset();
  };

  return (
    <div
      className="rounded-2xl p-6 shadow-sm flex flex-col"
      style={{
        background: palette.paper,
        border: `1px solid ${palette.line}`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <span
            className="block text-[10px] uppercase tracking-[0.18em]"
            style={{ color: palette.inkFaint }}
          >
            Studio recorder
          </span>
          <p
            className="font-display text-lg mt-1"
            style={{ color: palette.ink }}
          >
            Record a 30-second take
          </p>
        </div>
        <div
          className="inline-flex rounded-full p-0.5 text-[10px]"
          style={{ background: palette.bg, border: `1px solid ${palette.line}` }}
        >
          {(["raw", "cleaned"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={rec.recording}
              className="px-2 py-1 rounded-full uppercase tracking-wider"
              style={
                mode === m
                  ? { background: palette.ink, color: palette.bg }
                  : { color: palette.inkSoft }
              }
            >
              {m === "raw" ? "Raw 48k" : "Cleaned"}
            </button>
          ))}
        </div>
      </div>

      {/* Scope */}
      <div
        className="relative h-20 w-full overflow-hidden rounded-lg"
        style={{ background: palette.bg, border: `1px solid ${palette.line}` }}
      >
        <div className="absolute inset-0 flex items-center justify-between gap-[1px] px-1">
          {rec.waveform.map((v, i) => (
            <span
              key={i}
              className="flex-1 rounded-full"
              style={{
                height: `${Math.max(0.05, v) * 100}%`,
                background: rec.recording && !rec.paused ? palette.ink : `${palette.ink}55`,
                transition: "height 75ms linear",
              }}
            />
          ))}
        </div>
      </div>

      {/* Counter + transport */}
      <div className="mt-4 flex items-center justify-center gap-3">
        {!rec.recording && !rec.result && (
          <button
            onClick={() => rec.start()}
            disabled={!rec.supported}
            className="h-14 w-14 rounded-full flex items-center justify-center shadow-lift active:scale-95 disabled:opacity-50"
            style={{ background: "#dc2626", color: "#fff" }}
            aria-label="Record"
          >
            <Mic2 className="h-6 w-6" />
          </button>
        )}
        {rec.recording && (
          <>
            {rec.paused ? (
              <button
                onClick={rec.resume}
                className="h-12 w-12 rounded-full flex items-center justify-center"
                style={{ background: palette.ink, color: palette.bg }}
                aria-label="Resume"
              >
                <Play className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={rec.pause}
                className="h-12 w-12 rounded-full flex items-center justify-center"
                style={{ background: palette.bg, color: palette.ink, border: `1px solid ${palette.line}` }}
                aria-label="Pause"
              >
                <Pause className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={rec.stop}
              className="h-14 w-14 rounded-full flex items-center justify-center shadow-lift"
              style={{ background: "#dc2626", color: "#fff" }}
              aria-label="Stop"
            >
              <Square className="h-5 w-5 fill-current" />
            </button>
          </>
        )}
        {rec.result && !rec.recording && audioUrl && (
          <>
            <button
              onClick={() => {
                if (!audioEl.current) return;
                if (playing) audioEl.current.pause();
                else audioEl.current.play();
              }}
              className="h-12 w-12 rounded-full flex items-center justify-center"
              style={{ background: palette.ink, color: palette.bg }}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </button>
            <button
              onClick={download}
              className="h-12 px-4 rounded-full inline-flex items-center gap-1.5 text-sm"
              style={{ background: palette.bg, color: palette.ink, border: `1px solid ${palette.line}` }}
            >
              <Download className="h-4 w-4" /> Download
            </button>
            <button
              onClick={reset}
              className="h-12 px-4 rounded-full text-sm"
              style={{ color: palette.inkSoft }}
            >
              Reset
            </button>
            <audio
              ref={audioEl}
              src={audioUrl}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              preload="metadata"
              className="hidden"
            />
          </>
        )}
      </div>

      <div className="mt-2 text-center font-display tabular-nums" style={{ color: palette.ink }}>
        <span className="text-2xl">
          {rec.result
            ? formatDuration(rec.result.seconds)
            : formatDuration(rec.seconds)}
        </span>
        {!rec.result && (
          <span className="text-xs ml-2" style={{ color: palette.inkFaint }}>
            / 0:30
          </span>
        )}
      </div>

      {rec.error && (
        <p className="mt-2 text-center text-xs" style={{ color: "#fca5a5" }}>
          {rec.error}
        </p>
      )}

      <div className="mt-auto pt-5">
        <ul className="space-y-1.5 text-sm" style={{ color: palette.inkSoft }}>
          <li className="flex items-start gap-2">
            <FileText size={14} className="mt-0.5 flex-shrink-0" style={{ color: palette.accent }} />
            Inside the app, the studio records <em>against your script</em> — segment by segment, multiple takes, master export.
          </li>
          <li className="flex items-start gap-2">
            <Mic2 size={14} className="mt-0.5 flex-shrink-0" style={{ color: palette.accent }} />
            Choose Raw 48kHz mono for studio fidelity, or Cleaned voice when you're recording on a laptop mic.
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight size={14} className="mt-0.5 flex-shrink-0" style={{ color: palette.accent }} />
            Connect your RSS.com show in Settings to publish the finished episode in one tap.
          </li>
        </ul>
        <Link
          to="/auth?mode=signup"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: palette.ink, color: palette.bg }}
        >
          Open Noti Studio <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
