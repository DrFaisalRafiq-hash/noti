import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import NotiWordmark from "@/components/NotiWordmark";
import AnimatedPhoneShowcase from "@/components/AnimatedPhoneShowcase";
import QuickNoteTeaser from "@/components/landing/QuickNoteTeaser";
import notiGlyph from "@/assets/noti-glyph.png";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import FeaturePreview from "@/components/landing/FeaturePreview";
import PodcastShowcase from "@/components/landing/PodcastShowcase";
import {
  Apple,
  ArrowRight,
  Bell,
  BellRing,
  Brain,
  CalendarClock,
  Check,
  CheckSquare,
  Chrome,
  CircleDashed,
  Copy,
  Download,
  Folder,
  ListChecks,
  Mic,
  PenTool,
  Pin,
  Plus,
  Search,
  Share2,
  Shield,
  Smartphone,
  Sparkles,
  Sun,
  Wand2,
  Zap,
} from "lucide-react";

// Brand kit — sampled directly from the Noti icon artwork.
// Forest deep #2c2c25 · Paper #3a3a32 · Sage #a4a89a · Olive #5a5a3e
const FOREST_BG = "hsl(60 8% 12%)";
const FOREST_DEEP = "hsl(60 8% 9%)";
const FOREST_PAPER = "hsl(60 8% 17%)";
const FOREST_INK = "hsl(78 12% 92%)";
const FOREST_INK_SOFT = "hsl(78 6% 72%)";
const FOREST_INK_FAINT = "hsl(78 5% 54%)";
const FOREST_LINE = "hsl(60 10% 24%)";
const FOREST_ACCENT = "hsl(78 7% 70%)";   // sage — letterform tone
const FOREST_OLIVE = "hsl(60 19% 36%)";   // olive — cap accent

type FeaturePreviewKind =
  | "notify"
  | "tasks"
  | "voice"
  | "stylus"
  | "folders"
  | "private"
  | "ai-summary"
  | "install"
  | "ai-breakdown"
  | "ai-digest";

const features: {
  icon: typeof Bell;
  title: string;
  body: string;
  preview: FeaturePreviewKind;
  aiBadge?: boolean;
}[] = [
  {
    icon: Bell,
    title: "Notes that notify",
    body: "Every note can become a gentle reminder. Schedule, snooze, repeat — without leaving the keyboard.",
    preview: "notify",
  },
  {
    icon: ListChecks,
    title: "To-do lists & tasks",
    body: "A dedicated Tasks tab with quick-add, priority, due dates, and subtask checklists. Open and Completed kept neatly apart.",
    preview: "tasks",
  },
  {
    icon: Mic,
    title: "Voice-first capture",
    body: "Hold to record, release to transcribe. Your voice memos become searchable text instantly.",
    preview: "voice",
  },
  {
    icon: PenTool,
    title: "Apple Pencil & stylus notes",
    body: "Built for handwritten note-taking, not doodles. Write naturally on iPad or Android tablets and Noti converts ink to clean, searchable text — palm rejection and pressure-aware strokes included.",
    preview: "stylus",
  },
  {
    icon: Folder,
    title: "Folders that fold",
    body: "Drag, nest, and color-code. A quiet hierarchy that scales from 5 notes to 5,000.",
    preview: "folders",
  },
  {
    icon: Shield,
    title: "Private by default",
    body: "Lock screen with biometric unlock. Your thoughts stay yours, on your device and your account.",
    preview: "private",
  },
  {
    icon: Sparkles,
    title: "Quietly intelligent",
    body: "Summaries, smart titles, and context-aware suggestions powered by on-demand AI.",
    preview: "ai-summary",
    aiBadge: true,
  },
  {
    icon: Wand2,
    title: "AI task breakdown",
    body: "Type a goal, get a plan. Noti turns 'Launch newsletter' into ordered subtasks with priorities and due dates.",
    preview: "ai-breakdown",
    aiBadge: true,
  },
  {
    icon: Sun,
    title: "AI daily digest",
    body: "Each morning Noti reads your notes and tasks and writes a one-glance brief: what's due, what shifted, what to focus on.",
    preview: "ai-digest",
    aiBadge: true,
  },
  {
    icon: Smartphone,
    title: "Installs like an app",
    body: "Add Noti to your home screen on iOS or Android. Full-screen, offline-friendly, no app store.",
    preview: "install",
  },
];

