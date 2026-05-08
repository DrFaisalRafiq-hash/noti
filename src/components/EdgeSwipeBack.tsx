import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { haptic } from "@/lib/notes-store";

/**
 * Global iOS-style edge-swipe-back gesture.
 *
 * Listens for pointerdown events that start within EDGE_WIDTH px of the
 * left viewport edge and, on a horizontal swipe right past a threshold,
 * calls navigate(-1).
 *
 * Why a global window listener (rather than a fixed overlay strip)?
 *  - Capturing pointerdown at the window catches the gesture without
 *    occluding interactive elements at the edge (the drawer trigger, etc.).
 *  - We only "claim" the gesture once horizontal motion clearly dominates,
 *    so vertical scrolls and taps near the edge keep working normally.
 *
 * Suppressed automatically while a modal/sheet is open (detected via
 * `document.body.style.overflow === "hidden"`), since those own their
 * own dismiss gestures and stacking them is confusing.
 */
const EDGE_WIDTH = 24;          // px from the left edge that arms the gesture
const COMMIT_X = 14;            // px of horizontal motion before we own it
const TRIGGER_DISTANCE = 80;    // px of horizontal travel that triggers back
const TRIGGER_VELOCITY = 0.5;   // px/ms — fast flick threshold
const MAX_INDICATOR_OFFSET = 96; // visual cap for the chevron offset

export default function EdgeSwipeBack() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;

  // Track gesture state in a ref so the listener doesn't churn on re-render.
  const state = useRef<{
    id: number;
    x0: number;
    y0: number;
    t0: number;
    axis: "none" | "x" | "y";
    dx: number;
    armed: boolean;
  } | null>(null);

  const [indicator, setIndicator] = useState<{ x: number; opacity: number } | null>(null);
  const [snapping, setSnapping] = useState<"in" | "back" | null>(null);

  useEffect(() => {
    const isModalOpen = () => document.body.style.overflow === "hidden";

    const onPointerDown = (e: PointerEvent) => {
      // Only primary mouse button or touch/pen.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // Don't fight history root — nothing to go back to.
      if (window.history.length <= 1) return;
      // Don't fight open modals (NoteViewer, RowActionSheet, etc.).
      if (isModalOpen()) return;
      // Don't start on the home / landing screens — back would leave the app.
      const path = locationRef.current.pathname;
      if (path === "/" || path === "/auth") return;
      // Must start within the left edge gutter.
      if (e.clientX > EDGE_WIDTH) return;
      state.current = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        t0: performance.now(),
        axis: "none",
        dx: 0,
        armed: true,
      };
      setSnapping(null);
    };

    const onPointerMove = (e: PointerEvent) => {
      const s = state.current;
      if (!s || s.id !== e.pointerId || !s.armed) return;
      const dx = e.clientX - s.x0;
      const dy = e.clientY - s.y0;

      if (s.axis === "none") {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx < COMMIT_X && ady < COMMIT_X) return;
        // Vertical motion wins → release the gesture so the page can scroll.
        if (ady > adx || dx <= 0) {
          state.current = null;
          setIndicator(null);
          return;
        }
        s.axis = "x";
      }

      if (s.axis === "x") {
        s.dx = Math.max(0, dx);
        // Prevent the browser's own pull-to-refresh / text-selection while
        // we own the gesture.
        if (e.cancelable) e.preventDefault();
        const x = Math.min(s.dx, MAX_INDICATOR_OFFSET);
        setIndicator({ x, opacity: Math.min(1, s.dx / TRIGGER_DISTANCE) });
      }
    };

    const onPointerEnd = (e: PointerEvent) => {
      const s = state.current;
      if (!s || s.id !== e.pointerId) return;
      state.current = null;
      if (s.axis !== "x") {
        setIndicator(null);
        return;
      }
      const dt = Math.max(1, performance.now() - s.t0);
      const v = s.dx / dt;
      const trigger = s.dx > TRIGGER_DISTANCE || v > TRIGGER_VELOCITY;
      if (trigger) {
        haptic.light();
        setSnapping("in");
        setIndicator({ x: MAX_INDICATOR_OFFSET, opacity: 1 });
        window.setTimeout(() => {
          setIndicator(null);
          setSnapping(null);
          navigate(-1);
        }, 140);
      } else {
        setSnapping("back");
        setIndicator({ x: 0, opacity: 0 });
        window.setTimeout(() => {
          setIndicator(null);
          setSnapping(null);
        }, 200);
      }
    };

    // Use passive:false so we can preventDefault on horizontal commit.
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerEnd, { passive: true });
    window.addEventListener("pointercancel", onPointerEnd, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [navigate]);

  if (!indicator) return null;

  // Subtle chevron pill that follows the finger to telegraph the action.
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-y-0 left-0 z-[100] flex items-center"
      style={{
        transform: `translate3d(${indicator.x}px, 0, 0)`,
        transition:
          snapping === "in"
            ? "transform 140ms cubic-bezier(0.32,0.72,0.3,1), opacity 140ms"
            : snapping === "back"
            ? "transform 200ms cubic-bezier(0.32,0.72,0.3,1), opacity 200ms"
            : undefined,
        opacity: indicator.opacity,
      }}
    >
      <div className="ml-1 flex h-12 w-8 items-center justify-center rounded-r-full bg-paper/90 backdrop-blur-sm shadow-lift hairline border border-l-0">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ink-soft"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </div>
    </div>
  );
}
