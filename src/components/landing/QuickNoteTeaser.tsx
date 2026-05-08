import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, FileText, Mic, Bell, Check, X } from "lucide-react";

/**
 * QuickNoteTeaser — a non-functional, interactive showcase of the in-app
 * QuickNoteTab. Mounted inside a framed "device" canvas on the landing hero so
 * visitors can FEEL the metaball drag-to-open gesture before signing up.
 *
 * Differences from the real component:
 *  - Lives inside a relatively-positioned frame instead of fixed to viewport.
 *  - Auto-tease loop: every few seconds the tab gives a little tug + the
 *    "Slide me up" hint pulses, drawing the eye.
 *  - On release-past-threshold, opens a stylized Quick-draft preview that
 *    auto-types a sample line, then closes itself a few seconds later so the
 *    loop can repeat.
 */

type Tab = "note" | "voice" | "reminder";

const OPEN_THRESHOLD = 70;
const MAX_PULL = 180;
const TAB_SIZE = 52;

function rubberband(d: number, max = MAX_PULL) {
  if (d <= 0) return 0;
  return (d * max) / (d + max * 0.55);
}

const SAMPLE_TEXTS: Record<Tab, string> = {
  note: "Idea: pitch deck for the Lisbon trip — keep it under 7 slides.",
  voice: "Tap record · 0:00",
  reminder: "Send the Q4 contract to Maya",
};

interface Props {
  /** Theme colors (matches the landing's forest palette). */
  palette: {
    bg: string;
    paper: string;
    ink: string;
    inkSoft: string;
    inkFaint: string;
    line: string;
    accent: string;
    olive: string;
  };
}