const steps = [
  {
    n: "01",
    title: "Capture",
    body: "Type, dictate, or paste. Noti accepts whatever shape your thought arrives in.",
  },
  {
    n: "02",
    title: "Organize",
    body: "Folders, pins, and recents keep what matters within a single tap.",
  },
  {
    n: "03",
    title: "Plan",
    body: "Promote any note to a task. Add subtasks, set a priority, give it a due date — then check things off.",
  },
  {
    n: "04",
    title: "Remind",
    body: "Turn any note or task into a notification. Wake up to your own words, on your own schedule.",
  },
];

const faqs = [
  {
    q: "Is Noti free?",
    a: "Yes — sign up free, use Noti free, forever. Notes, folders, reminders, voice capture, sync, and biometric unlock are all included at no cost. AI features are pay-what-you-want: top up your wallet with as little as $5 whenever you want a little extra magic, and only spend what you choose.",
  },
  {
    q: "Where is my data stored?",
    a: "In your private Noti account, encrypted in transit and at rest. Only you can read it.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. Open noti-time.com on your phone and tap 'Add to Home Screen' to get the full app experience.",
  },
  {
    q: "Does it work offline?",
    a: "Reading and capture work offline once installed; sync resumes the moment you're back online.",
  },
];

export default function Landing() {
  // When opened from an installed PWA (home-screen icon, A2HS), skip the
  // marketing page entirely and jump straight into the app. Detects both
  // standard `display-mode: standalone` and the iOS-specific
  // `navigator.standalone` flag.
  const isStandalone = (() => {
    if (typeof window === "undefined") return false;
    try {
      return (
        window.matchMedia?.("(display-mode: standalone)").matches ||
        window.matchMedia?.("(display-mode: fullscreen)").matches ||
        window.matchMedia?.("(display-mode: minimal-ui)").matches ||
        // iOS Safari home-screen flag
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window.navigator as any).standalone === true
      );
    } catch {
      return false;
    }
  })();
  if (isStandalone) {
    return <Navigate to="/app" replace />;
  }

  const SHARE_URL = "https://noti-time.com";
  const SHARE_TEXT =
    "Noti — a single quiet place to capture thoughts. Notes that notify.";

  const downloadExtension = () => {
    fetch("/noti-extension.zip")
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "noti-extension.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      })
      .catch((err) => alert(err.message));
  };

  const [copied, setCopied] = useState(false);
  const [activePreview, setActivePreview] = useState<FeaturePreviewKind | null>(null);
  const activeFeature = features.find((f) => f.preview === activePreview) ?? null;
  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked */
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Noti",
          text: SHARE_TEXT,
          url: SHARE_URL,
        });
        return;
      } catch {
        /* user cancelled */
      }
    }
    copyShareLink();
  };

  return (
    <div
      className="min-h-dvh w-full"
      style={{ background: FOREST_BG, color: FOREST_INK }}
    >
      {/* NAV */}
      <header
        className="sticky top-0 z-30 backdrop-blur-md"
        style={{
          background: `${FOREST_BG}cc`,
          borderBottom: `1px solid ${FOREST_LINE}`,
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <nav
          className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"
          style={{
            paddingLeft: "calc(1.5rem + env(safe-area-inset-left))",
            paddingRight: "calc(1.5rem + env(safe-area-inset-right))",
          }}
        >
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
            <img src={notiGlyph} alt="" width={28} height={28} style={{ width: 28, height: 28 }} />
            <NotiWordmark size="md" color={FOREST_INK} />
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm" style={{ color: FOREST_INK_SOFT }}>
              Features
            </a>
            <a href="#how" className="text-sm" style={{ color: FOREST_INK_SOFT }}>
              How it works
            </a>
            <a href="#pricing" className="text-sm" style={{ color: FOREST_INK_SOFT }}>
              Pricing
            </a>
            <a href="#faq" className="text-sm" style={{ color: FOREST_INK_SOFT }}>
              FAQ
            </a>
            <Link to="/fans" className="text-sm" style={{ color: FOREST_INK_SOFT }}>
              Fans
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="hidden sm:inline-flex text-sm transition-opacity hover:opacity-90"
              style={{ color: FOREST_INK_SOFT }}
            >
              Sign in
            </Link>
            <Link
              to="/auth?mode=signup"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: FOREST_INK, color: FOREST_BG }}
            >
              Get started <ArrowRight size={14} />
            </Link>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(60% 50% at 50% 0%, ${FOREST_ACCENT}22 0%, transparent 70%)`,
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 pt-24 pb-20 text-center md:pt-32 md:pb-28">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: `${FOREST_ACCENT}1a`,
              color: FOREST_ACCENT,
              border: `1px solid ${FOREST_ACCENT}33`,
            }}
          >
            <Zap size={12} /> Free to sign up · Free to use · AI on your terms
          </span>
          <h1
            className="font-display mx-auto mt-6 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            The notebook that
            <br />
            <span style={{ color: FOREST_OLIVE }}>taps you on the shoulder.</span>
          </h1>
          <p
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed"
            style={{ color: FOREST_INK_SOFT }}
          >
            Noti turns your notes into notifications. Capture by voice or text,
            organize with quiet calm, and let your thoughts come back exactly
            when you need them.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-medium transition-transform hover:-translate-y-0.5"
              style={{ background: FOREST_INK, color: FOREST_BG }}
            >
              Open the app <ArrowRight size={16} />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-medium"
              style={{
                border: `1px solid ${FOREST_LINE}`,
                color: FOREST_INK,
              }}
            >
              See features
            </a>
          </div>

          {/* Interactive Quick-draft teaser — visitors can drag the corner
              tab to summon the same metaball Quick-draft sheet that lives in
              the app. Self-demos on a loop until touched. */}
          <QuickNoteTeaser
            palette={{
              bg: FOREST_BG,
              paper: FOREST_PAPER,
              ink: FOREST_INK,
              inkSoft: FOREST_INK_SOFT,
              inkFaint: FOREST_INK_FAINT,
              line: FOREST_LINE,
              accent: FOREST_ACCENT,
              olive: FOREST_OLIVE,
            }}
          />

          {/* Device mock — auto-cycles through 4 real Noti screens */}
          <AnimatedPhoneShowcase
            palette={{
              bg: FOREST_BG,
              deep: FOREST_DEEP,
              paper: FOREST_PAPER,
              ink: FOREST_INK,
              inkSoft: FOREST_INK_SOFT,
              inkFaint: FOREST_INK_FAINT,
              line: FOREST_LINE,
              accent: FOREST_ACCENT,
              olive: FOREST_OLIVE,
            }}
          />
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="features"
        className="border-t py-24"
        style={{ borderColor: FOREST_LINE }}
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2
              className="font-display text-4xl font-semibold tracking-tight md:text-5xl"
              style={{ letterSpacing: "-0.02em" }}
            >
              Everything a note should do.
            </h2>
            <p
              className="mt-4 text-lg"
              style={{ color: FOREST_INK_SOFT }}
            >
              Built for people who think in fragments and live by reminders.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <button
                key={f.title}
                type="button"
                onClick={() => setActivePreview(f.preview)}
                className="group relative rounded-2xl p-6 text-left transition-all duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2"
                style={{
                  background: "hsl(85 14% 18%)",
                  border: `1px solid ${FOREST_LINE}`,
                  ["--tw-ring-color" as any]: FOREST_ACCENT,
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "hsl(85 18% 11%)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "hsl(85 14% 18%)";
                }}
              >
                {f.aiBadge && (
                  <span
                    className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                    style={{
                      background: `${FOREST_OLIVE}33`,
                      color: FOREST_INK,
                      border: `1px solid ${FOREST_OLIVE}`,
                    }}
                  >
                    <Sparkles size={10} /> AI
                  </span>
                )}
                <div
                  className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{
                    background: `${FOREST_ACCENT}1a`,
                    color: FOREST_ACCENT,
                  }}
                >
                  <f.icon size={18} />
                </div>
                <h3
                  className="font-display text-xl font-semibold"
                  style={{ color: FOREST_INK }}
                >
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: FOREST_INK_SOFT }}>
                  {f.body}
                </p>
                <span
                  className="mt-4 inline-flex items-center gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: FOREST_ACCENT }}
                >
                  See it in action <ArrowRight size={12} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SHOWCASE — interactive podcast + screenplay + studio recorder */}
      <PodcastShowcase
        palette={{
          bg: FOREST_BG,
          paper: FOREST_PAPER,
          ink: FOREST_INK,
          inkSoft: FOREST_INK_SOFT,
          inkFaint: FOREST_INK_FAINT,
          line: FOREST_LINE,
          accent: FOREST_ACCENT,
          olive: FOREST_OLIVE,
        }}
      />

      <section
        id="how"
        className="border-t py-24"
        style={{ borderColor: FOREST_LINE }}
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2
              className="font-display text-4xl font-semibold tracking-tight md:text-5xl"
              style={{ letterSpacing: "-0.02em" }}
            >
              Three steps. Zero friction.
            </h2>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n}>
                <div
                  className="font-display text-5xl font-semibold"
                  style={{ color: FOREST_ACCENT, letterSpacing: "-0.04em" }}
                >
                  {s.n}
                </div>
                <h3
                  className="font-display mt-3 text-2xl font-semibold"
                  style={{ color: FOREST_INK }}
                >
                  {s.title}
                </h3>
                <p className="mt-2 text-base leading-relaxed" style={{ color: FOREST_INK_SOFT }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section
        id="pricing"
        className="border-t py-24"
        style={{ borderColor: FOREST_LINE }}
      >
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2
            className="font-display text-4xl font-semibold tracking-tight md:text-5xl"
            style={{ letterSpacing: "-0.02em" }}
          >
            Free to sign up. Free to use.
            <br />
            <span style={{ color: FOREST_OLIVE }}>AI on demand, on your terms.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: FOREST_INK_SOFT }}>
            No subscription. No paywall. Capture, organize, and remind for free —
            forever. When you want a little AI magic, top up your wallet with
            whatever feels right. Spend a dollar or spend twenty. You're in charge.
          </p>

          <div className="mx-auto mt-12 grid max-w-3xl gap-5 md:grid-cols-2">
            {/* Free plan */}
            <div
              className="rounded-3xl p-8 text-left"
              style={{
                background: FOREST_DEEP,
                border: `1px solid ${FOREST_LINE}`,
              }}
            >
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: `${FOREST_ACCENT}1a`, color: FOREST_ACCENT }}
              >
                Always free
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-5xl font-semibold" style={{ color: FOREST_INK }}>
                  $0
                </span>
                <span style={{ color: FOREST_INK_FAINT }}>/ forever</span>
              </div>
              <ul className="mt-6 space-y-3">
                {[
                  "Unlimited notes & folders",
                  "To-do lists, subtasks & priorities",
                  "Voice capture & transcription",
                  "Reminders & lock screen",
                  "Cross-device sync",
                  "Biometric unlock",
                ].map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm" style={{ color: FOREST_INK_SOFT }}>
                    <Check size={16} style={{ color: FOREST_ACCENT, marginTop: 2 }} />
                    {it}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth?mode=signup"
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
                style={{ background: FOREST_INK, color: FOREST_BG }}
              >
                Sign up free <ArrowRight size={14} />
              </Link>
            </div>

            {/* Pay-what-you-want AI */}
            <div
              className="rounded-3xl p-8 text-left"
              style={{
                background: `linear-gradient(160deg, ${FOREST_PAPER} 0%, ${FOREST_DEEP} 100%)`,
                border: `1px solid ${FOREST_OLIVE}66`,
              }}
            >
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: `${FOREST_OLIVE}33`, color: FOREST_OLIVE }}
              >
                <Sparkles size={10} /> AI on demand
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-5xl font-semibold" style={{ color: FOREST_INK }}>
                  Pay
                </span>
                <span style={{ color: FOREST_INK_FAINT }}>what you want</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: FOREST_INK_SOFT }}>
                Top up your wallet from <strong style={{ color: FOREST_INK }}>$5</strong>,
                <strong style={{ color: FOREST_INK }}> $20</strong>, or
                <strong style={{ color: FOREST_INK }}> $50</strong> — bigger packs
                earn up to <strong style={{ color: FOREST_INK }}>20% bonus credits</strong>.
                Use them only when you want them.
              </p>
              <ul className="mt-5 space-y-3">
                {[
                  "Smart titles & summaries",
                  "Voice → searchable text",
                  "Context-aware suggestions",
                  "AI image generation",
                  "Never auto-charged. Never expires.",
                ].map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm" style={{ color: FOREST_INK_SOFT }}>
                    <Check size={16} style={{ color: FOREST_OLIVE, marginTop: 2 }} />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mx-auto mt-8 max-w-xl text-xs" style={{ color: FOREST_INK_FAINT }}>
            No credit card to sign up. No subscription. No surprises.
            Top-ups are optional and only used when you choose to run an AI action.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="border-t py-24"
        style={{ borderColor: FOREST_LINE }}
      >
        <div className="mx-auto max-w-3xl px-6">
          <h2
            className="font-display text-center text-4xl font-semibold tracking-tight md:text-5xl"
            style={{ letterSpacing: "-0.02em" }}
          >
            Questions, answered.
          </h2>
          <div className="mt-12 divide-y" style={{ borderColor: FOREST_LINE }}>
            {faqs.map((f) => (
              <details
                key={f.q}
                className="group py-5"
                style={{ borderColor: FOREST_LINE }}
              >
                <summary
                  className="flex cursor-pointer items-center justify-between text-lg font-medium"
                  style={{ color: FOREST_INK }}
                >
                  {f.q}
                  <span
                    className="ml-4 transition-transform group-open:rotate-45"
                    style={{ color: FOREST_INK_FAINT }}
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-base leading-relaxed" style={{ color: FOREST_INK_SOFT }}>
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* GET NOTI — platforms */}
      <section
        id="download"
        className="border-t py-24"
        style={{ borderColor: FOREST_LINE }}
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2
              className="font-display text-4xl font-semibold tracking-tight md:text-5xl"
              style={{ letterSpacing: "-0.02em", color: FOREST_INK }}
            >
              Get Noti.
            </h2>
            <p
              className="mx-auto mt-4 max-w-xl text-base md:text-lg"
              style={{ color: FOREST_INK_SOFT }}
            >
              One quiet account, everywhere you think.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Web app — live */}
            <div
              className="flex flex-col rounded-2xl border p-6"
              style={{ borderColor: FOREST_LINE, background: FOREST_PAPER }}
            >
              <div className="flex items-center justify-between">
                <Smartphone size={22} style={{ color: FOREST_ACCENT }} />
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                  style={{ background: FOREST_ACCENT, color: FOREST_DEEP }}
                >
                  Live
                </span>
              </div>
              <h3
                className="mt-4 font-display text-xl font-semibold"
                style={{ color: FOREST_INK }}
              >
                Web · iPhone · iPad
              </h3>
              <p
                className="mt-2 flex-1 text-sm"
                style={{ color: FOREST_INK_SOFT }}
              >
                Install to your home screen — works offline, feels native.
              </p>
              <Link
                to="/app"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
                style={{ background: FOREST_ACCENT, color: FOREST_DEEP }}
              >
                Open Noti <ArrowRight size={14} />
              </Link>
            </div>

            {/* Chrome extension — live */}
            <div
              className="flex flex-col rounded-2xl border p-6"
              style={{ borderColor: FOREST_LINE, background: FOREST_PAPER }}
            >
              <div className="flex items-center justify-between">
                <Chrome size={22} style={{ color: FOREST_ACCENT }} />
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                  style={{ background: FOREST_ACCENT, color: FOREST_DEEP }}
                >
                  Beta
                </span>
              </div>
              <h3
                className="mt-4 font-display text-xl font-semibold"
                style={{ color: FOREST_INK }}
              >
                Chrome extension
              </h3>
              <p
                className="mt-2 flex-1 text-sm"
                style={{ color: FOREST_INK_SOFT }}
              >
                Right-click any page or selection — saved straight to Noti.
              </p>
              <button
                type="button"
                onClick={downloadExtension}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
                style={{ background: FOREST_ACCENT, color: FOREST_DEEP }}
              >
                <Download size={14} /> Download
              </button>
              <p
                className="mt-2 text-center text-[11px]"
                style={{ color: FOREST_INK_FAINT }}
              >
                Chrome · Edge · Brave · Arc
              </p>
            </div>

            {/* iOS — coming soon */}
            <div
              className="flex flex-col rounded-2xl border p-6"
              style={{
                borderColor: FOREST_LINE,
                background: FOREST_PAPER,
                opacity: 0.85,
              }}
            >
              <div className="flex items-center justify-between">
                <Apple size={22} style={{ color: FOREST_INK_SOFT }} />
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider"
                  style={{
                    borderColor: FOREST_LINE,
                    color: FOREST_INK_FAINT,
                  }}
                >
                  Soon
                </span>
              </div>
              <h3
                className="mt-4 font-display text-xl font-semibold"
                style={{ color: FOREST_INK }}
              >
                App Store
              </h3>
              <p
                className="mt-2 flex-1 text-sm"
                style={{ color: FOREST_INK_SOFT }}
              >
                Native iPhone & iPad app coming soon.
              </p>
              <button
                type="button"
                disabled
                className="mt-5 inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium"
                style={{
                  borderColor: FOREST_LINE,
                  color: FOREST_INK_FAINT,
                  background: "transparent",
                }}
              >
                Coming soon
              </button>
              <p
                className="mt-2 text-center text-[11px]"
                style={{ color: FOREST_INK_FAINT }}
              >
                Install the web app today
              </p>
            </div>

            {/* Android — coming soon */}
            <div
              className="flex flex-col rounded-2xl border p-6"
              style={{
                borderColor: FOREST_LINE,
                background: FOREST_PAPER,
                opacity: 0.85,
              }}
            >
              <div className="flex items-center justify-between">
                <Smartphone size={22} style={{ color: FOREST_INK_SOFT }} />
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider"
                  style={{
                    borderColor: FOREST_LINE,
                    color: FOREST_INK_FAINT,
                  }}
                >
                  Soon
                </span>
              </div>
              <h3
                className="mt-4 font-display text-xl font-semibold"
                style={{ color: FOREST_INK }}
              >
                Google Play
              </h3>
              <p
                className="mt-2 flex-1 text-sm"
                style={{ color: FOREST_INK_SOFT }}
              >
                Native Android app coming soon.
              </p>
              <button
                type="button"
                disabled
                className="mt-5 inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium"
                style={{
                  borderColor: FOREST_LINE,
                  color: FOREST_INK_FAINT,
                  background: "transparent",
                }}
              >
                Coming soon
              </button>
              <p
                className="mt-2 text-center text-[11px]"
                style={{ color: FOREST_INK_FAINT }}
              >
                Install the web app today
              </p>
            </div>
          </div>

          {/* Chrome install steps — collapsed under the cards */}
          <details
            className="mx-auto mt-8 max-w-2xl rounded-xl border px-5 py-3 text-sm"
            style={{ borderColor: FOREST_LINE, color: FOREST_INK_SOFT }}
          >
            <summary
              className="cursor-pointer font-medium"
              style={{ color: FOREST_INK }}
            >
              How to install the Chrome extension
            </summary>
            <ol className="mt-3 space-y-2">
              <li>
                <span style={{ color: FOREST_INK }}>1.</span> Download & unzip{" "}
                <code style={{ color: FOREST_INK }}>noti-extension.zip</code>.
              </li>
              <li>
                <span style={{ color: FOREST_INK }}>2.</span> Open{" "}
                <code style={{ color: FOREST_INK }}>chrome://extensions</code>{" "}
                in your browser.
              </li>
              <li>
                <span style={{ color: FOREST_INK }}>3.</span> Toggle{" "}
                <span style={{ color: FOREST_INK }}>Developer mode</span> on
                (top-right).
              </li>
              <li>
                <span style={{ color: FOREST_INK }}>4.</span> Click{" "}
                <span style={{ color: FOREST_INK }}>Load unpacked</span> and
                pick the unzipped folder.
              </li>
              <li>
                <span style={{ color: FOREST_INK }}>5.</span> Pin Noti to your
                toolbar and sign in.
              </li>
            </ol>
          </details>
        </div>
      </section>

      {/* SHARE WITH FRIENDS */}
      <section
        id="share"
        className="border-t py-24"
        style={{ borderColor: FOREST_LINE }}
      >
        <div className="mx-auto max-w-5xl px-6">
          <div
            className="overflow-hidden rounded-3xl border"
            style={{ borderColor: FOREST_LINE, background: FOREST_PAPER }}
          >
            <div className="grid gap-0 md:grid-cols-[1.2fr,1fr]">
              <div className="p-8 md:p-12">
                <div
                  className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
                  style={{
                    borderColor: FOREST_LINE,
                    color: FOREST_INK_SOFT,
                  }}
                >
                  <Share2 size={14} /> Share Noti
                </div>
                <h2
                  className="font-display text-3xl font-semibold tracking-tight md:text-4xl"
                  style={{ letterSpacing: "-0.02em", color: FOREST_INK }}
                >
                  Tell a friend who keeps forgetting things.
                </h2>
                <p
                  className="mt-4 text-base"
                  style={{ color: FOREST_INK_SOFT }}
                >
                  Scan the code, copy the link, or share it straight from your
                  phone.
                </p>

                <div
                  className="mt-6 flex items-center gap-3 rounded-full border px-4 py-2.5"
                  style={{
                    borderColor: FOREST_LINE,
                    background: FOREST_DEEP,
                  }}
                >
                  <span
                    className="flex-1 truncate font-mono text-sm"
                    style={{ color: FOREST_INK }}
                  >
                    {SHARE_URL.replace(/^https?:\/\//, "")}
                  </span>
                  <button
                    type="button"
                    onClick={copyShareLink}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-opacity"
                    style={{
                      background: copied ? FOREST_ACCENT : "transparent",
                      color: copied ? FOREST_DEEP : FOREST_INK_SOFT,
                      border: copied ? "none" : `1px solid ${FOREST_LINE}`,
                    }}
                  >
                    {copied ? (
                      <>
                        <Check size={12} /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copy
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={shareNative}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
                    style={{ background: FOREST_ACCENT, color: FOREST_DEEP }}
                  >
                    <Share2 size={14} /> Share
                  </button>
                  <a
                    href={`sms:&body=${encodeURIComponent(`${SHARE_TEXT} ${SHARE_URL}`)}`}
                    className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium"
                    style={{
                      borderColor: FOREST_LINE,
                      color: FOREST_INK,
                    }}
                  >
                    Text
                  </a>
                  <a
                    href={`mailto:?subject=${encodeURIComponent("You should try Noti")}&body=${encodeURIComponent(`${SHARE_TEXT}\n\n${SHARE_URL}`)}`}
                    className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium"
                    style={{
                      borderColor: FOREST_LINE,
                      color: FOREST_INK,
                    }}
                  >
                    Email
                  </a>
                </div>
              </div>

              <div
                className="flex flex-col items-center justify-center gap-4 p-8 md:p-12"
                style={{ background: FOREST_DEEP }}
              >
                <div className="flex items-center gap-2 opacity-90">
                  <img src={notiGlyph} alt="" width={20} height={20} style={{ width: 20, height: 20 }} />
                  <NotiWordmark size="sm" color={FOREST_INK} />
                </div>
                <div
                  className="rounded-2xl p-5 shadow-lg"
                  style={{ background: "#ffffff" }}
                >
                  <QRCodeSVG
                    value={SHARE_URL}
                    size={180}
                    level="H"
                    bgColor="#ffffff"
                    fgColor="#1a1a18"
                    marginSize={0}
                    imageSettings={{
                      src: notiGlyph,
                      height: 36,
                      width: 36,
                      excavate: true,
                    }}
                  />
                </div>
                <p
                  className="text-center text-xs"
                  style={{ color: FOREST_INK_FAINT }}
                >
                  Point your camera at the code
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t py-24" style={{ borderColor: FOREST_LINE }}>
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2
            className="font-display text-4xl font-semibold tracking-tight md:text-6xl"
            style={{ letterSpacing: "-0.02em" }}
          >
            Your next thought is waiting.
          </h2>
          <Link
            to="/app"
            className="mt-10 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
            style={{ background: FOREST_ACCENT, color: FOREST_DEEP }}
          >
            Open Noti <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        className="border-t py-10"
        style={{ borderColor: FOREST_LINE }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <NotiWordmark size="sm" color={FOREST_INK} />
          <span className="text-sm" style={{ color: FOREST_INK_FAINT }}>
            © {new Date().getFullYear()} Noti. Notes that notify.
          </span>
          <div className="flex items-center gap-6 text-sm" style={{ color: FOREST_INK_SOFT }}>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/support">Support</Link>
            <Link to="/app">App</Link>
            <Link to="/fans">Fans</Link>
          </div>
        </div>
      </footer>

      <Dialog open={activePreview !== null} onOpenChange={(o) => !o && setActivePreview(null)}>
        <DialogContent
          className="max-w-md border-0 p-0 sm:rounded-3xl"
          style={{ background: "transparent", boxShadow: "none" }}
        >
          <DialogTitle className="sr-only">{activeFeature?.title ?? "Feature preview"}</DialogTitle>
          <DialogDescription className="sr-only">{activeFeature?.body ?? ""}</DialogDescription>
          {activePreview && activeFeature && (
            <FeaturePreview kind={activePreview} feature={activeFeature as any} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
