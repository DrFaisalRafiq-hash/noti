import { useEffect, useState } from "react";

/**
 * iPad rotation diagnostic page (route: /rotation-test)
 *
 * Renders four overlay bands matching the four safe-area insets, a centered
 * splash-style mark sized via `vmin`, and a live readout of viewport metrics.
 * Rotate the iPad and visually confirm:
 *   • The centered mark stays centered and square in both orientations.
 *   • The colored bands hug the very edges of the screen (not the safe-area
 *     inset itself — they're positioned at 0,0 and labeled with the inset
 *     value so you can verify the OS reports them).
 *   • Width/height/orientation/visualViewport values flip as expected on
 *     rotation, with no stale numbers.
 */
export default function RotationTest() {
  const [info, setInfo] = useState(read());

  useEffect(() => {
    const update = () => setInfo(read());
    const vv = window.visualViewport;
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-background text-foreground"
      style={{
        // No padding here — bands need to hug the absolute edges. Children
        // that need safe-area gutters apply them themselves.
      }}
    >
      {/* Edge bands — the colored stripes show OS-reported safe-area insets. */}
      <Band side="top" color="hsl(0 80% 55% / 0.35)" />
      <Band side="bottom" color="hsl(220 80% 55% / 0.35)" />
      <Band side="left" color="hsl(140 60% 45% / 0.35)" />
      <Band side="right" color="hsl(45 90% 55% / 0.35)" />

      {/* Centered splash-style mark — sized by vmin so it stays square. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="rounded-[21%] shadow-2xl flex items-center justify-center"
          style={{
            width: "min(60vmin, 320px)",
            aspectRatio: "1 / 1",
            background:
              "linear-gradient(180deg, #4e4e48 0%, #2e2e2a 100%)",
          }}
        >
          <span className="font-display text-7xl italic text-white/90">n</span>
        </div>
      </div>

      {/* Live metrics card — pinned to safe area so it stays readable. */}
      <div
        className="absolute z-10 max-w-[min(92vw,420px)] rounded-2xl border bg-card/95 p-4 text-xs leading-relaxed shadow-lg backdrop-blur"
        style={{
          top: "calc(env(safe-area-inset-top) + 12px)",
          left: "calc(env(safe-area-inset-left) + 12px)",
        }}
      >
        <div className="mb-2 text-sm font-semibold">iPad rotation test</div>
        <Row label="Orientation" value={info.orientation} />
        <Row label="window.innerWidth × innerHeight" value={`${info.iw} × ${info.ih}`} />
        <Row label="visualViewport w × h" value={`${info.vvw} × ${info.vvh}`} />
        <Row label="visualViewport offset (top, left)" value={`${info.vvOffsetTop}, ${info.vvOffsetLeft}`} />
        <Row label="devicePixelRatio" value={String(info.dpr)} />
        <div className="mt-2 text-muted-foreground">
          Rotate the device. Bands should hug edges; the mark should stay
          centered and square; numbers should update without stale values.
        </div>
      </div>
    </div>
  );
}

function read() {
  const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
  const iw = typeof window !== "undefined" ? window.innerWidth : 0;
  const ih = typeof window !== "undefined" ? window.innerHeight : 0;
  return {
    iw,
    ih,
    vvw: vv?.width ?? iw,
    vvh: vv?.height ?? ih,
    vvOffsetTop: vv?.offsetTop ?? 0,
    vvOffsetLeft: vv?.offsetLeft ?? 0,
    dpr: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    orientation: iw >= ih ? "landscape" : "portrait",
  };
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Band({ side, color }: { side: "top" | "bottom" | "left" | "right"; color: string }) {
  const isHorizontal = side === "top" || side === "bottom";
  const inset = `env(safe-area-inset-${side})`;
  const style: React.CSSProperties = isHorizontal
    ? {
        position: "absolute",
        left: 0,
        right: 0,
        [side]: 0,
        height: `max(${inset}, 4px)`,
        background: color,
      }
    : {
        position: "absolute",
        top: 0,
        bottom: 0,
        [side]: 0,
        width: `max(${inset}, 4px)`,
        background: color,
      };
  return (
    <div style={style} className="flex items-center justify-center">
      <span className="text-[10px] font-mono text-foreground/80 px-1">
        {side}: <span className="tabular-nums">{`max(env(safe-area-inset-${side}), 4px)`}</span>
      </span>
    </div>
  );
}
