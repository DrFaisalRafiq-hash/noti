import { useEffect, useRef } from "react";

/**
 * Two-finger pinch-to-zoom helper.
 *
 * Attach to a scrollable element to capture two simultaneous pointers,
 * compute the live distance ratio between them, and emit a multiplier
 * that callers apply to a font-size (or any) value.
 *
 * Why a custom Pointer Events implementation rather than `gesturechange`
 * or native page zoom?
 *  - `gesturechange` is Safari-only.
 *  - Page zoom would scale the whole UI; we only want the reader body.
 *  - Pointer Events work uniformly across iOS/Android/desktop trackpads
 *    that emit synthetic touch points.
 *
 * The hook only "claims" a gesture once two pointers are simultaneously
 * down on the target — single-finger scrolls, taps, and the global
 * edge-swipe-back gesture remain untouched.
 */
export interface UsePinchOptions {
  /** Called repeatedly while pinching with the live scale ratio (≥0). */
  onPinch: (scale: number) => void;
  /** Called when the gesture ends (commit final value, persist, etc.). */
  onPinchEnd?: () => void;
  /** Disable the hook entirely (e.g. when a child modal is open). */
  enabled?: boolean;
}

export function usePinch<T extends HTMLElement>(
  ref: React.RefObject<T>,
  { onPinch, onPinchEnd, enabled = true }: UsePinchOptions,
) {
  // Stash callbacks in refs so we can register listeners once and avoid
  // re-attaching them every render when parent state changes.
  const onPinchRef = useRef(onPinch);
  const onPinchEndRef = useRef(onPinchEnd);
  onPinchRef.current = onPinch;
  onPinchEndRef.current = onPinchEnd;

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let startDist = 0;
    let active = false;

    const dist = () => {
      const pts = Array.from(pointers.values());
      if (pts.length < 2) return 0;
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      return Math.hypot(dx, dy);
    };

    const onDown = (e: PointerEvent) => {
      // Only touch/pen — mouse can't pinch.
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        startDist = dist();
        active = startDist > 0;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!active || pointers.size !== 2) return;
      const d = dist();
      if (d <= 0 || startDist <= 0) return;
      // Block native pinch-zoom and the surrounding scroll while we own it.
      if (e.cancelable) e.preventDefault();
      onPinchRef.current(d / startDist);
    };

    const onEnd = (e: PointerEvent) => {
      const had = pointers.delete(e.pointerId);
      if (!had) return;
      if (active && pointers.size < 2) {
        active = false;
        startDist = 0;
        onPinchEndRef.current?.();
      }
    };

    el.addEventListener("pointerdown", onDown, { passive: true });
    el.addEventListener("pointermove", onMove, { passive: false });
    el.addEventListener("pointerup", onEnd, { passive: true });
    el.addEventListener("pointercancel", onEnd, { passive: true });
    el.addEventListener("pointerleave", onEnd, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onEnd);
      el.removeEventListener("pointercancel", onEnd);
      el.removeEventListener("pointerleave", onEnd);
    };
  }, [ref, enabled]);
}