export default function QuickNoteTeaser({ palette }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [springing, setSpringing] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("note");
  const [typed, setTyped] = useState("");
  const [saved, setSaved] = useState(false);
  const [teasing, setTeasing] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  // ── Auto-tease loop ──────────────────────────────────────────────────────
  // Until the user has touched the tab, every 3.4s give it a little tug to
  // hint at the gesture. We animate `drag` to a soft up-right offset, then
  // bounce back. The dotted "Slide me up" hint pulses in sync.
  useEffect(() => {
    if (hasInteracted || open) return;
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      setTeasing(true);
      setSpringing(true);
      setDrag({ x: 18, y: 34 });
      window.setTimeout(() => {
        if (cancelled) return;
        setDrag({ x: 0, y: 0 });
        window.setTimeout(() => {
          if (cancelled) return;
          setTeasing(false);
          setSpringing(false);
        }, 420);
      }, 520);
    };
    const id = window.setInterval(loop, 3400);
    const first = window.setTimeout(loop, 900);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [hasInteracted, open]);

  // ── Auto-typing once the sheet opens ─────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setTyped("");
      setSaved(false);
      return;
    }
    const target = SAMPLE_TEXTS[tab];
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(target.slice(0, i));
      if (i >= target.length) {
        window.clearInterval(id);
        // small pause, then "save", then close after a beat so the loop replays
        window.setTimeout(() => setSaved(true), 600);
        window.setTimeout(() => {
          setOpen(false);
          setHasInteracted(false); // restart the tease loop
        }, 2400);
      }
    }, 38);
    return () => window.clearInterval(id);
  }, [open, tab]);

  // Cycle through the three tabs on each auto-open so visitors see each mode.
  const autoCycleRef = useRef<Tab>("note");
  useEffect(() => {
    if (!open || hasInteracted) return;
    // Pre-set the tab for the next auto-open.
    const order: Tab[] = ["note", "reminder", "voice"];
    const next = order[(order.indexOf(autoCycleRef.current) + 1) % order.length];
    autoCycleRef.current = next;
    // schedule for the *following* auto-open
    const t = window.setTimeout(() => setTab(next), 2500);
    return () => window.clearTimeout(t);
  }, [open, hasInteracted]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setHasInteracted(true);
    setTeasing(false);
    setDragging(true);
    setSpringing(false);
    setDrag({ x: 0, y: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const rawX = Math.max(0, e.clientX - start.current.x);
    const rawY = Math.max(0, start.current.y - e.clientY);
    const dist = Math.hypot(rawX, rawY);
    if (dist === 0) {
      setDrag({ x: 0, y: 0 });
      return;
    }
    const eased = rubberband(dist);
    setDrag({ x: (rawX / dist) * eased, y: (rawY / dist) * eased });
  };

  const release = () => {
    if (!start.current) return;
    const dist = Math.hypot(drag.x, drag.y);
    const passed = dist >= OPEN_THRESHOLD;
    start.current = null;
    setDragging(false);
    if (passed) {
      const ux = dist === 0 ? 0 : drag.x / dist;
      const uy = dist === 0 ? 1 : drag.y / dist;
      setDrag({ x: ux * MAX_PULL, y: uy * MAX_PULL });
      setSpringing(true);
      window.setTimeout(() => {
        setOpen(true);
        setDrag({ x: 0, y: 0 });
        setSpringing(false);
      }, 160);
    } else {
      setSpringing(true);
      setDrag({ x: 0, y: 0 });
      window.setTimeout(() => setSpringing(false), 380);
    }
  };

  // Click without drag — also opens.
  const onClick = () => {
    if (Math.hypot(drag.x, drag.y) > 4) return;
    setHasInteracted(true);
    setOpen(true);
  };

  const dist = Math.hypot(drag.x, drag.y);
  const progress = Math.min(1, dist / OPEN_THRESHOLD);
  const armed = dist >= OPEN_THRESHOLD;
  const angleDeg = dist === 0 ? 45 : Math.atan2(drag.x, drag.y) * (180 / Math.PI);

  // ── Metaball geometry (mirrors QuickNoteTab) ─────────────────────────────
  const fluidSize = MAX_PULL + TAB_SIZE + 60;
  const poolCx = TAB_SIZE / 2;
  const poolCy = fluidSize - TAB_SIZE / 2;
  const dropCx = poolCx + drag.x;
  const dropCy = poolCy - drag.y;
  const poolR = TAB_SIZE / 2 + 2 - progress * 4;
  const dropR = TAB_SIZE / 2 - progress * 6 + (armed ? 4 : 0);
  const neckWidth = Math.max(0, (TAB_SIZE / 2 - 4) * (1 - progress * 0.85));
  const axisDx = dropCx - poolCx;
  const axisDy = dropCy - poolCy;
  const axisLen = Math.hypot(axisDx, axisDy) || 1;
  const nx = -axisDy / axisLen;
  const ny = axisDx / axisLen;
  const pinch = Math.min(1, progress * 1.2);
  const midX = (poolCx + dropCx) / 2;
  const midY = (poolCy + dropCy) / 2;
  const neckPath =
    `M ${poolCx + nx * neckWidth} ${poolCy + ny * neckWidth}` +
    ` Q ${midX + nx * neckWidth * (1 - pinch * 0.6)} ${midY + ny * neckWidth * (1 - pinch * 0.6)},` +
    ` ${dropCx + nx * neckWidth * 0.8} ${dropCy + ny * neckWidth * 0.8}` +
    ` L ${dropCx - nx * neckWidth * 0.8} ${dropCy - ny * neckWidth * 0.8}` +
    ` Q ${midX - nx * neckWidth * (1 - pinch * 0.6)} ${midY - ny * neckWidth * (1 - pinch * 0.6)},` +
    ` ${poolCx - nx * neckWidth} ${poolCy - ny * neckWidth} Z`;

  return (
    <div className="mt-12 flex justify-center">
      <div className="relative w-full max-w-md">
        {/* Helper caption above the frame */}
        <div className="mb-3 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.18em]" style={{ color: palette.inkFaint }}>
          <Sparkles size={11} style={{ color: palette.olive }} />
          Try it — drag the corner up
        </div>

        {/* The "device" frame */}
        <div
          ref={frameRef}
          className="relative overflow-hidden rounded-[28px] border shadow-2xl"
          style={{
            background: palette.bg,
            borderColor: palette.line,
            height: 360,
            // soft inner glow
            boxShadow: `0 30px 80px -30px ${palette.olive}55, inset 0 0 0 1px ${palette.line}`,
          }}
        >
          {/* Faux app chrome — header strip */}
          <div className="flex items-center justify-between px-5 pt-5">
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl italic" style={{ color: palette.ink, letterSpacing: "-0.02em" }}>
                Noti
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-7 w-7 rounded-full"
                  style={{ background: `${palette.paper}`, border: `1px solid ${palette.line}` }}
                />
              ))}
              <span
                className="ml-1 inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium"
                style={{
                  background: `${palette.olive}22`,
                  border: `1px solid ${palette.olive}44`,
                  color: palette.olive,
                }}
              >
                <Sparkles size={10} /> 1,240
              </span>
            </div>
          </div>

          {/* Faux switcher pill */}
          <div className="mt-5 flex justify-center">
            <div
              className="inline-flex rounded-full border p-0.5 text-[11px] font-medium"
              style={{ background: palette.paper, borderColor: palette.line, color: palette.inkSoft }}
            >
              {["Notes", "Tasks", "Docs", "Voice"].map((l, i) => (
                <span
                  key={l}
                  className="px-2.5 py-1 rounded-full"
                  style={
                    i === 0
                      ? { background: palette.ink, color: palette.bg }
                      : undefined
                  }
                >
                  {l}
                </span>
              ))}
            </div>
          </div>

          {/* Faux note rows */}
          <div className="px-5 pt-5 space-y-2.5">
            {[
              { t: "Welcome to Noti", s: "Notes that tap you on the shoulder." },
              { t: "Grocery run", s: "Olive oil · sourdough · figs" },
              { t: "Pitch outline", s: "Open with the boring slide on purpose." },
            ].map((row, i) => (
              <div
                key={i}
                className="rounded-2xl border p-3"
                style={{ background: palette.paper, borderColor: palette.line }}
              >
                <p className="text-[13px] font-medium" style={{ color: palette.ink }}>
                  {row.t}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: palette.inkFaint }}>
                  {row.s}
                </p>
              </div>
            ))}
          </div>

          {/* ── The metaball SVG (only visible while interacting) ── */}
          <svg
            aria-hidden
            width={fluidSize}
            height={fluidSize}
            viewBox={`0 0 ${fluidSize} ${fluidSize}`}
            className="absolute bottom-0 left-0 pointer-events-none"
            style={{
              opacity: dist > 0 ? 1 : 0,
              transition: springing ? "opacity 300ms ease-out" : "opacity 120ms ease-out",
              zIndex: 5,
            }}
          >
            <defs>
              <filter id="teaserGoo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                <feColorMatrix
                  in="blur"
                  mode="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -11"
                  result="goo"
                />
                <feBlend in="SourceGraphic" in2="goo" />
              </filter>
            </defs>
            <g filter="url(#teaserGoo)">
              <circle cx={poolCx} cy={poolCy} r={poolR} fill={palette.ink} />
              {neckWidth > 1 && (
                <path d={neckPath} fill={palette.ink} opacity={1 - progress * 0.3} />
              )}
              <circle
                cx={dropCx}
                cy={dropCy}
                r={dropR}
                fill={armed ? palette.olive : palette.ink}
                style={{ transition: "fill 180ms ease-out" }}
              />
            </g>
          </svg>

          {/* ── The corner tab ── */}
          <button
            type="button"
            aria-label="Drag for a quick note"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={release}
            onPointerCancel={release}
            onClick={onClick}
            className="absolute left-0 bottom-0 select-none touch-none rounded-tr-full flex items-start justify-center"
            style={{
              width: TAB_SIZE,
              height: TAB_SIZE,
              paddingTop: 14,
              transformOrigin: "bottom left",
              transform: `translate(${drag.x}px, ${-drag.y}px) scale(${1 + progress * 0.18})`,
              transition: dragging
                ? "none"
                : springing
                  ? "transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 200ms"
                  : "transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 200ms",
              backgroundColor:
                dist > 0.5
                  ? "transparent"
                  : armed
                    ? palette.olive
                    : palette.ink,
              color: palette.bg,
              zIndex: 6,
              boxShadow: dist > 0.5 ? "none" : `0 -10px 24px -8px ${palette.olive}66`,
            }}
          >
            <ArrowUp
              size={18}
              strokeWidth={2.25}
              style={{
                transform: `rotate(${angleDeg}deg) scale(${1 + progress * 0.15})`,
                transition: dragging ? "transform 60ms linear" : "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            />
          </button>

          {/* ── Tease hint label that pulses while idle ── */}
          {!open && !dragging && (
            <div
              className="absolute pointer-events-none flex items-center gap-2"
              style={{
                left: TAB_SIZE + 12,
                bottom: 16,
                color: armed ? palette.olive : palette.inkSoft,
                opacity: teasing || progress > 0 ? 1 : 0.55,
                transform: `translateX(${(teasing ? 6 : 0) + progress * 10}px)`,
                transition: "opacity 300ms ease-out, transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), color 200ms",
                zIndex: 6,
              }}
            >
              {/* dotted upward trail */}
              <span className="flex flex-col items-center gap-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="block h-1 w-1 rounded-full"
                    style={{
                      background: armed ? palette.olive : palette.inkSoft,
                      opacity: 0.3 + i * 0.25,
                      animation: teasing
                        ? `teaserBob 900ms ease-in-out ${i * 120}ms infinite`
                        : undefined,
                    }}
                  />
                ))}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.18em]">
                {armed ? "Release" : "Slide me up"}
              </span>
            </div>
          )}

          {/* ── The Quick draft sheet ── */}
          {open && (
            <div
              className="absolute inset-x-0 bottom-0 animate-fade-in"
              style={{ zIndex: 10 }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(180deg, transparent 0%, ${palette.bg}cc 50%, ${palette.bg}ee 100%)`,
                  backdropFilter: "blur(2px)",
                }}
              />
              <div
                className="relative mx-3 mb-3 rounded-2xl border shadow-xl"
                style={{
                  background: palette.paper,
                  borderColor: palette.line,
                  animation: "teaserSheetUp 420ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                {/* grabber */}
                <div className="pt-2 pb-1 flex justify-center">
                  <div className="h-1 w-10 rounded-full" style={{ background: `${palette.inkFaint}55` }} />
                </div>

                {/* header */}
                <div className="flex items-center justify-between px-4 pt-1 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} style={{ color: palette.olive }} />
                    <span className="font-display text-sm" style={{ color: palette.ink }}>
                      Quick draft
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setHasInteracted(false);
                    }}
                    className="p-1 rounded-full"
                    aria-label="Close"
                  >
                    <X size={14} style={{ color: palette.inkFaint }} />
                  </button>
                </div>

                {/* tab pill */}
                <div className="px-4 pt-1">
                  <div
                    className="inline-flex rounded-full border p-0.5 text-[10px] font-medium"
                    style={{ background: palette.bg, borderColor: palette.line }}
                  >
                    {([
                      { id: "note", label: "Note", Icon: FileText },
                      { id: "voice", label: "Voice", Icon: Mic },
                      { id: "reminder", label: "Reminder", Icon: Bell },
                    ] as const).map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setTab(id);
                          setHasInteracted(true);
                        }}
                        className="px-2.5 h-6 rounded-full inline-flex items-center gap-1 transition-colors"
                        style={
                          tab === id
                            ? { background: palette.ink, color: palette.bg }
                            : { color: palette.inkSoft }
                        }
                      >
                        <Icon size={10} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* body */}
                <div className="px-4 pt-3 pb-3">
                  {tab === "voice" ? (
                    <div className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: palette.line, background: palette.bg }}>
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ background: palette.olive, color: palette.bg, animation: "teaserPulse 1.4s ease-in-out infinite" }}
                      >
                        <Mic size={14} />
                      </span>
                      <div className="flex-1">
                        <div className="flex items-end gap-0.5 h-5">
                          {Array.from({ length: 22 }).map((_, i) => (
                            <span
                              key={i}
                              className="block w-0.5 rounded-full"
                              style={{
                                background: palette.olive,
                                height: `${20 + Math.sin(i * 0.7 + Date.now() / 220) * 40 + 30}%`,
                                opacity: 0.55,
                                animation: `teaserBars 900ms ease-in-out ${i * 35}ms infinite`,
                              }}
                            />
                          ))}
                        </div>
                        <p className="mt-1 text-[10px]" style={{ color: palette.inkFaint }}>
                          Recording… 0:0{Math.min(9, Math.floor(typed.length / 4))}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p
                      className="min-h-[60px] text-[13px] leading-relaxed"
                      style={{ color: palette.ink }}
                    >
                      {typed}
                      <span
                        className="inline-block w-[1px] h-4 ml-0.5 align-middle"
                        style={{
                          background: palette.ink,
                          animation: "teaserCaret 1s steps(2, end) infinite",
                        }}
                      />
                    </p>
                  )}

                  {tab === "reminder" && (
                    <div
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium"
                      style={{
                        background: `${palette.olive}22`,
                        color: palette.olive,
                        border: `1px solid ${palette.olive}44`,
                      }}
                    >
                      <Bell size={10} /> Tomorrow · 9:00 AM
                    </div>
                  )}
                </div>

                {/* footer */}
                <div
                  className="flex items-center justify-between px-4 py-2.5 border-t"
                  style={{ borderColor: palette.line }}
                >
                  <p className="text-[10px]" style={{ color: palette.inkFaint }}>
                    {tab === "reminder" ? "We'll ping you on time" : "Refine with AI later"}
                  </p>
                  <span
                    className="px-3 py-1 rounded-full text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors"
                    style={{
                      background: saved ? palette.olive : palette.ink,
                      color: palette.bg,
                    }}
                  >
                    {saved ? (
                      <>
                        <Check size={11} /> Saved
                      </>
                    ) : (
                      <>{tab === "reminder" ? "Set reminder" : tab === "voice" ? "Stop & save" : "Save draft"}</>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs" style={{ color: palette.inkFaint }}>
          Live preview of the in-app <span style={{ color: palette.ink }}>Quick draft</span> gesture. No download required.
        </p>
      </div>

      {/* Local keyframes — scoped to this widget */}
      <style>{`
        @keyframes teaserSheetUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        @keyframes teaserCaret {
          50% { opacity: 0; }
        }
        @keyframes teaserBob {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50%      { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes teaserBars {
          0%, 100% { transform: scaleY(0.6); }
          50%      { transform: scaleY(1.2); }
        }
        @keyframes teaserPulse {
          0%, 100% { box-shadow: 0 0 0 0 currentColor; }
          50%      { box-shadow: 0 0 0 6px transparent; }
        }
      `}</style>
    </div>
  );
}
