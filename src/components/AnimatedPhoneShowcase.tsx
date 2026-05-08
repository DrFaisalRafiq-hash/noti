import { useEffect, useState } from "react";
import {
  Bell,
  BellRing,
  CalendarClock,
  Check,
  CircleDashed,
  Folder,
  Mic,
  Pin,
  Plus,
  Search,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import NotiWordmark from "@/components/NotiWordmark";
import notiGlyph from "@/assets/noti-glyph.png";


/**
 * Hero device mock that auto-cycles through 4 screens of the real Noti UX:
 *   1. Notes feed       — what users see on launch
 *   2. Voice capture    — hold-to-record dictation
 *   3. Reminder picker  — turning a note into a notification
 *   4. Folders          — organizing colour-coded folders
 *
 * Each screen cross-fades + scales in. The status bar, notch, and bottom tab
 * bar persist across screens so the device feels continuous. Tab bar icon
 * lights up to match the active screen.
 */

interface Palette {
  bg: string;
  deep: string;
  paper: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  line: string;
  accent: string;
  olive: string;
}

const SCREENS = ["feed", "voice", "remind", "folders"] as const;
type ScreenId = (typeof SCREENS)[number];

const SCREEN_DURATION_MS = 4200;
const FADE_MS = 720;
const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Per-screen entrance/exit personality. */
type Direction = "forward" | "backward";
function transformFor(
  screen: ScreenId,
  state: "enter" | "exit",
  direction: Direction,
): string {
  // Each screen has its own signature motion; the inverse plays on exit.
  const sign = direction === "forward" ? 1 : -1;
  switch (screen) {
    case "feed":
      // Soft fade-up — calm, "home" feel.
      return state === "enter"
        ? "translate3d(0, 0, 0) scale(1)"
        : `translate3d(0, ${-12 * sign}px, 0) scale(0.985)`;
    case "voice":
      // Zoom-in from depth — like the mic launches forward.
      return state === "enter"
        ? "translate3d(0, 0, 0) scale(1)"
        : "translate3d(0, 0, 0) scale(0.88)";
    case "remind":
      // Slides in from the right — like opening a sheet.
      return state === "enter"
        ? "translate3d(0, 0, 0) scale(1)"
        : `translate3d(${28 * sign}%, 0, 0) scale(0.98)`;
    case "folders":
      // Slides up from the bottom — like a drawer.
      return state === "enter"
        ? "translate3d(0, 0, 0) scale(1)"
        : `translate3d(0, ${22 * sign}%, 0) scale(0.98)`;
  }
}

export default function AnimatedPhoneShowcase({ palette }: { palette: Palette }) {
  const [active, setActive] = useState<ScreenId>("feed");
  const [direction, setDirection] = useState<Direction>("forward");
  const [progress, setProgress] = useState(0);

  const goTo = (next: ScreenId) => {
    setActive((cur) => {
      if (cur === next) return cur;
      const i = SCREENS.indexOf(cur);
      const j = SCREENS.indexOf(next);
      // Treat wrap (last → first) as forward so auto-cycle never reverses.
      const forward = j === (i + 1) % SCREENS.length || j > i;
      setDirection(forward ? "forward" : "backward");
      return next;
    });
  };

  useEffect(() => {
    const tick = setInterval(() => {
      setActive((cur) => {
        const i = SCREENS.indexOf(cur);
        setDirection("forward");
        return SCREENS[(i + 1) % SCREENS.length];
      });
    }, SCREEN_DURATION_MS);
    return () => clearInterval(tick);
  }, []);

  // Drive a thin progress bar that resets each time `active` changes.
  useEffect(() => {
    setProgress(0);
    const start = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const p = Math.min(1, (t - start) / SCREEN_DURATION_MS);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <div className="mx-auto mt-20 max-w-4xl">
      {/* Realistic iPhone composition.
          A pure-CSS device frame guarantees the live UI fits the screen
          perfectly with proper rounded corners — no PNG misalignment, no
          stray boxes. The whole device fades into the section at the bottom. */}
      <div
        className="relative mx-auto w-full max-w-[360px] sm:max-w-[400px]"
        style={{
          WebkitMaskImage:
            "linear-gradient(to bottom, hsl(0 0% 0%) 0%, hsl(0 0% 0%) 72%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, hsl(0 0% 0%) 0%, hsl(0 0% 0%) 72%, transparent 100%)",
        }}
      >
        {/* Outer device bezel — titanium-feeling dark frame */}
        <div
          className="relative aspect-[9/19.5] w-full p-[10px]"
          style={{
            borderRadius: "52px",
            background:
              "linear-gradient(145deg, hsl(0 0% 18%) 0%, hsl(0 0% 8%) 50%, hsl(0 0% 14%) 100%)",
            boxShadow:
              "0 50px 80px -30px hsl(0 0% 0% / 0.55), 0 25px 40px -20px hsl(0 0% 0% / 0.4), inset 0 0 0 1.5px hsl(0 0% 30% / 0.6), inset 0 1px 0 hsl(0 0% 60% / 0.25)",
          }}
        >
          {/* Inner screen — the live UI lives here, perfectly clipped to iPhone radius */}
          <div
            className="relative h-full w-full overflow-hidden"
            style={{
              borderRadius: "44px",
              background: palette.bg,
              boxShadow: "inset 0 0 0 1px hsl(0 0% 0% / 0.6)",
            }}
          >
            {/* Soft glow that subtly shifts as screens change */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-10 opacity-60 blur-3xl transition-all duration-1000"
              style={{
                background:
                  active === "voice"
                    ? `radial-gradient(40% 40% at 50% 70%, ${palette.olive}55, transparent 70%)`
                    : active === "remind"
                    ? `radial-gradient(40% 40% at 50% 30%, hsl(28 55% 55% / 0.35), transparent 70%)`
                    : active === "folders"
                    ? `radial-gradient(40% 40% at 50% 50%, hsl(200 40% 60% / 0.30), transparent 70%)`
                    : `radial-gradient(40% 40% at 50% 30%, ${palette.accent}33, transparent 70%)`,
              }}
            />

            <div className="relative h-full w-full text-left">
              {/* iOS-style status bar with Dynamic Island */}
              <div
                className="relative flex items-center justify-between px-7 pt-3 pb-1 text-[12px] font-semibold"
                style={{ color: palette.ink }}
              >
                <span>9:41</span>
                <span
                  aria-hidden
                  className="absolute left-1/2 top-2 h-7 w-24 -translate-x-1/2 rounded-full"
                  style={{
                    background: "hsl(0 0% 0%)",
                    boxShadow: "inset 0 0 0 1px hsl(0 0% 12%)",
                  }}
                />
                <span className="flex items-center gap-1 opacity-80">
                  <span className="inline-block h-2 w-3 rounded-[1px]" style={{ background: palette.ink }} />
                  <span className="inline-block h-2 w-3 rounded-[1px]" style={{ background: palette.ink }} />
                  <span className="inline-block h-2 w-4 rounded-[2px]" style={{ background: palette.ink }} />
                </span>
              </div>

              {/* Stacked screens — only one is visible/interactive at a time. */}
              <div className="relative h-[calc(100%-3rem)] overflow-hidden">
                <ScreenFrame id="feed" active={active} direction={direction}>
                  <FeedScreen palette={palette} />
                </ScreenFrame>
                <ScreenFrame id="voice" active={active} direction={direction}>
                  <VoiceScreen palette={palette} />
                </ScreenFrame>
                <ScreenFrame id="remind" active={active} direction={direction}>
                  <RemindScreen palette={palette} />
                </ScreenFrame>
                <ScreenFrame id="folders" active={active} direction={direction}>
                  <FoldersScreen palette={palette} />
                </ScreenFrame>
              </div>

              {/* Bottom tab bar */}
              <div
                className="absolute inset-x-0 bottom-0 flex items-center justify-around px-8 pt-2 pb-6"
                style={{
                  background: `${palette.bg}f0`,
                  borderTop: `1px solid ${palette.line}`,
                  backdropFilter: "blur(8px)",
                }}
              >
                <Folder
                  size={18}
                  style={{
                    color: active === "folders" || active === "feed" ? palette.ink : palette.inkFaint,
                    transition: "color 400ms",
                  }}
                />
                <Bell
                  size={18}
                  style={{
                    color: active === "remind" ? palette.ink : palette.inkFaint,
                    transition: "color 400ms",
                  }}
                />
                <Mic
                  size={18}
                  style={{
                    color: active === "voice" ? palette.ink : palette.inkFaint,
                    transition: "color 400ms",
                  }}
                />
              </div>

              {/* iOS home indicator */}
              <div
                aria-hidden
                className="absolute bottom-1.5 left-1/2 h-[5px] w-[110px] -translate-x-1/2 rounded-full"
                style={{ background: palette.ink, opacity: 0.85 }}
              />
            </div>
          </div>

          {/* Subtle side button + volume highlights for realism */}
          <span
            aria-hidden
            className="absolute right-[-2px] top-[28%] h-16 w-[3px] rounded-r-sm"
            style={{ background: "linear-gradient(to right, hsl(0 0% 22%), hsl(0 0% 8%))" }}
          />
          <span
            aria-hidden
            className="absolute left-[-2px] top-[22%] h-10 w-[3px] rounded-l-sm"
            style={{ background: "linear-gradient(to left, hsl(0 0% 22%), hsl(0 0% 8%))" }}
          />
          <span
            aria-hidden
            className="absolute left-[-2px] top-[33%] h-20 w-[3px] rounded-l-sm"
            style={{ background: "linear-gradient(to left, hsl(0 0% 22%), hsl(0 0% 8%))" }}
          />
        </div>
      </div>

      {/* Screen indicator pills below the device */}
      <div className="mt-6 flex items-center justify-center gap-2">
        {SCREENS.map((s) => {
          const isActive = s === active;
          return (
            <button
              key={s}
              type="button"
              onClick={() => goTo(s)}
              aria-label={`Show ${s} screen`}
              className="relative h-1.5 overflow-hidden rounded-full transition-all duration-500"
              style={{
                width: isActive ? 28 : 8,
                background: isActive ? `${palette.line}` : `${palette.line}80`,
              }}
            >
              {isActive && (
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${progress * 100}%`,
                    background: palette.ink,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Screen frame: per-screen entrance/exit motion ─────────────────────── */
function ScreenFrame({
  id,
  active,
  direction,
  children,
}: {
  id: ScreenId;
  active: ScreenId;
  direction: Direction;
  children: React.ReactNode;
}) {
  const visible = id === active;
  // The "exit" state animates to the inverse of the entrance — so when a
  // screen leaves while user is moving forward, it slides off the way the
  // next one will come from. Feels like a real navigation stack.
  const exitDirection: Direction = direction === "forward" ? "backward" : "forward";
  const transform = visible
    ? transformFor(id, "enter", direction)
    : transformFor(id, "exit", exitDirection);

  return (
    <div
      className="absolute inset-0 px-4 pt-4"
      style={{
        opacity: visible ? 1 : 0,
        transform,
        transition: `opacity ${FADE_MS}ms ${EASE_OUT_EXPO}, transform ${FADE_MS}ms ${EASE_OUT_EXPO}, filter ${FADE_MS}ms ease`,
        filter: visible ? "blur(0px)" : "blur(4px)",
        willChange: "transform, opacity, filter",
        pointerEvents: visible ? "auto" : "none",
        zIndex: visible ? 2 : 1,
      }}
      aria-hidden={!visible}
    >
      {children}
    </div>
  );
}

/* ── Header used by feed + folders ─────────────────────────────────────── */
function AppHeader({ palette, title }: { palette: Palette; title?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <img src={notiGlyph} alt="" width={18} height={18} style={{ width: 18, height: 18 }} />
        {title ? (
          <span className="font-display text-[15px] font-semibold" style={{ color: palette.ink }}>
            {title}
          </span>
        ) : (
          <NotiWordmark size="md" color={palette.ink} />
        )}
      </div>
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full"
        style={{ background: `${palette.line}80` }}
      >
        <Search size={13} style={{ color: palette.inkSoft }} />
      </div>
    </div>
  );
}

/* ── 1. Feed screen ────────────────────────────────────────────────────── */
function FeedScreen({ palette }: { palette: Palette }) {
  const folders = [
    { name: "All", active: true, dot: undefined as string | undefined },
    { name: "Personal", active: false, dot: palette.olive },
    { name: "Work", active: false, dot: "hsl(28 55% 55%)" },
    { name: "Ideas", active: false, dot: "hsl(200 40% 60%)" },
  ];

  return (
    <>
      <AppHeader palette={palette} />
      <div className="mb-3 flex gap-1.5 overflow-hidden">
        {folders.map((f, i) => (
          <div
            key={f.name}
            className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium"
            style={{
              background: f.active ? palette.ink : `${palette.line}80`,
              color: f.active ? palette.bg : palette.inkSoft,
              animation: `notiSlideUp 500ms ${i * 60}ms both`,
            }}
          >
            {f.dot && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: f.dot }} />}
            {f.name}
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {[
          {
            kind: "remind" as const,
            title: "Call mom",
            meta: "Today · 7:00 PM",
            pin: true,
          },
          {
            kind: "todo" as const,
            title: "Pitch deck — 3 ideas",
            meta: "Work",
            dot: "hsl(28 55% 55%)",
          },
          {
            kind: "done" as const,
            title: "Pick up dry cleaning",
          },
          {
            kind: "remind" as const,
            title: "Design sync",
            meta: "Tomorrow · 10:30 AM",
          },
          {
            kind: "todo" as const,
            title: "Book flight Tuesday",
            meta: "Window seat, evening departure",
            dot: "hsl(200 40% 60%)",
          },
        ].map((n, i) => (
          <div
            key={i}
            className="relative flex items-center gap-2.5 rounded-xl px-2.5 py-2"
            style={{
              background: palette.paper,
              border: `1px solid ${palette.line}`,
              boxShadow: n.kind === "remind" && i === 0 ? `inset 2px 0 0 0 ${palette.olive}` : undefined,
              opacity: n.kind === "done" ? 0.6 : 1,
              animation: `notiSlideUp 550ms ${120 + i * 70}ms both`,
            }}
          >
            {n.kind === "remind" ? (
              <BellRing size={14} style={{ color: palette.olive }} />
            ) : n.kind === "done" ? (
              <div
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
                style={{ background: palette.olive }}
              >
                <Check size={9} style={{ color: palette.ink }} strokeWidth={3} />
              </div>
            ) : (
              <CircleDashed size={14} style={{ color: palette.inkFaint }} />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span
                  className="truncate text-[11px] font-medium"
                  style={{
                    color: n.kind === "done" ? palette.inkSoft : palette.ink,
                    textDecoration: n.kind === "done" ? "line-through" : undefined,
                  }}
                >
                  {n.title}
                </span>
                {n.pin && <Pin size={9} style={{ color: palette.inkFaint }} className="ml-auto" />}
              </div>
              {n.meta && (
                <div
                  className="mt-0.5 flex items-center gap-1 text-[9px]"
                  style={{ color: n.kind === "remind" ? palette.olive : palette.inkFaint }}
                >
                  {n.dot && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: n.dot }} />}
                  {n.meta}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div
        className="absolute right-4 bottom-16 flex h-10 w-10 items-center justify-center rounded-full"
        style={{
          background: palette.ink,
          color: palette.bg,
          boxShadow: `0 10px 24px -8px hsl(60 30% 4% / 0.6)`,
          animation: `notiPop 500ms 600ms both`,
        }}
      >
        <Plus size={18} />
      </div>
    </>
  );
}

/* ── 2. Voice capture screen ───────────────────────────────────────────── */
function VoiceScreen({ palette }: { palette: Palette }) {
  return (
    <>
      <AppHeader palette={palette} title="Voice capture" />

      {/* Live transcript bubble */}
      <div
        className="mt-2 rounded-2xl p-3"
        style={{
          background: palette.paper,
          border: `1px solid ${palette.line}`,
          animation: `notiSlideUp 500ms 80ms both`,
        }}
      >
        <div className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-wider" style={{ color: palette.olive }}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: palette.olive, animation: `notiPulse 1.4s infinite` }} />
          Listening
        </div>
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: palette.ink }}>
          <TypedText
            text="Remind me to send the contract to Alex on Thursday morning before the design review…"
            speed={26}
          />
        </p>
      </div>

      {/* AI-suggested cleanup chip */}
      <div
        className="mt-3 flex items-start gap-2 rounded-xl p-2.5"
        style={{
          background: `${palette.accent}1a`,
          border: `1px solid ${palette.accent}33`,
          animation: `notiSlideUp 500ms 1400ms both`,
        }}
      >
        <Sparkles size={12} style={{ color: palette.accent, marginTop: 2 }} />
        <div className="min-w-0">
          <div className="text-[10px] font-medium" style={{ color: palette.accent }}>
            Suggested
          </div>
          <div className="mt-0.5 text-[10px]" style={{ color: palette.inkSoft }}>
            Set reminder · Thu 9:00 AM · Tag #work
          </div>
        </div>
      </div>

      {/* Waveform */}
      <div className="mt-6 flex items-end justify-center gap-[3px]" style={{ height: 64 }}>
        {Array.from({ length: 26 }).map((_, i) => (
          <span
            key={i}
            className="block w-[3px] rounded-full"
            style={{
              background: palette.olive,
              animation: `notiBar 900ms ${i * 50}ms ease-in-out infinite`,
              transformOrigin: "bottom",
              height: `${20 + (i % 5) * 8}%`,
            }}
          />
        ))}
      </div>

      {/* Mic button */}
      <div className="mt-6 flex flex-col items-center gap-2">
        <div className="relative">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background: palette.olive,
              animation: `notiRing 1.6s ease-out infinite`,
              opacity: 0.5,
            }}
          />
          <div
            className="relative flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: palette.olive, color: palette.ink }}
          >
            <Mic size={22} />
          </div>
        </div>
        <span className="text-[10px]" style={{ color: palette.inkFaint }}>
          Release to save
        </span>
      </div>
    </>
  );
}

/* ── 3. Reminder picker screen ─────────────────────────────────────────── */
function RemindScreen({ palette }: { palette: Palette }) {
  return (
    <>
      <AppHeader palette={palette} title="Schedule" />

      {/* The note being scheduled */}
      <div
        className="rounded-xl p-3"
        style={{
          background: palette.paper,
          border: `1px solid ${palette.line}`,
          animation: `notiSlideUp 500ms 60ms both`,
        }}
      >
        <div className="text-[9px] font-medium uppercase tracking-wider" style={{ color: palette.inkFaint }}>
          Reminding you about
        </div>
        <div className="mt-1 text-[12px] font-medium" style={{ color: palette.ink }}>
          Renew car insurance
        </div>
      </div>

      {/* Quick presets */}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {[
          { label: "In 1 hour", sub: "5:41 PM" },
          { label: "Tonight", sub: "9:00 PM" },
          { label: "Tomorrow", sub: "9:00 AM" },
          { label: "This weekend", sub: "Sat · 10:00" },
        ].map((p, i) => (
          <div
            key={p.label}
            className="rounded-xl px-2.5 py-2"
            style={{
              background: palette.paper,
              border: `1px solid ${palette.line}`,
              animation: `notiSlideUp 500ms ${160 + i * 70}ms both`,
            }}
          >
            <div className="text-[10px] font-medium" style={{ color: palette.ink }}>
              {p.label}
            </div>
            <div className="text-[9px]" style={{ color: palette.inkFaint }}>
              {p.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Selected day */}
      <div
        className="mt-3 rounded-xl p-3"
        style={{
          background: `${palette.olive}26`,
          border: `1px solid ${palette.olive}66`,
          animation: `notiSlideUp 500ms 520ms both`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock size={14} style={{ color: palette.olive }} />
            <span className="text-[11px] font-medium" style={{ color: palette.ink }}>
              Thursday, Apr 30
            </span>
          </div>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: palette.olive }}>
            8:30 AM
          </span>
        </div>
        {/* Mini hour rail */}
        <div className="mt-2 flex gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="block h-1 flex-1 rounded-full"
              style={{
                background: i === 4 ? palette.olive : `${palette.olive}40`,
                animation: `notiSlideUp 400ms ${600 + i * 30}ms both`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Repeat row */}
      <div
        className="mt-3 flex items-center justify-between rounded-xl px-3 py-2.5"
        style={{
          background: palette.paper,
          border: `1px solid ${palette.line}`,
          animation: `notiSlideUp 500ms 1000ms both`,
        }}
      >
        <div className="flex items-center gap-2">
          <BellRing size={13} style={{ color: palette.inkSoft }} />
          <span className="text-[11px]" style={{ color: palette.ink }}>
            Repeat
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px]" style={{ color: palette.inkFaint }}>
          Yearly <ChevronRight size={11} />
        </div>
      </div>

      {/* Confirm */}
      <div
        className="absolute inset-x-4 bottom-16 rounded-2xl py-2.5 text-center text-[12px] font-medium"
        style={{
          background: palette.ink,
          color: palette.bg,
          animation: `notiPop 500ms 1300ms both`,
        }}
      >
        Set reminder
      </div>
    </>
  );
}

/* ── 4. Folders screen ─────────────────────────────────────────────────── */
function FoldersScreen({ palette }: { palette: Palette }) {
  const folders = [
    { name: "Personal", count: 24, color: palette.olive },
    { name: "Work", count: 41, color: "hsl(28 55% 55%)" },
    { name: "Ideas", count: 18, color: "hsl(200 40% 60%)" },
    { name: "Travel", count: 9, color: "hsl(340 45% 60%)" },
    { name: "Reading list", count: 31, color: "hsl(150 30% 55%)" },
    { name: "Recipes", count: 12, color: "hsl(48 60% 58%)" },
  ];

  return (
    <>
      <AppHeader palette={palette} title="Folders" />

      <div className="grid grid-cols-2 gap-2">
        {folders.map((f, i) => (
          <div
            key={f.name}
            className="rounded-2xl p-3"
            style={{
              background: palette.paper,
              border: `1px solid ${palette.line}`,
              animation: `notiSlideUp 500ms ${80 + i * 70}ms both`,
            }}
          >
            <div
              className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: `${f.color}33`, color: f.color }}
            >
              <Folder size={14} />
            </div>
            <div className="text-[11px] font-medium" style={{ color: palette.ink }}>
              {f.name}
            </div>
            <div className="text-[9px]" style={{ color: palette.inkFaint }}>
              {f.count} notes
            </div>
          </div>
        ))}
      </div>

      <div
        className="absolute inset-x-4 bottom-16 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[12px] font-medium"
        style={{
          background: palette.ink,
          color: palette.bg,
          animation: `notiPop 500ms 700ms both`,
        }}
      >
        <Plus size={14} /> New folder
      </div>
    </>
  );
}

/* ── Typing helper ─────────────────────────────────────────────────────── */
function TypedText({ text, speed = 30 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <>
      {text.slice(0, n)}
      <span className="inline-block w-[1px] -mb-[1px]" style={{ height: "0.9em", background: "currentColor", opacity: n < text.length ? 0.7 : 0 }} />
    </>
  );
}
