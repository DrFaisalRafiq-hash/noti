import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { haptic } from "@/lib/notes-store";

/**
 * Pointer-driven "swipe down to dismiss" gesture for bottom sheets / modals.
 *
 * Usage:
 * ```tsx
 * const { sheetProps, handleProps, backdropStyle } = useSwipeDismiss({ onClose });
 * <div onClick={onClose} style={backdropStyle}>
 *   <div {...sheetProps}>
 *     <header {...handleProps}>...</header>
 *     ...
 *   </div>
 * </div>
 * ```
 *
 * Behaviour:
 *  - Vertical drag down on the handle (or anywhere on the sheet, when
 *    `dragOnSheet=true`) translates the sheet with rubber-band overscroll
 *    when pulling up.
 *  - Releasing past `closeAt` px **or** with a downward velocity above
 *    `velocityToClose` px/s commits to closing.
 *  - Otherwise the sheet springs back via CSS transition.
 *  - Backdrop opacity fades 1 → 0.4 in proportion to the drag depth so the
 *    page peeks through, matching native iOS sheet feel.
 *  - A short haptic tick fires on commit. Vertical scroll inside the sheet
 *    is preserved by ignoring drags that start on a scrollable child whose
 *    `scrollTop > 0`.
 */
export interface SwipeDismissOptions {
  onClose: () => void;
  /** Distance (px) past which the sheet auto-closes on release. Default 120. */
  closeAt?: number;
  /** Downward velocity (px/s) that triggers close even if distance is short. */
  velocityToClose?: number;
  /** Allow drag to start anywhere on the sheet (not just the handle).
   *  Useful for short modals; turn off for sheets with internal scroll. */
  dragOnSheet?: boolean;
  /** Disable the gesture entirely (e.g. when a confirm dialog is open inside). */
  disabled?: boolean;
}

export interface SwipeDismissBind {
  sheetProps: {
    style: CSSProperties;
    onPointerDown?: (e: RPointerEvent<HTMLElement>) => void;
    onPointerMove?: (e: RPointerEvent<HTMLElement>) => void;
    onPointerUp?: (e: RPointerEvent<HTMLElement>) => void;
    onPointerCancel?: (e: RPointerEvent<HTMLElement>) => void;
  };
  /** Spread on the drag-handle / header element. Always wired. */
  handleProps: {
    onPointerDown: (e: RPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: RPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: RPointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: RPointerEvent<HTMLElement>) => void;
    style: CSSProperties;
  };
  /** Spread on the backdrop wrapper for fade-out during drag. */
  backdropStyle: CSSProperties;
  /** Current drag offset in px (≥ 0). Useful for custom visuals. */
  dy: number;
  /** Whether a drag is currently in progress. */
  dragging: boolean;
}

