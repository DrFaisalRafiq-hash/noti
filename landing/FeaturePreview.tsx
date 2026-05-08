import {
  Bell,
  BellRing,
  CalendarClock,
  Check,
  CheckSquare,
  Folder,
  ListChecks,
  Mic,
  Shield,
  Smartphone,
  Sparkles,
  Sun,
  Wand2,
} from "lucide-react";
import type { ComponentType } from "react";

type LucideLikeIcon = ComponentType<{ size?: number | string }>;

type Kind =
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

interface FeatureMeta {
  icon: LucideLikeIcon;
  title: string;
  body: string;
  aiBadge?: boolean;
}

// Brand tokens (kept inline so the component stays self-contained)
const BG = "hsl(60 8% 9%)";
const SURFACE = "hsl(60 8% 14%)";
const SURFACE_2 = "hsl(60 8% 18%)";
const LINE = "hsl(60 10% 24%)";
const INK = "hsl(78 12% 92%)";
const INK_SOFT = "hsl(78 6% 72%)";
const INK_FAINT = "hsl(78 5% 54%)";
const ACCENT = "hsl(78 7% 70%)";
const OLIVE = "hsl(60 19% 36%)";

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto w-full overflow-hidden rounded-[2rem] p-4"
      style={{
        background: BG,
        border: `1px solid ${LINE}`,
        boxShadow:
          "0 30px 60px -20px hsl(0 0% 0% / 0.6), 0 0 0 6px hsl(60 8% 6%)",
      }}
    >
      {children}
    </div>
  );
}

function Header({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="font-display text-lg font-semibold" style={{ color: INK }}>
        {title}
      </span>
      <span className="text-[10px]" style={{ color: INK_FAINT }}>
        9:41
      </span>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${className}`}
      style={{ background: SURFACE, border: `1px solid ${LINE}` }}
    >
      {children}
    </div>
  );
}

function NotifyPreview() {
  return (
    <PhoneFrame>
      <Header title="Notes" />
      <Card className="mb-2">
        <div className="flex items-start gap-2">
          <Bell size={14} style={{ color: ACCENT, marginTop: 2 }} />
          <div className="flex-1">
            <div className="text-sm font-medium" style={{ color: INK }}>
              Call Mom
            </div>
            <div className="text-xs" style={{ color: INK_SOFT }}>
              Reminds you Sunday at 6:00 PM · repeats weekly
            </div>
          </div>
        </div>
      </Card>
      <Card className="mb-2">
        <div className="flex items-start gap-2">
          <BellRing size={14} style={{ color: OLIVE, marginTop: 2 }} />
          <div className="flex-1">
            <div className="text-sm font-medium" style={{ color: INK }}>
              Pay rent
            </div>
            <div className="text-xs" style={{ color: INK_SOFT }}>
              Due in 3 days · snoozed once
            </div>
          </div>
        </div>
      </Card>
      <div
        className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
        style={{ background: SURFACE_2, color: INK_SOFT }}
      >
        <CalendarClock size={12} /> Schedule, snooze, or repeat — all from the keyboard.
      </div>
    </PhoneFrame>
  );
}

function TasksPreview() {
  return (
    <PhoneFrame>
      <Header title="Tasks" />
      <div className="mb-2 flex gap-2 text-[11px]">
        <span
          className="rounded-full px-2 py-0.5"
          style={{ background: OLIVE, color: INK }}
        >
          Open · 4
        </span>
        <span
          className="rounded-full px-2 py-0.5"
          style={{ background: SURFACE_2, color: INK_SOFT }}
        >
          Done · 12
        </span>
      </div>
      {[
        { t: "Send Q3 invoice", p: "high", d: "Today" },
        { t: "Review portfolio drafts", p: "med", d: "Tomorrow" },
        { t: "Book dentist", p: "low", d: "Next week" },
      ].map((task) => (
        <Card key={task.t} className="mb-2">
          <div className="flex items-center gap-2">
            <CheckSquare size={14} style={{ color: ACCENT }} />
            <span className="flex-1 text-sm" style={{ color: INK }}>
              {task.t}
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[10px]"
              style={{
                background:
                  task.p === "high"
                    ? "hsl(12 60% 35%)"
                    : task.p === "med"
                    ? OLIVE
                    : SURFACE_2,
                color: INK,
              }}
            >
              {task.p}
            </span>
            <span className="text-[10px]" style={{ color: INK_FAINT }}>
              {task.d}
            </span>
          </div>
        </Card>
      ))}
    </PhoneFrame>
  );
}

function VoicePreview() {
  return (
    <PhoneFrame>
      <Header title="Voice" />
      <div
        className="mb-3 flex flex-col items-center gap-3 rounded-xl py-6"
        style={{ background: SURFACE, border: `1px solid ${LINE}` }}
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: OLIVE, color: INK }}
        >
          <Mic size={26} />
        </div>
        <div className="flex items-end gap-1 h-6">
          {[8, 14, 22, 18, 12, 24, 16, 10, 20, 14].map((h, i) => (
            <span
              key={i}
              className="w-1 rounded-full"
              style={{ height: h, background: ACCENT }}
            />
          ))}
        </div>
        <span className="text-xs" style={{ color: INK_SOFT }}>
          Recording · release to transcribe
        </span>
      </div>
      <Card>
        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: INK_FAINT }}>
          Last memo · 12s
        </div>
        <p className="text-sm leading-snug" style={{ color: INK }}>
          "Pick up Maya at 4:30, then groceries — milk, eggs, sourdough."
        </p>
      </Card>
    </PhoneFrame>
  );
}

function StylusPreview() {
  // Animated handwritten "Notes" path → printed text underneath.
  return (
    <PhoneFrame>
      <Header title="Apple Pencil · stylus" />
      <Card>
        <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: INK_FAINT }}>
          Handwritten · auto-converted
        </div>
        <div
          className="rounded-lg mb-2 relative overflow-hidden"
          style={{ background: BG, border: `1px dashed ${LINE}`, height: 96 }}
        >
          <svg viewBox="0 0 240 90" className="w-full h-full">
            <path
              d="M14 64 C 22 30, 32 30, 38 60 C 44 30, 56 30, 60 60 M70 40 C 70 30, 90 30, 90 50 C 90 70, 70 70, 70 50 Z M104 64 V 36 C 104 28, 124 28, 124 44 V 64 M138 50 C 138 38, 158 38, 158 50 C 158 64, 138 64, 138 50 Z M172 64 V 30 M172 64 H 196 M172 48 H 192 M208 36 C 208 28, 226 28, 226 36 C 226 48, 208 44, 208 56 C 208 66, 226 66, 226 58"
              fill="none"
              stroke={INK}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="600"
              strokeDashoffset="600"
              style={{ animation: "noti-ink 2.6s ease-out 0.2s forwards" }}
            />
          </svg>
          <style>{`@keyframes noti-ink { to { stroke-dashoffset: 0; } }`}</style>
          <div
            className="absolute bottom-1 right-2 text-[9px] uppercase tracking-wider"
            style={{ color: INK_FAINT }}
          >
            Pen · 0.6 mm
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
            style={{ background: `${OLIVE}33`, color: INK, border: `1px solid ${OLIVE}` }}
          >
            <Check size={10} /> Recognized
          </span>
          <span className="text-sm font-medium" style={{ color: INK }}>
            Notes
          </span>
        </div>
      </Card>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]" style={{ color: INK_SOFT }}>
        <div className="rounded-md py-1 text-center" style={{ background: SURFACE_2, border: `1px solid ${LINE}` }}>
          Palm reject
        </div>
        <div className="rounded-md py-1 text-center" style={{ background: SURFACE_2, border: `1px solid ${LINE}` }}>
          Pressure
        </div>
        <div className="rounded-md py-1 text-center" style={{ background: SURFACE_2, border: `1px solid ${LINE}` }}>
          Searchable
        </div>
      </div>
    </PhoneFrame>
  );
}

function FoldersPreview() {
  const folders = [
    { name: "Work", count: 42, color: "hsl(200 40% 45%)" },
    { name: "Ideas", count: 18, color: "hsl(40 60% 50%)" },
    { name: "Personal", count: 31, color: "hsl(340 40% 50%)" },
    { name: "Reading", count: 9, color: OLIVE },
  ];
  return (
    <PhoneFrame>
      <Header title="Folders" />
      <div className="grid grid-cols-2 gap-2">
        {folders.map((f) => (
          <Card key={f.name}>
            <div className="flex items-center gap-2">
              <Folder size={14} style={{ color: f.color }} />
              <span className="text-sm font-medium" style={{ color: INK }}>
                {f.name}
              </span>
            </div>
            <div className="mt-1 text-[10px]" style={{ color: INK_FAINT }}>
              {f.count} notes
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-3 pl-3 border-l-2" style={{ borderColor: LINE }}>
        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: INK_FAINT }}>
          Work / Clients
        </div>
        {["Acme brief", "Q3 retro notes", "Pricing draft"].map((n) => (
          <div key={n} className="text-xs py-0.5" style={{ color: INK_SOFT }}>
            · {n}
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}

function PrivatePreview() {
  return (
    <PhoneFrame>
      <Header title="Locked" />
      <div
        className="flex flex-col items-center gap-4 rounded-xl py-10"
        style={{ background: SURFACE, border: `1px solid ${LINE}` }}
      >
        <div
          className="flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ background: SURFACE_2, color: ACCENT }}
        >
          <Shield size={36} />
        </div>
        <div className="text-center">
          <div className="font-display text-base font-semibold" style={{ color: INK }}>
            Noti is locked
          </div>
          <div className="mt-1 text-xs" style={{ color: INK_SOFT }}>
            Use Face ID to unlock
          </div>
        </div>
        <button
          className="mt-2 rounded-full px-4 py-1.5 text-xs"
          style={{ background: OLIVE, color: INK }}
        >
          Unlock
        </button>
      </div>
    </PhoneFrame>
  );
}

function AISummaryPreview() {
  return (
    <PhoneFrame>
      <Header title="Smart summary" />
      <Card className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={12} style={{ color: OLIVE }} />
          <span className="text-[10px] uppercase tracking-wider" style={{ color: INK_FAINT }}>
            AI title
          </span>
        </div>
        <div className="text-sm font-medium" style={{ color: INK }}>
          Q3 product strategy meeting
        </div>
      </Card>
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={12} style={{ color: OLIVE }} />
          <span className="text-[10px] uppercase tracking-wider" style={{ color: INK_FAINT }}>
            Summary
          </span>
        </div>
        {[
          "Ship onboarding redesign before end of August.",
          "Two engineers reallocated to mobile.",
          "Pricing page experiment kicks off next Monday.",
        ].map((s) => (
          <div key={s} className="flex gap-2 text-xs leading-snug py-1" style={{ color: INK_SOFT }}>
            <Check size={12} style={{ color: ACCENT, marginTop: 2 }} />
            <span>{s}</span>
          </div>
        ))}
      </Card>
    </PhoneFrame>
  );
}

function AIBreakdownPreview() {
  return (
    <PhoneFrame>
      <Header title="AI breakdown" />
      <Card className="mb-3">
        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: INK_FAINT }}>
          Your goal
        </div>
        <div className="flex items-center gap-2">
          <Wand2 size={14} style={{ color: OLIVE }} />
          <span className="text-sm" style={{ color: INK }}>
            Launch the newsletter
          </span>
        </div>
      </Card>
      <div className="text-[10px] uppercase tracking-wider mb-2 px-1" style={{ color: INK_FAINT }}>
        Generated subtasks
      </div>
      {[
        { t: "Pick a name & domain", p: "high", d: "Today" },
        { t: "Set up email provider", p: "high", d: "Wed" },
        { t: "Draft welcome issue", p: "med", d: "Fri" },
        { t: "Design opt-in page", p: "med", d: "Next week" },
        { t: "Invite first 50 readers", p: "low", d: "Soon" },
      ].map((task) => (
        <Card key={task.t} className="mb-1.5">
          <div className="flex items-center gap-2">
            <ListChecks size={12} style={{ color: ACCENT }} />
            <span className="flex-1 text-xs" style={{ color: INK }}>
              {task.t}
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[9px]"
              style={{
                background: task.p === "high" ? "hsl(12 60% 35%)" : task.p === "med" ? OLIVE : SURFACE_2,
                color: INK,
              }}
            >
              {task.p}
            </span>
            <span className="text-[9px]" style={{ color: INK_FAINT }}>
              {task.d}
            </span>
          </div>
        </Card>
      ))}
    </PhoneFrame>
  );
}

function AIDigestPreview() {
  return (
    <PhoneFrame>
      <Header title="Morning digest" />
      <Card className="mb-2">
        <div className="flex items-center gap-2">
          <Sun size={14} style={{ color: OLIVE }} />
          <span className="text-sm font-medium" style={{ color: INK }}>
            Tuesday, April 28
          </span>
        </div>
        <div className="mt-1 text-xs" style={{ color: INK_SOFT }}>
          You have 3 things due, 1 reminder this morning, and 2 notes you flagged yesterday.
        </div>
      </Card>
      <Card className="mb-2">
        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: INK_FAINT }}>
          Focus today
        </div>
        <div className="flex items-start gap-2 text-xs" style={{ color: INK }}>
          <Sparkles size={12} style={{ color: OLIVE, marginTop: 2 }} />
          <span>
            Finish the Acme brief — it's blocking two other tasks and was snoozed twice.
          </span>
        </div>
      </Card>
      <Card>
        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: INK_FAINT }}>
          Quietly noticed
        </div>
        <div className="text-xs" style={{ color: INK_SOFT }}>
          You've added 4 notes about "newsletter" this week. Want to turn it into a project?
        </div>
      </Card>
    </PhoneFrame>
  );
}

function InstallPreview() {
  return (
    <PhoneFrame>
      <Header title="Add to Home Screen" />
      <div
        className="mb-3 flex flex-col items-center gap-3 rounded-xl py-6"
        style={{ background: SURFACE, border: `1px solid ${LINE}` }}
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: SURFACE_2, color: ACCENT }}
        >
          <Smartphone size={28} />
        </div>
        <div className="text-sm font-medium" style={{ color: INK }}>
          Install Noti
        </div>
        <div className="text-xs text-center px-6" style={{ color: INK_SOFT }}>
          Full-screen, offline-friendly, opens instantly. No app store required.
        </div>
        <button
          className="rounded-full px-4 py-1.5 text-xs"
          style={{ background: OLIVE, color: INK }}
        >
          Add to Home Screen
        </button>
      </div>
    </PhoneFrame>
  );
}

const map: Record<Kind, React.FC> = {
  notify: NotifyPreview,
  tasks: TasksPreview,
  voice: VoicePreview,
  stylus: StylusPreview,
  folders: FoldersPreview,
  private: PrivatePreview,
  "ai-summary": AISummaryPreview,
  install: InstallPreview,
  "ai-breakdown": AIBreakdownPreview,
  "ai-digest": AIDigestPreview,
};

export default function FeaturePreview({
  kind,
  feature,
}: {
  kind: Kind;
  feature: FeatureMeta;
}) {
  const Comp = map[kind];
  const Icon = feature.icon;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 px-1">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: `${ACCENT}1a`, color: ACCENT }}
        >
          <Icon size={16} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-semibold" style={{ color: INK }}>
              {feature.title}
            </h3>
            {feature.aiBadge && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                style={{ background: `${OLIVE}33`, color: INK, border: `1px solid ${OLIVE}` }}
              >
                <Sparkles size={10} /> AI
              </span>
            )}
          </div>
          <p className="mt-1 text-xs" style={{ color: INK_SOFT }}>
            {feature.body}
          </p>
        </div>
      </div>
      <Comp />
    </div>
  );
}