export function useSwipeDismiss({
  onClose,
  closeAt = 120,
  velocityToClose = 600,
  dragOnSheet = false,
  disabled = false,
}: SwipeDismissOptions): SwipeDismissBind {
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);

  const startY = useRef(0);
  const startX = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const velocity = useRef(0);
  const pointerId = useRef<number | null>(null);
  const locked = useRef<null | "x" | "y">(null);
  const blocked = useRef(false);
  const startTarget = useRef<HTMLElement | null>(null);

  // Allow Esc to dismiss too — sheets without their own keyboard handler
  // still get free keyboard accessibility from the hook.
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, disabled]);

  const reset = useCallback(() => {
    setDy(0);
    setDragging(false);
    locked.current = null;
    blocked.current = false;
    pointerId.current = null;
    startTarget.current = null;
  }, []);

  const startDrag = useCallback((e: RPointerEvent<HTMLElement>) => {
    if (disabled || closing) return;
    // Mouse: only primary button. Don't start on form fields / buttons.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("button,a,input,textarea,select,[contenteditable='true']")) return;

    pointerId.current = e.pointerId;
    startY.current = e.clientY;
    startX.current = e.clientX;
    lastY.current = e.clientY;
    lastT.current = performance.now();
    velocity.current = 0;
    locked.current = null;
    blocked.current = false;
    startTarget.current = t;
    setDragging(true);
  }, [disabled, closing]);

  const moveDrag = useCallback((e: RPointerEvent<HTMLElement>) => {
    if (!dragging || pointerId.current !== e.pointerId || closing) return;
    const ddy = e.clientY - startY.current;
    const ddx = e.clientX - startX.current;

    // Lock direction once past the slop. If the user goes horizontal, ignore.
    if (!locked.current) {
      if (Math.abs(ddy) < 6 && Math.abs(ddx) < 6) return;
      locked.current = Math.abs(ddy) > Math.abs(ddx) ? "y" : "x";
      if (locked.current === "y") {
        // Refuse to dismiss if the gesture started inside a scrollable region
        // that is already scrolled — the user is trying to scroll content.
        const start = startTarget.current;
        if (start && ddy > 0) {
          const scroller = findScrollableAncestor(start);
          if (scroller && scroller.scrollTop > 0) {
            blocked.current = true;
          }
        }
      }
    }
    if (locked.current !== "y" || blocked.current) return;

    e.preventDefault?.();

    // Track velocity over a short window for fling detection.
    const now = performance.now();
    const dt = Math.max(1, now - lastT.current);
    velocity.current = ((e.clientY - lastY.current) / dt) * 1000;
    lastY.current = e.clientY;
    lastT.current = now;

    // Rubber-band when pulling up (negative dy).
    let next = ddy;
    if (next < 0) next = next * 0.25;
    setDy(next);
  }, [dragging, closing]);

  const endDrag = useCallback((e: RPointerEvent<HTMLElement>) => {
    if (pointerId.current !== e.pointerId) return;
    const wasY = locked.current === "y" && !blocked.current;
    const finalDy = dy;
    const v = velocity.current;
    reset();

    if (!wasY) { setDy(0); return; }

    const shouldClose = finalDy > closeAt || v > velocityToClose;
    if (shouldClose) {
      setClosing(true);
      haptic.light();
      // Slide off-screen, then call onClose so the parent can unmount.
      requestAnimationFrame(() => setDy(window.innerHeight));
      window.setTimeout(() => {
        onClose();
        setClosing(false);
        setDy(0);
      }, 220);
    } else {
      setDy(0);
    }
  }, [dy, closeAt, velocityToClose, onClose, reset]);

  // Fade backdrop in proportion to drag depth (0 → ~closeAt maps 1 → 0.4).
  const progress = Math.min(1, Math.max(0, dy) / (closeAt * 1.6));
  const backdropOpacity = 1 - progress * 0.6;

  const sharedTransform: CSSProperties = {
    transform: dy ? `translate3d(0, ${dy}px, 0)` : undefined,
    transition: dragging
      ? "none"
      : "transform 260ms cubic-bezier(.22,.8,.22,1)",
    touchAction: "pan-y",
    willChange: dragging ? "transform" : undefined,
  };

  return {
    sheetProps: {
      style: sharedTransform,
      ...(dragOnSheet
        ? {
            onPointerDown: startDrag,
            onPointerMove: moveDrag,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
          }
        : {}),
    },
    handleProps: {
      onPointerDown: startDrag,
      onPointerMove: moveDrag,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      style: { touchAction: "none", cursor: "grab" },
    },
    backdropStyle: {
      opacity: backdropOpacity,
      transition: dragging ? "none" : "opacity 260ms cubic-bezier(.22,.8,.22,1)",
    },
    dy,
    dragging,
  };
}

/** Walk up looking for an actually-scrollable element so drag-down doesn't
 *  fight an internal scroller that the user is trying to scroll up from. */
function findScrollableAncestor(el: HTMLElement | null): HTMLElement | null {
  let cur: HTMLElement | null = el;
  while (cur) {
    const style = window.getComputedStyle(cur);
    const overflowY = style.overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && cur.scrollHeight > cur.clientHeight) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}
